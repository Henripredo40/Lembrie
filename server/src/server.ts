require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const db = require('./config/database');
const createAuth = require('./middleware/auth');

const app = express();

const producao = process.env.NODE_ENV === 'production';
const origensPermitidas = new Set(
  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origem => origem.trim())
    .filter(Boolean)
);

app.use(cors({
  origin(origem, callback) {
    if (!origem) return callback(null, true);
    const origemLocal = !producao && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem);
    callback(null, origemLocal || origensPermitidas.has(origem));
  }
}));
app.use(express.json({ limit: '1mb' }));
const diretorioWeb = path.resolve(__dirname, '../public');
app.use(express.static(diretorioWeb, { index: false }));

const secret = process.env.JWT_SECRET || (producao ? '' : 'dev-secret-change-me');
if (!secret) throw new Error('JWT_SECRET precisa estar configurado no ambiente de produção.');
const auth = createAuth(secret);
const cacheLugares = new Map();
let ultimoPedidoDeMapa = 0;
let filaLugares: Promise<unknown> = Promise.resolve();

const validarEmail = valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
const resumirHash = valor => crypto.createHash('sha256').update(valor).digest('hex');
const emailConfigurado = () => Boolean(
  (process.env.RESEND_API_KEY && process.env.RESEND_FROM) ||
  (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
);

async function enviarEmail({ to, subject, text }) {
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) {
      const detalhes = await resposta.json().catch(() => ({}));
      throw new Error(detalhes.message || `Resend respondeu com HTTP ${resposta.status}.`);
    }
    return;
  }

  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)) {
    throw new Error('Configure Resend ou SMTP para enviar e-mails.');
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

async function init() {
  const caminhoSchema = path.resolve(__dirname, '../sql/schema.sql');
  const schema = fs.readFileSync(caminhoSchema, 'utf8')
    .replace(/^\s*CREATE\s+DATABASE\b[^;]*;\s*/i, '')
    .replace(/^\s*USE\s+[^;]+;\s*/i, '');
  for (const comando of schema.split(';').map(item => item.trim()).filter(Boolean)) {
    await db.query(comando);
  }

  async function ensureColumn(table, column, definition) {
    const [rows] = await db.execute(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );

    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  await ensureColumn('users', 'last_login', 'TIMESTAMP NULL DEFAULT NULL');
  await ensureColumn('settings', 'preventive_alerts', 'BOOLEAN DEFAULT TRUE');
  await ensureColumn('settings', 'essential_only', 'BOOLEAN DEFAULT FALSE');
  await ensureColumn('settings', 'routine_consent_at', 'DATETIME NULL');
  await ensureColumn('objects', 'image_data', 'LONGTEXT NULL');
  await db.execute('UPDATE settings SET routine_enabled=FALSE,routine_consent_at=NOW() WHERE routine_consent_at IS NULL');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS exit_profiles(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      destination VARCHAR(180) NULL,
      checklist_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS routines(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      day_of_week TINYINT NOT NULL,
      routine_time CHAR(5) NOT NULL,
      destination VARCHAR(180) NULL,
      object_ids_json JSON NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await ensureColumn('routines', 'routine_time', "CHAR(5) NOT NULL DEFAULT '08:00'");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS routine_plans(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      destination VARCHAR(180) NOT NULL,
      planned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX ix_routine_user_date(user_id, planned_at)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_codes(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      code_hash CHAR(64) NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX ix_reset_user(user_id, created_at)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_change_codes(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      email VARCHAR(254) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX ix_email_change_user(user_id, created_at),
      INDEX ix_email_change_email(email)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS google_password_reset_uses(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX ix_google_reset_user(user_id, created_at)
    )
  `);
}

app.get('/health', async (q, r) => {
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

    r.status(201).json({
      token: jwt.sign(
        {
          id: x.insertId
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
        last_login: null
      }
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

    
    const [updated] = await db.execute(
      'SELECT id,name,email,created_at,last_login FROM users WHERE id=?',
      [x[0].id]
    );

    r.json({
      token: jwt.sign(
        {
          id: x[0].id
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
      }
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

app.patch('/me', auth, async (q, r) => {
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

app.get('/objects', auth, async (q, r) => {
  const [x] = await db.execute(
    `
    SELECT
      o.*,
      o.important AS essential,
      d.id device_id,
      d.ble_uuid,
      d.connected,
      d.last_rssi,
      d.battery_percent,
      d.last_seen_at
    FROM objects o
    LEFT JOIN devices d
      ON d.object_id=o.id
      AND d.user_id=o.user_id
    WHERE o.user_id=?
    ORDER BY o.important DESC,o.name
    `,
    [q.user.id]
  );

  r.json(x);
});

app.post('/objects', auth, async (q, r) => {
  try {
    const {
      name,
      category,
      important,
      image_data,
      ble_uuid,
      uuid
    } = q.body;
    const isImportant = q.body.important ?? q.body.essential;
    const deviceUuid = ble_uuid || uuid;
    if (image_data != null && (typeof image_data !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image_data) || image_data.length > 650000)) {
      return r.status(400).json({ error: 'A foto precisa ser JPEG, PNG ou WebP e ter no máximo 450 KB.' });
    }

    if (!name?.trim()) {
      return r.status(400).json({
        error: 'Nome obrigatório'
      });
    }

    const [x] = await db.execute(
      `
      INSERT INTO objects(
        user_id,
        name,
        category,
        important,
        image_data
      )
      VALUES(?,?,?,?,?)
      `,
      [
        q.user.id,
        name.trim(),
        category || 'Outros',
        !!isImportant,
        image_data || null
      ]
    );

    if (deviceUuid?.trim()) {
      await db.execute(
        `
        INSERT INTO devices(
          user_id,
          object_id,
          ble_uuid
        )
        VALUES(?,?,?)
        `,
        [
          q.user.id,
          x.insertId,
          deviceUuid.trim()
        ]
      );
    }

    r.status(201).json({
      id: x.insertId,
      name: name.trim(),
      category: category || 'Outros',
      important: !!isImportant,
      essential: !!isImportant,
      image_data: image_data || null,
      ble_uuid: deviceUuid?.trim() || null,
      connected: false
    });
  } catch (e) {
    r.status(400).json({
      error:
        e.code === 'ER_DUP_ENTRY'
          ? 'Esse dispositivo já está cadastrado.'
          : 'Não foi possível adicionar o objeto.'
    });
  }
});

app.patch('/objects/:id', auth, async (q, r) => {
  const conexao = await db.getConnection();
  const informarChaveiro = Object.prototype.hasOwnProperty.call(q.body, 'ble_uuid');
  const nome = q.body.name;
  const categoria = q.body.category;
  const essencial = q.body.important ?? q.body.essential;
  const informarImagem = Object.prototype.hasOwnProperty.call(q.body, 'image_data');
  const imageData = q.body.image_data;
  const uuidBruto = informarChaveiro ? q.body.ble_uuid : undefined;
  const uuid = uuidBruto == null || String(uuidBruto).trim() === ''
    ? null
    : String(uuidBruto).trim();

  try {
    if (informarImagem && imageData != null && (typeof imageData !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(imageData) || imageData.length > 650000)) {
      return r.status(400).json({ error: 'A foto precisa ser JPEG, PNG ou WebP e ter no máximo 450 KB.' });
    }
    await conexao.beginTransaction();

    const [objeto] = await conexao.execute(
      'SELECT id FROM objects WHERE id=? AND user_id=? FOR UPDATE',
      [q.params.id, q.user.id]
    );

    if (!objeto.length) {
      await conexao.rollback();
      return r.status(404).json({ error: 'Objeto não encontrado.' });
    }

    await conexao.execute(
      `
      UPDATE objects
      SET
        name=COALESCE(?,name),
        category=COALESCE(?,category),
        important=COALESCE(?,important),
        image_data=IF(?, ?, image_data)
      WHERE id=? AND user_id=?
      `,
      [
        nome?.trim() || null,
        categoria?.trim() || null,
        essencial === undefined ? null : !!essencial,
        informarImagem,
        imageData || null,
        q.params.id,
        q.user.id
      ]
    );

    let idDispositivo = null;

    if (informarChaveiro && uuid) {
      const [outrosVinculos] = await conexao.execute(
        'SELECT id FROM devices WHERE user_id=? AND ble_uuid=? AND object_id<>? LIMIT 1 FOR UPDATE',
        [q.user.id, uuid, q.params.id]
      );

      if (outrosVinculos.length) {
        await conexao.rollback();
        return r.status(409).json({ error: 'Esse dispositivo Bluetooth já está associado a outro objeto.' });
      }

      const [vinculosAtuais] = await conexao.execute(
        'SELECT id FROM devices WHERE user_id=? AND object_id=? ORDER BY id LIMIT 1 FOR UPDATE',
        [q.user.id, q.params.id]
      );

      if (vinculosAtuais.length) {
        idDispositivo = vinculosAtuais[0].id;
        await conexao.execute(
          `UPDATE devices
           SET ble_uuid=?, connected=FALSE, last_rssi=NULL,
               battery_percent=NULL, last_seen_at=NULL
           WHERE id=? AND user_id=?`,
          [uuid, idDispositivo, q.user.id]
        );
      } else {
        const [novoVinculo] = await conexao.execute(
          'INSERT INTO devices(user_id, object_id, ble_uuid) VALUES(?,?,?)',
          [q.user.id, q.params.id, uuid]
        );
        idDispositivo = novoVinculo.insertId;
      }
    } else if (informarChaveiro) {
      await conexao.execute(
        'DELETE FROM devices WHERE user_id=? AND object_id=?',
        [q.user.id, q.params.id]
      );
    }

    await conexao.commit();
    return r.json({ ok: true, ble_uuid: uuid, device_id: idDispositivo });
  } catch (e) {
    await conexao.rollback();
    console.error('Erro ao atualizar objeto:', e);
    return r.status(e.code === 'ER_DUP_ENTRY' ? 409 : 500).json({
      error: e.code === 'ER_DUP_ENTRY'
        ? 'Esse dispositivo Bluetooth já está associado a outro objeto.'
        : 'Não foi possível salvar as alterações do objeto.'
    });
  } finally {
    conexao.release();
  }
});

app.delete('/objects/:id', auth, async (q, r) => {
  const [x] = await db.execute(
    'DELETE FROM objects WHERE id=? AND user_id=?',
    [
      q.params.id,
      q.user.id
    ]
  );

  if (!x.affectedRows) {
    return r.status(404).json({
      error: 'Objeto não encontrado'
    });
  }

  r.json({
    ok: true
  });
});

app.post('/devices/heartbeat', auth, async (q, r) => {
  const {
    ble_uuid,
    connected,
    rssi,
    battery_percent
  } = q.body;

  if (!ble_uuid) {
    return r.status(400).json({
      error: 'ble_uuid obrigatório'
    });
  }

  const [x] = await db.execute(
    `
    UPDATE devices
    SET
      connected=?,
      last_rssi=?,
      battery_percent=?,
      last_seen_at=NOW()
    WHERE ble_uuid=? AND user_id=?
    `,
    [
      !!connected,
      rssi ?? null,
      battery_percent ?? null,
      ble_uuid,
      q.user.id
    ]
  );

  r.json({
    ok: true,
    updated: x.affectedRows
  });
});

app.post('/devices/locate', auth, async (q, r) => {
  const [x] = await db.execute(
    'SELECT id FROM devices WHERE id=? AND user_id=?',
    [
      q.body.device_id,
      q.user.id
    ]
  );

  if (!x[0]) {
    return r.status(404).json({
      error: 'Dispositivo não encontrado'
    });
  }

  await db.execute(
    'INSERT INTO events(user_id,type,message) VALUES(?,?,?)',
    [
      q.user.id,
      'locate',
      'Comando para localizar chaveiro solicitado'
    ]
  );

  r.json({
    ok: true,
    command: 'BUZZER_ON',
    note:
      'O comando físico depende do serviço BLE definido no firmware do ESP32.'
  });
});

app.get('/events', auth, async (q, r) => {
  const [x] = await db.execute(
    `
    SELECT
      e.*,
      o.name object_name
    FROM events e
    LEFT JOIN objects o
      ON o.id=e.object_id
    WHERE e.user_id=?
    ORDER BY e.id DESC
    LIMIT 200
    `,
    [q.user.id]
  );

  r.json(x);
});

app.post('/events', auth, async (q, r) => {
  const {
    object_id,
    type,
    message,
    rssi
  } = q.body;

  if (!message?.trim()) {
    return r.status(400).json({
      error: 'Mensagem obrigatória'
    });
  }

  await db.execute(
    `
    INSERT INTO events(
      user_id,
      object_id,
      type,
      message,
      rssi
    )
    VALUES(?,?,?,?,?)
    `,
    [
      q.user.id,
      object_id || null,
      type || 'info',
      message.trim(),
      rssi ?? null
    ]
  );

  r.status(201).json({
    ok: true
  });
});

app.get('/settings', auth, async (q, r) => {
  const [x] = await db.execute(
    `
    SELECT
      notifications,
      routine_enabled,
      preventive_alerts,
      essential_only
    FROM settings
    WHERE user_id=?
    `,
    [q.user.id]
  );

  r.json(
    x[0] || {
      notifications: true,
      routine_enabled: false,
      preventive_alerts: true,
      essential_only: false
    }
  );
});

app.patch('/settings', auth, async (q, r) => {
  await db.execute(
    `
    UPDATE settings
    SET
      notifications=COALESCE(?,notifications),
      routine_enabled=COALESCE(?,routine_enabled),
      routine_consent_at=IF(?=1,NOW(),routine_consent_at),
      preventive_alerts=COALESCE(?,preventive_alerts),
      essential_only=COALESCE(?,essential_only)
    WHERE user_id=?
    `,
    [
      q.body.notifications === undefined
        ? null
        : !!q.body.notifications,

      q.body.routine_enabled === undefined
        ? null
        : !!q.body.routine_enabled,

      q.body.routine_enabled === undefined
        ? null
        : !!q.body.routine_enabled,

      q.body.preventive_alerts === undefined
        ? null
        : !!q.body.preventive_alerts,

      q.body.essential_only === undefined
        ? null
        : !!q.body.essential_only,

      q.user.id
    ]
  );

  if (q.body.routine_enabled === false) {
    await db.execute('DELETE FROM routine_plans WHERE user_id=?', [q.user.id]);
  }

  r.json({
    ok: true
  });
});

app.get('/routine/plans', auth, async (q, r) => {
  const [setting] = await db.execute('SELECT routine_enabled FROM settings WHERE user_id=?', [q.user.id]);
  if (!setting[0] || !setting[0].routine_enabled) return r.json([]);
  const [plans] = await db.execute(
    `SELECT destination,planned_at FROM routine_plans
     WHERE user_id=? AND planned_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     ORDER BY planned_at DESC LIMIT 60`,
    [q.user.id]
  );
  r.json(plans);
});

app.post('/routine/plans', auth, async (q, r) => {
  const destination = String(q.body.destination || '').trim();
  if (destination.length < 2 || destination.length > 180) return r.status(400).json({ error: 'Informe um destino entre 2 e 180 caracteres.' });
  const [setting] = await db.execute('SELECT routine_enabled FROM settings WHERE user_id=?', [q.user.id]);
  if (!setting[0] || !setting[0].routine_enabled) return r.status(403).json({ error: 'Ative o reconhecimento opcional de rotina nas configurações para salvar destinos.' });
  await db.execute('INSERT INTO routine_plans(user_id,destination) VALUES(?,?)', [q.user.id, destination]);
  r.status(201).json({ ok: true });
});

function suggestions(destination, objects) {
  const d = String(destination || '').toLowerCase();

  const rules: Array<[string, string[]]> = [
    [
      'academia',
      [
        'Garrafa de água',
        'Toalha',
        'Fone de ouvido'
      ]
    ],
    [
      'trabalho',
      [
        'Notebook',
        'Carregador',
        'Crachá'
      ]
    ],
    [
      'escola',
      [
        'Caderno',
        'Estojo',
        'Mochila'
      ]
    ],
    [
      'faculdade',
      [
        'Caderno',
        'Notebook',
        'Carregador'
      ]
    ],
    [
      'viagem',
      [
        'Documento',
        'Carteira',
        'Carregador'
      ]
    ],
    [
      'praia',
      [
        'Protetor solar',
        'Toalha',
        'Garrafa de água'
      ]
    ],
    [
      'mercado',
      [
        'Carteira',
        'Sacola'
      ]
    ],
    [
      'médico',
      [
        'Documento',
        'Carteira',
        'Cartão do convênio'
      ]
    ]
  ];

  let base = [];

  for (const [k, v] of rules) {
    if (d.includes(k)) {
      base.push(...v);
    }
  }

  const registered = objects
    .filter(o => o.important)
    .map(o => o.name);

  return [
    ...new Set([
      ...registered,
      ...base
    ])
  ].slice(0, 12);
}

function registeredSuggestions(destination, objects) {
  const candidateNames = suggestions(destination, []);
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  const normalizedCandidates = candidateNames.map(normalize);

  return objects
    .filter(object => {
      if (object.important) return true;
      const nome = normalize(object.name);
      const categoria = normalize(object.category);
      return normalizedCandidates.some(candidate =>
        (nome && (nome.includes(candidate) || candidate.includes(nome))) ||
        (categoria && categoria !== 'outros' && (candidate.includes(categoria) || categoria.includes(candidate)))
      );
    })
    .map(object => ({
      id: object.id,
      name: object.name,
      category: object.category || 'Outros',
      essential: Boolean(object.important),
      image_data: object.image_data || null,
    }));
}

const ufPorEstado: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', pará: 'PA',
  paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function formatarResultadoLugar(item, cepPreferido = '') {
  const endereço = item.address || {};
  const códigoEstado = String(endereço['ISO3166-2-lvl4'] || '').split('-').pop().toUpperCase();
  const uf = /^[A-Z]{2}$/.test(códigoEstado)
    ? códigoEstado
    : ufPorEstado[String(endereço.state || '').toLocaleLowerCase('pt-BR')] || '';
  return {
    id: String(item.place_id || `coord:${item.lat},${item.lon}`),
    nome: item.name || item.display_name.split(',')[0],
    endereço: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    cep: cepPreferido || endereço.postcode || '',
    logradouro: endereço.road || endereço.pedestrian || endereço.residential || '',
    bairro: endereço.suburb || endereço.neighbourhood || endereço.city_district || '',
    cidade: endereço.city || endereço.town || endereço.village || endereço.municipality || '',
    uf,
  };
}

app.post('/departure/check', auth, async (q, r) => {
  const objects = (
    await db.execute(
      `
      SELECT
        o.*,
        d.connected,
        d.ble_uuid
      FROM objects o
      LEFT JOIN devices d
        ON d.object_id=o.id AND d.user_id=o.user_id
      WHERE o.user_id=?
      `,
      [q.user.id]
    )
  )[0];

  const destination = String(
    q.body.destination || ''
  ).trim();
  const checkedIds = new Set(
    (Array.isArray(q.body.checked_ids) ? q.body.checked_ids : [])
      .map(Number)
      .filter(Number.isSafeInteger)
  );
  const plannedIds = new Set(
    (Array.isArray(q.body.planned_ids) ? q.body.planned_ids : [])
      .map(Number)
      .filter(Number.isSafeInteger)
  );

  const expected = suggestions(
    destination,
    objects
  );

  const missing = objects
    .filter(
      o =>
        o.important &&
        o.ble_uuid &&
        !o.connected &&
        !checkedIds.has(Number(o.id))
    )
    .map(o => o.name);

  const withoutKeychain = objects
    .filter(o => o.important && !o.ble_uuid && !checkedIds.has(Number(o.id)))
    .map(o => o.name);

  const detected = objects
    .filter(o => o.connected)
    .map(o => o.name);

  const planned = objects
    .filter(o => plannedIds.has(Number(o.id)))
    .map(o => o.name);

  const level =
    missing.length
      ? 'alert'
      : destination
        ? 'attention'
        : 'normal';

  let message;

  if (missing.length) {
    message =
      `Confira manualmente: ${missing.join(', ')} não enviou sinal do chaveiro.`;
  } else if (withoutKeychain.length) {
    message =
      `Confira manualmente seus objetos essenciais: ${withoutKeychain.join(', ')}.`;
  } else if (destination) {
    message =
      `Destino ${destination}: confira seus objetos.`;
  } else {
    message =
      'Você está saindo. Confira seus objetos.';
  }

  const eventMessage = planned.length
    ? `${message} Itens planejados: ${planned.join(', ')}.`
    : message;

  await db.execute(
    'INSERT INTO events(user_id,type,message) VALUES(?,?,?)',
    [
      q.user.id,
      'departure',
      eventMessage
    ]
  );

  r.json({
    level,
    message,
    destination,
    expected,
    missing,
    withoutKeychain,
    detected,
    checked: objects.filter(o => checkedIds.has(Number(o.id))).map(o => o.name),
    planned
  });
});

async function responderAssistente(usuario, mensagem) {
  const pergunta = String(mensagem || '').trim().toLocaleLowerCase('pt-BR');
  const [objetos] = await db.execute(
    `SELECT o.name,o.important,d.connected,d.ble_uuid
     FROM objects o LEFT JOIN devices d ON d.object_id=o.id AND d.user_id=o.user_id
     WHERE o.user_id=?`,
    [usuario]
  );
  const [planos] = await db.execute(
    `SELECT destination,COUNT(*) frequencia FROM routine_plans
     WHERE user_id=? AND planned_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY destination ORDER BY frequencia DESC LIMIT 3`,
    [usuario]
  );
  const essenciais = objetos.filter(item => item.important).map(item => item.name);
  const sinalFraco = objetos.filter(item => item.important && item.ble_uuid && !item.connected).map(item => item.name);
  const destino = pergunta.match(/(?:^|\s)(?:para|vou|indo para|destino|em|na|no|ao|à)\s+(?:(?:o|a|ao|à)\s+)?(.+?)[?!.]*$/i)?.[1];

  if (pergunta.includes('rotina') || pergunta.includes('costum')) {
    return planos.length
      ? `Pelos destinos que você escolheu salvar nos últimos 90 dias, você costuma planejar: ${planos.map(item => `${item.destination} (${item.frequencia} vezes)`).join(', ')}. Isso usa somente os planos registrados por você.`
      : 'Ainda não há destinos suficientes salvos para resumir sua rotina. No mapa, toque em “Salvar na rotina” depois de planejar uma saída.';
  }
  if (pergunta.includes('esquec') || pergunta.includes('falt')) {
    if (sinalFraco.length) return `Os chaveiros destes itens essenciais não estão enviando sinal agora: ${sinalFraco.join(', ')}. Confirme manualmente, pois a conexão Bluetooth não prova que o item está com você.`;
    return essenciais.length ? `Confira manualmente seus itens essenciais: ${essenciais.join(', ')}. Ainda não há um alerta confiável de esquecimento.` : 'Cadastre seus objetos e marque os essenciais para eu montar uma lista personalizada.';
  }
  if (pergunta.includes('essencial') || pergunta.includes('importante')) {
    return essenciais.length ? `Seus itens essenciais são: ${essenciais.join(', ')}.` : 'Você ainda não marcou objetos como essenciais. Faça isso na tela Meus objetos.';
  }
  if (pergunta.includes('levar') || pergunta.includes('destino') || destino) {
    const local = destino || planos[0]?.destination || '';
    const sugestoes = suggestions(local, objetos);
    return sugestoes.length ? `Para ${local || 'sua saída'}, confira: ${sugestoes.join(', ')}. Essas são sugestões gerais; ajuste a lista ao que você realmente precisa.` : `Não tenho sugestões específicas para “${local}” ainda. Confira seus itens essenciais e adicione outros pela lista de saída.`;
  }
  if (pergunta.includes('ajuda') || pergunta.includes('pode')) return 'Posso sugerir o que levar por destino, listar seus itens essenciais e resumir os destinos que você salvou. Experimente perguntar “O que levar para o trabalho?”';
  return `Entendi sua pergunta. Posso ajudar com seus ${objetos.length} objetos cadastrados, listas por destino e destinos salvos da sua rotina. Tente perguntar “O que conferir antes de sair?”`;
}

app.post('/assistant', auth, async (q, r) => {
  const mensagem = String(q.body.message || '').trim();
  if (!mensagem || mensagem.length > 500) return r.status(400).json({ error: 'Escreva uma mensagem de até 500 caracteres.' });
  r.json({ answer: await responderAssistente(q.user.id, mensagem) });
});

app.get('/assistant', auth, async (q, r) => {
  r.json({ answer: await responderAssistente(q.user.id, q.query.q) });
});

app.post('/exit-profiles', auth, async (q, r) => {
  const {
    destination,
    checklist
  } = q.body;

  const [x] = await db.execute(
    `
    INSERT INTO exit_profiles(
      user_id,
      destination,
      checklist_json
    )
    VALUES(?,?,?)
    `,
    [
      q.user.id,
      destination || null,
      JSON.stringify(checklist || [])
    ]
  );

  r.status(201).json({
    id: x.insertId
  });
});

app.get('/exit-profiles', auth, async (q, r) => {
  const [x] = await db.execute(
    `
    SELECT *
    FROM exit_profiles
    WHERE user_id=?
    ORDER BY id DESC
    LIMIT 30
    `,
    [q.user.id]
  );

  r.json(x);
});

app.get('/recommendations', auth, async (q, r) => {
  const objects = (
    await db.execute(
      'SELECT * FROM objects WHERE user_id=?',
      [q.user.id]
    )
  )[0];

  r.json({
    destination: q.query.destination || '',
    items: suggestions(
      q.query.destination,
      objects
    ),
    registeredItems: registeredSuggestions(q.query.destination, objects),
    allRegisteredItems: objects.map(object => ({
      id: object.id,
      name: object.name,
      category: object.category || 'Outros',
      essential: Boolean(object.important),
      image_data: object.image_data || null,
    }))
  });
});

app.get('/postal-codes/lookup', auth, async (q, r) => {
  const cep = String(q.query.cep || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) return r.status(400).json({ error: 'Digite um CEP com 8 números.' });
  const key = `viacep:${cep}`;
  const cached = cacheLugares.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('A consulta de CEP está temporariamente indisponível.');
    const data = await response.json();
    if (data.erro) return r.status(404).json({ error: 'Não encontrei esse CEP na base dos Correios.' });
    const resultado = {
      cep: data.cep,
      logradouro: data.logradouro || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
    };
    cacheLugares.set(key, { places: resultado, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(resultado);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível consultar esse CEP.' });
  }
});

app.get('/postal-codes/search', auth, async (q, r) => {
  const uf = String(q.query.uf || '').trim().toUpperCase();
  const cidade = String(q.query.city || '').trim();
  const logradouro = String(q.query.street || '').trim();
  if (!/^[A-Z]{2}$/.test(uf) || cidade.length < 3 || logradouro.length < 3 || cidade.length > 100 || logradouro.length > 120) {
    return r.status(400).json({ error: 'Informe UF, cidade e pelo menos 3 letras do logradouro para localizar o CEP.' });
  }
  const key = `viacep:${uf}:${cidade.toLocaleLowerCase('pt-BR')}:${logradouro.toLocaleLowerCase('pt-BR')}`;
  const cached = cacheLugares.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(logradouro)}/json/`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('A consulta de CEP por endereço está temporariamente indisponível.');
    const data = await response.json();
    const resultados = Array.isArray(data) ? data.slice(0, 8).map(item => ({
      cep: item.cep || '',
      logradouro: item.logradouro || logradouro,
      complemento: item.complemento || '',
      bairro: item.bairro || '',
      cidade: item.localidade || cidade,
      uf: item.uf || uf,
    })) : [];
    cacheLugares.set(key, { places: resultados, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(resultados);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível pesquisar o CEP deste endereço.' });
  }
});

app.get('/places/search', auth, async (q, r) => {
  const query = String(q.query.q || '').trim();
  if (query.length < 3 || query.length > 120) return r.status(400).json({ error: 'Digite um local com pelo menos 3 caracteres.' });
  const key = query.toLocaleLowerCase('pt-BR');
  const cached = cacheLugares.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const places = await (filaLugares = filaLugares.catch(() => {}).then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - ultimoPedidoDeMapa));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      ultimoPedidoDeMapa = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({
        q: query,
        countrycodes: 'br',
        viewbox: '-48.50,-15.35,-47.25,-16.20',
        format: 'jsonv2',
        limit: '5',
        addressdetails: '1'
      }).toString();
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
          'Referer': 'https://lembre-web.onrender.com/'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('Busca de locais temporariamente indisponível.');
      const data = await response.json();
      return data.map(item => formatarResultadoLugar(item));
    }));
    cacheLugares.set(key, { places, expires: Date.now() + 60 * 60 * 1000 });
    if (cacheLugares.size > 300) cacheLugares.delete(cacheLugares.keys().next().value);
    r.json(places);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível buscar esse local agora.' });
  }
});

app.get('/places/postal-code', auth, async (q, r) => {
  const cep = String(q.query.cep || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) return r.status(400).json({ error: 'Digite um CEP com 8 números.' });
  const key = `osm-postcode:${cep}`;
  const cached = cacheLugares.get(key);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const lugares = await (filaLugares = filaLugares.catch(() => {}).then(async () => {
      const wait = Math.max(0, 1100 - (Date.now() - ultimoPedidoDeMapa));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      ultimoPedidoDeMapa = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.search = new URLSearchParams({ postalcode: cep, country: 'Brazil', format: 'jsonv2', limit: '5', addressdetails: '1' }).toString();
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
          'Referer': 'https://lembre-web.onrender.com/'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('A busca deste CEP no mapa está temporariamente indisponível.');
      const data = await response.json();
      return data.map(item => formatarResultadoLugar(item, cep));
    }));
    cacheLugares.set(key, { places: lugares, expires: Date.now() + 24 * 60 * 60 * 1000 });
    r.json(lugares);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível localizar este CEP no mapa.' });
  }
});

app.get('/places/reverse', auth, async (q, r) => {
  const latitude = Number(q.query.lat);
  const longitude = Number(q.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return r.status(400).json({ error: 'As coordenadas selecionadas são inválidas.' });
  }

  const cacheKey = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cacheLugares.get(cacheKey);
  if (cached && cached.expires > Date.now()) return r.json(cached.places);

  try {
    const local = await (filaLugares = filaLugares.catch(() => {}).then(async () => {
      // A very detailed reverse lookup can miss points between mapped
      // buildings. Retry at broader scales, respecting Nominatim's 1 req/s rule.
      for (const zoom of [18, 16, 14]) {
        const wait = Math.max(0, 1100 - (Date.now() - ultimoPedidoDeMapa));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        ultimoPedidoDeMapa = Date.now();
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: String(zoom), addressdetails: '1' }).toString();
        const response = await fetch(url, {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)',
            'Referer': 'https://lembre-web.onrender.com/'
          },
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) {
          if (response.status === 404) continue;
          throw new Error('Busca de endereços temporariamente indisponível.');
        }
        const data = await response.json();
        if (!data.display_name) continue;
        return {
          ...formatarResultadoLugar(data),
          id: `coord:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
          latitude,
          longitude,
        };
      }
      throw new Error('Não encontrei um endereço próximo deste ponto. Tente marcar uma rua mais próxima.');
    }));
    cacheLugares.set(cacheKey, { places: local, expires: Date.now() + 60 * 60 * 1000 });
    r.json(local);
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não foi possível identificar este ponto agora.' });
  }
});

app.get('/', (_q, r, next) => {
  const index = path.join(diretorioWeb, 'index.html');
  if (!fs.existsSync(index)) return next();
  r.sendFile(index);
});

init()
  .then(() => {
    app.listen(
      +(process.env.PORT || 3000),
      '0.0.0.0',
      () => {
        console.log(
          'Lembriê API na porta ' +
          (process.env.PORT || 3000)
        );
      }
    );
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
