module.exports = function registerAccountRoutes({ app, auth, idempotenciaOffline, db, bcrypt, jwt, crypto, OAuth2Client, secret, validarEmail, resumirHash, criarSessaoConta, emailConfigurado, enviarEmail, formatarResultadoLugar, estadoDosMapas }) {
app.get('/health', async (_q, r) => {
  try {
    await db.query('SELECT 1');

    r.json({
      ok: true,
      database: true
    });
  } catch (e) {
    r.status(503).json({
      ok: false,
      database: false
    });
  }
});

app.post('/auth/register', async (q, r) => {
  try {
    const {
      name,
      email,
      password
    } = q.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) ||
      !password ||
      password.length < 6
    ) {
      return r.status(400).json({
        error:
          'Preencha nome, um e-mail válido e uma senha com pelo menos 6 caracteres.'
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const [x] = await db.execute(
      'INSERT INTO users(name,email,password_hash) VALUES(?,?,?)',
      [
        name.trim(),
        email.trim().toLowerCase(),
        hash
      ]
    );

    await db.execute(
      'INSERT INTO settings(user_id,routine_enabled,routine_consent_at) VALUES(?,FALSE,NOW())',
      [x.insertId]
    );
    await db.execute('UPDATE users SET last_login=NOW() WHERE id=?', [x.insertId]);
    const sessionId = await criarSessaoConta(x.insertId, q.body.device_label);

    r.status(201).json({
      token: jwt.sign(
        {
          id: x.insertId,
          sid: sessionId
        },
        secret,
        {
          expiresIn: '7d'
        }
      ),

      user: {
        id: x.insertId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        last_login: new Date()
      },
      session_id: sessionId
    });
  } catch (e) {
    r.status(400).json({
      error:
        e.code === 'ER_DUP_ENTRY'
          ? 'E-mail já cadastrado'
          : 'Erro ao cadastrar'
    });
  }
});

app.post('/auth/login', async (q, r) => {
  try {
    const email = String(q.body.email || '')
      .trim()
      .toLowerCase();

    const password = q.body.password || '';

    const [x] = await db.execute(
      'SELECT * FROM users WHERE email=?',
      [email]
    );

    if (
      !x[0] ||
      !(await bcrypt.compare(
        password,
        x[0].password_hash
      ))
    ) {
      return r.status(401).json({
        error: 'E-mail ou senha inválidos'
      });
    }


    await db.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [x[0].id]
    );
    const sessionId = await criarSessaoConta(x[0].id, q.body.device_label);


    const [updated] = await db.execute(
      'SELECT id,name,email,created_at,last_login FROM users WHERE id=?',
      [x[0].id]
    );

    r.json({
      token: jwt.sign(
        {
          id: x[0].id,
          sid: sessionId
        },
        secret,
        {
          expiresIn: '7d'
        }
      ),

      user: {
        id: updated[0].id,
        name: updated[0].name,
        email: updated[0].email,
        created_at: updated[0].created_at,
        last_login: updated[0].last_login
      },
      session_id: sessionId
    });
  } catch (e) {
    console.error('Erro no login:', e);

    r.status(500).json({
      error: 'Erro interno ao realizar login'
    });
  }
});

app.post('/auth/forgot-password', async (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase();
  if (!validarEmail(email)) return r.status(400).json({ error: 'Digite um e-mail válido.' });
  if (!emailConfigurado()) {
    return r.status(503).json({ error: 'A recuperação por e-mail não está configurada. Configure Resend ou SMTP no servidor.' });
  }

  try {
    const [users] = await db.execute('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
    if (!users.length) return r.json({ ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um código de recuperação.' });
    const [recentes] = await db.execute('SELECT id FROM password_reset_codes WHERE user_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE) LIMIT 1', [users[0].id]);
    if (recentes.length) return r.json({ ok: true, message: 'Se o e-mail estiver cadastrado, enviaremos um código de recuperação.' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await db.execute('UPDATE password_reset_codes SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [users[0].id]);
    await db.execute('INSERT INTO password_reset_codes(user_id,code_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))', [users[0].id, resumirHash(code)]);
    try {
      await enviarEmail({
        to: email,
        subject: 'Código para redefinir sua senha — Lembriê',
        text: `Seu código de recuperação é ${code}. Ele expira em 15 minutos.`
      });
    } catch (error) {
      await db.execute('UPDATE password_reset_codes SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [users[0].id]);
      console.error('Falha ao enviar código de recuperação:', error.message);
      return r.status(502).json({ error: 'Não consegui enviar o código. Confira o endereço ou tente novamente mais tarde.' });
    }
    r.json({ ok: true, message: 'Se o e-mail estiver cadastrado, enviamos um código. Confira a caixa de entrada e o spam.' });
  } catch (error) {
    console.error(error);
    r.status(500).json({ error: 'Não foi possível iniciar a recuperação de senha.' });
  }
});

app.post('/auth/reset-password', async (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase();
  const code = String(q.body.code || '').trim();
  const password = String(q.body.password || '');
  if (!validarEmail(email) || !/^\d{6}$/.test(code) || password.length < 6) {
    return r.status(400).json({ error: 'Informe e-mail, código de 6 dígitos e uma senha com pelo menos 6 caracteres.' });
  }

  const [rows] = await db.execute(
    `SELECT c.id,c.code_hash,c.attempts,u.id user_id
     FROM password_reset_codes c JOIN users u ON u.id=c.user_id
     WHERE u.email=? AND c.used_at IS NULL AND c.expires_at>NOW()
     ORDER BY c.id DESC LIMIT 1`,
    [email]
  );
  if (!rows.length || rows[0].attempts >= 5) return r.status(400).json({ error: 'Código inválido ou expirado. Solicite outro.' });

  const hash = resumirHash(code);
  const esperado = Buffer.from(rows[0].code_hash, 'hex');
  const recebido = Buffer.from(hash, 'hex');
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) {
    await db.execute('UPDATE password_reset_codes SET attempts=attempts+1 WHERE id=?', [rows[0].id]);
    return r.status(400).json({ error: 'Código inválido ou expirado. Confira e tente novamente.' });
  }

  const senhaHash = await bcrypt.hash(password, 12);
  await db.execute('UPDATE users SET password_hash=? WHERE id=?', [senhaHash, rows[0].user_id]);
  await db.execute('UPDATE password_reset_codes SET used_at=NOW() WHERE id=?', [rows[0].id]);
  r.json({ ok: true, message: 'Senha alterada. Agora você já pode entrar.' });
});

app.post('/auth/google/reset-password', async (q, r) => {
  const idToken = String(q.body.id_token || '').trim();
  const password = String(q.body.password || '');
  if (!idToken || password.length < 6) return r.status(400).json({ error: 'Entre com o Google e informe uma nova senha com pelo menos 6 caracteres.' });
  const audiences = String(process.env.GOOGLE_OAUTH_CLIENT_IDS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!audiences.length) return r.status(503).json({ error: 'A recuperação pelo Google ainda não foi configurada neste servidor.' });

  let payload;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch (error) {
    return r.status(401).json({ error: 'A confirmação do Google expirou ou não é válida. Tente novamente.' });
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  const emailVerificado = payload?.email_verified === true;
  const hostedDomainConfigurado = String(process.env.GOOGLE_ALLOWED_HOSTED_DOMAIN || '').trim().toLowerCase();
  const dominioCorporativoVerificado = hostedDomainConfigurado && String(payload?.hd || '').trim().toLowerCase() === hostedDomainConfigurado;
  if (!emailVerificado || (!email.endsWith('@gmail.com') && !dominioCorporativoVerificado)) {
    return r.status(403).json({ error: 'Use uma conta Gmail confirmada ou uma conta da organização configurada no Lembriê.' });
  }

  let connection;
  let transacaoAberta = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transacaoAberta = true;
    const [users] = await connection.execute('SELECT id FROM users WHERE email=? LIMIT 1 FOR UPDATE', [email]);
    if (!users.length) {
      await connection.rollback();
      transacaoAberta = false;
      return r.status(404).json({ error: 'Não existe uma conta Lembriê cadastrada com esse e-mail.' });
    }
    const userId = users[0].id;
    const hashToken = resumirHash(idToken);
    await connection.execute('DELETE FROM google_password_reset_uses WHERE created_at<DATE_SUB(NOW(),INTERVAL 90 DAY)');
    await connection.execute('INSERT INTO google_password_reset_uses(user_id,token_hash) VALUES(?,?)', [userId, hashToken]);
    await connection.execute('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 12), userId]);
    await connection.execute('UPDATE password_reset_codes SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [userId]);
    const [updated] = await connection.execute('SELECT id,name,email,created_at,last_login FROM users WHERE id=?', [userId]);
    await connection.commit();
    transacaoAberta = false;
    r.json({ ok: true, message: 'Senha redefinida com a conta Google confirmada.', user: updated[0] });
  } catch (error) {
    if (connection && transacaoAberta) await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') return r.status(409).json({ error: 'Essa confirmação Google já foi usada. Entre com o Google novamente para gerar outra.' });
    console.error('Falha na recuperação pelo Google:', error.message);
    r.status(500).json({ error: 'Não foi possível redefinir a senha agora.' });
  } finally {
    connection?.release();
  }
});

app.get('/me', auth, async (q, r) => {
  try {
    const [x] = await db.execute(
      `
      SELECT
        id,
        name,
        email,
        created_at,
        last_login
      FROM users
      WHERE id=?
      `,
      [q.user.id]
    );

    if (!x[0]) {
      return r.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    r.json(x[0]);
  } catch (e) {
    console.error(e);

    r.status(500).json({
      error: 'Não foi possível carregar o usuário'
    });
  }
});

app.get('/me/security', auth, async (q, r) => {
  try {
    const [users] = await db.execute('SELECT last_login FROM users WHERE id=? LIMIT 1', [q.user.id]);
    const [sessions] = await db.execute(`SELECT id,device_label,location_label,started_at,last_activity_at,ended_at,active_seconds,
      (ended_at IS NULL AND last_activity_at>=DATE_SUB(NOW(),INTERVAL 2 MINUTE)) AS active
      FROM account_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 10`, [q.user.id]);
    r.json({ last_login: users[0]?.last_login || null, sessions });
  } catch (error) {
    console.error('Falha ao carregar histórico de acesso:', error);
    r.status(500).json({ error: 'Não foi possível carregar os dados de segurança.' });
  }
});

app.post('/sessions/location', auth, async (q, r) => {
  const sessionId = String(q.body.session_id || '');
  const latitude = Number(q.body.latitude);
  const longitude = Number(q.body.longitude);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return r.status(400).json({ error: 'Dados de localização inválidos.' });
  }
  try {
    const [owned] = await db.execute('SELECT location_label FROM account_sessions WHERE id=? AND user_id=? LIMIT 1', [sessionId, q.user.id]);
    if (!owned.length) return r.status(404).json({ error: 'Sessão não encontrada.' });
    if (owned[0].location_label) return r.json({ location_label: owned[0].location_label });
    const local = await (estadoDosMapas.fila = estadoDosMapas.fila.catch(() => {}).then(async () => {
      const espera = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
      if (espera) await new Promise(resolve => setTimeout(resolve, espera));
      estadoDosMapas.ultimoPedido = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '10', addressdetails: '1' }).toString();
      const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)', 'Referer': 'https://lembre-web.onrender.com/' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Não foi possível identificar a cidade deste acesso.');
      return response.json();
    }));
    const dados = formatarResultadoLugar(local);
    const localAproximado = [dados.cidade, dados.uf].filter(Boolean).join(', ').slice(0, 180);
    if (!localAproximado) return r.json({ location_label: null });
    await db.execute('UPDATE account_sessions SET location_label=? WHERE id=? AND user_id=? AND location_label IS NULL', [localAproximado, sessionId, q.user.id]);
    r.json({ location_label: localAproximado });
  } catch (error) {
    console.error('Não foi possível identificar o local aproximado do acesso:', error.message);
    r.status(502).json({ error: 'Não foi possível identificar a cidade deste acesso.' });
  }
});

app.post('/sessions/start', auth, async (q, r) => {
  try {
    const sessionId = await criarSessaoConta(q.user.id, q.body.device_label);
    r.status(201).json({ session_id: sessionId });
  } catch (error) {
    console.error('Falha ao iniciar sessão monitorada:', error);
    r.status(500).json({ error: 'Não foi possível registrar esta sessão.' });
  }
});

app.post('/sessions/heartbeat', auth, async (q, r) => {
  const sessionId = String(q.body.session_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return r.status(400).json({ error: 'Sessão inválida.' });
  try {
    const [result] = await db.execute(`UPDATE account_sessions
      SET active_seconds=active_seconds+LEAST(90,GREATEST(0,TIMESTAMPDIFF(SECOND,last_activity_at,NOW()))),
          last_activity_at=NOW()
      WHERE id=? AND user_id=? AND ended_at IS NULL`, [sessionId, q.user.id]);
    if (!result.affectedRows) return r.status(404).json({ error: 'Sessão não encontrada ou encerrada.' });
    r.json({ ok: true });
  } catch (error) {
    console.error('Falha ao atualizar atividade da sessão:', error);
    r.status(500).json({ error: 'Não foi possível atualizar a sessão.' });
  }
});

app.post('/sessions/end', auth, async (q, r) => {
  const sessionId = String(q.body.session_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return r.status(400).json({ error: 'Sessão inválida.' });
  try {
    await db.execute(`UPDATE account_sessions
      SET active_seconds=active_seconds+LEAST(90,GREATEST(0,TIMESTAMPDIFF(SECOND,last_activity_at,NOW()))),
          last_activity_at=NOW(),ended_at=NOW()
      WHERE id=? AND user_id=? AND ended_at IS NULL`, [sessionId, q.user.id]);
    r.json({ ok: true });
  } catch (error) {
    console.error('Falha ao encerrar sessão:', error);
    r.status(500).json({ error: 'Não foi possível encerrar a sessão.' });
  }
});

app.post('/me/email-verification/send', auth, async (q, r) => {
  const email = String(q.body.email || '').trim().toLowerCase();
  const emailValido = email.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_{}|~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email);
  if (!emailValido) return r.status(400).json({ error: 'Digite um e-mail válido.' });
  if (!emailConfigurado()) {
    return r.status(503).json({ error: 'O envio de e-mail não está configurado. Configure Resend ou SMTP para confirmar o endereço.' });
  }

  try {
    const [atuais] = await db.execute('SELECT email FROM users WHERE id=?', [q.user.id]);
    if (!atuais.length) return r.status(404).json({ error: 'Usuário não encontrado.' });
    if (String(atuais[0].email).toLowerCase() === email) return r.json({ ok: true, already_current: true, message: 'Esse e-mail já está na sua conta.' });

    const [duplicados] = await db.execute('SELECT id FROM users WHERE email=? AND id<>? LIMIT 1', [email, q.user.id]);
    if (duplicados.length) return r.status(409).json({ error: 'Este e-mail já está em uso.' });
    const [recentes] = await db.execute(
      'SELECT id FROM email_change_codes WHERE user_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE) LIMIT 1',
      [q.user.id]
    );
    if (recentes.length) return r.status(429).json({ error: 'Aguarde um minuto antes de solicitar outro código.' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await db.execute('UPDATE email_change_codes SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [q.user.id]);
    await db.execute(
      'INSERT INTO email_change_codes(user_id,email,code_hash,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))',
      [q.user.id, email, resumirHash(code)]
    );
    try {
      await enviarEmail({
        to: email,
        subject: 'Confirme seu e-mail — Lembriê',
        text: `Seu código para confirmar a alteração de e-mail é ${code}. Ele expira em 15 minutos.`
      });
    } catch (error) {
      await db.execute('UPDATE email_change_codes SET used_at=NOW() WHERE user_id=? AND email=? AND used_at IS NULL', [q.user.id, email]);
      console.error('Falha ao enviar código de confirmação:', error.message);
      return r.status(502).json({ error: 'Não consegui enviar o código para esse e-mail. Confira o endereço e tente novamente.' });
    }
    r.json({ ok: true, message: 'Enviamos um código de confirmação para o novo e-mail.' });
  } catch (error) {
    console.error(error);
    r.status(500).json({ error: 'Não foi possível iniciar a confirmação do e-mail.' });
  }
});

app.patch('/me', auth, idempotenciaOffline, async (q, r) => {
  const name = String(q.body.name || '').trim();
  const email = String(q.body.email || '').trim().toLowerCase();
  const code = String(q.body.email_verification_code || '').trim();
  const letrasNoNome = name.match(/\p{L}/gu) || [];
  const nomeValido = name.length <= 120 && letrasNoNome.length >= 2 && /^[\p{L}\p{M} .'-]+$/u.test(name);
  const emailValido = email.length <= 254 && /^[A-Z0-9.!#$%&'*+/=?^_{}|~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email);
  if (!nomeValido || !emailValido) return r.status(400).json({ error: 'Informe um nome e um e-mail válidos. O e-mail deve ter um domínio no formato nome@exemplo.com.' });
  let connection;
  let transacaoAberta = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transacaoAberta = true;
    const [atuais] = await connection.execute('SELECT email FROM users WHERE id=? FOR UPDATE', [q.user.id]);
    if (!atuais.length) {
      await connection.rollback();
      transacaoAberta = false;
      return r.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const emailMudou = String(atuais[0].email).trim().toLowerCase() !== email;
    let codigoUsadoId = null;
    if (emailMudou) {
      if (!/^\d{6}$/.test(code)) {
        await connection.rollback();
        transacaoAberta = false;
        return r.status(400).json({ error: 'Confirme o novo e-mail com o código enviado antes de salvar.' });
      }
      const [codigos] = await connection.execute(
        `SELECT id,code_hash,attempts FROM email_change_codes
         WHERE user_id=? AND email=? AND used_at IS NULL AND expires_at>NOW()
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [q.user.id, email]
      );
      if (!codigos.length || Number(codigos[0].attempts) >= 5) {
        await connection.rollback();
        transacaoAberta = false;
        return r.status(400).json({ error: 'Código inválido ou expirado. Solicite um novo código.' });
      }
      const hash = resumirHash(code);
      const esperado = Buffer.from(codigos[0].code_hash, 'hex');
      const recebido = Buffer.from(hash, 'hex');
      if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) {
        await connection.execute('UPDATE email_change_codes SET attempts=attempts+1 WHERE id=?', [codigos[0].id]);
        await connection.commit();
        transacaoAberta = false;
        return r.status(400).json({ error: 'Código incorreto. Confira o e-mail e tente novamente.' });
      }
      codigoUsadoId = codigos[0].id;
    }

    await connection.execute('UPDATE users SET name=?,email=? WHERE id=?', [name, email, q.user.id]);
    if (codigoUsadoId) await connection.execute('UPDATE email_change_codes SET used_at=NOW() WHERE id=?', [codigoUsadoId]);
    const [rows] = await connection.execute('SELECT id,name,email,created_at,last_login FROM users WHERE id=?', [q.user.id]);
    const usuario = rows[0];
    if (!usuario) {
      await connection.rollback();
      transacaoAberta = false;
      return r.status(404).json({ error: 'Usuário não encontrado.' });
    }
    if (usuario.name !== name || String(usuario.email).toLowerCase() !== email) {
      await connection.rollback();
      transacaoAberta = false;
      return r.status(500).json({ error: 'O servidor não confirmou a gravação dos dados.' });
    }
    await connection.commit();
    transacaoAberta = false;
    r.json({ ok: true, user: usuario, email_verified: emailMudou });
  } catch (error) {
    if (connection && transacaoAberta) await connection.rollback().catch(() => {});
    r.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Este e-mail já está em uso.' : 'Não foi possível atualizar seu perfil.' });
  } finally {
    connection?.release();
  }
});

app.post('/auth/change-password', auth, async (q, r) => {
  const atual = String(q.body.current_password || '');
  const nova = String(q.body.new_password || '');
  if (nova.length < 6) return r.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  const [rows] = await db.execute('SELECT password_hash FROM users WHERE id=?', [q.user.id]);
  if (!rows[0] || !(await bcrypt.compare(atual, rows[0].password_hash))) return r.status(401).json({ error: 'A senha atual está incorreta.' });
  await db.execute('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(nova, 12), q.user.id]);
  r.json({ ok: true, message: 'Senha alterada com sucesso.' });
});


};
