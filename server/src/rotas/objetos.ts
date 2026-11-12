module.exports = function registerInventoryRoutes({ app, auth, idempotenciaOffline, db, crypto, suggestions, registeredSuggestions, formatarResultadoLugar, estadoDosMapas, gerarSugestoesGemini }) {
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

app.post('/objects', auth, idempotenciaOffline, async (q, r) => {
  try {
    const {
      name,
      category,
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

app.patch('/objects/:id', auth, idempotenciaOffline, async (q, r) => {
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

app.delete('/objects/:id', auth, idempotenciaOffline, async (q, r) => {
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

app.post('/events', auth, idempotenciaOffline, async (q, r) => {
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

  const [evento] = await db.execute(
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

  r.status(201).json({ ok: true, id: evento.insertId });
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

app.patch('/settings', auth, idempotenciaOffline, async (q, r) => {
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

const ultimaLeituraGPS = new Map();
app.post('/routine/location', auth, async (q, r) => {
  const latitude = Number(q.body.latitude);
  const longitude = Number(q.body.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return r.status(400).json({ error: 'A posição recebida é inválida.' });
  }
  const agora = Date.now();
  if (agora - (ultimaLeituraGPS.get(String(q.user.id)) || 0) < 4 * 60 * 1000) return r.json({ skipped: true });
  ultimaLeituraGPS.set(String(q.user.id), agora);
  try {
    const local = await (estadoDosMapas.fila = estadoDosMapas.fila.catch(() => {}).then(async () => {
      const espera = Math.max(0, 1100 - (Date.now() - estadoDosMapas.ultimoPedido));
      if (espera) await new Promise(resolve => setTimeout(resolve, espera));
      estadoDosMapas.ultimoPedido = Date.now();
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', zoom: '16', addressdetails: '1' }).toString();
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'LembrieApp/1.0 (+https://lembre-web.onrender.com/)', 'Referer': 'https://lembre-web.onrender.com/' },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Não consegui identificar o local agora.');
      return response.json();
    }));
    if (!local.display_name) return r.json({ skipped: true });
    const dados = formatarResultadoLugar(local);
    const destination = [dados.logradouro, dados.bairro, dados.cidade].filter((item, index, lista) => item && lista.indexOf(item) === index).join(', ').slice(0, 180) || dados.nome;
    const destinationHash = crypto.createHash('sha256').update(destination.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')).digest('hex');
    await db.execute('DELETE FROM routine_location_visits WHERE user_id=? AND last_seen < DATE_SUB(NOW(),INTERVAL 90 DAY)', [q.user.id]);
    const [existente] = await db.execute('SELECT id,last_suggested_at,visit_count FROM routine_location_visits WHERE user_id=? AND destination_hash=?', [q.user.id, destinationHash]);
    const jaSugerido = existente[0]?.last_suggested_at && Date.now() - new Date(existente[0].last_suggested_at).getTime() < 24 * 60 * 60 * 1000;
    await db.execute(
      `INSERT INTO routine_location_visits(user_id,destination,destination_hash) VALUES(?,?,?)
       ON DUPLICATE KEY UPDATE
       visit_count=IF(last_seen < DATE_SUB(NOW(),INTERVAL 6 HOUR),visit_count+1,visit_count),
       destination=VALUES(destination),
       last_seen=IF(last_seen < DATE_SUB(NOW(),INTERVAL 6 HOUR),NOW(),last_seen)`,
      [q.user.id, destination, destinationHash]
    );
    if (jaSugerido) return r.json({ destination, items: [], ai: false, repeated: true });
    const objects = (await db.execute('SELECT name,category,important FROM objects WHERE user_id=? ORDER BY important DESC,name LIMIT 80', [q.user.id]))[0];
    let registeredItems = registeredSuggestions(destination, objects).map(item => item.name);
    const nomesCadastrados = new Set(objects.map(item => String(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()));
    let items = [...new Set(suggestions(destination, objects))].filter(item => !nomesCadastrados.has(String(item).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim())).slice(0, 8);
    let ai = false;
    if (String(process.env.GEMINI_API_KEY || '').trim()) {
      try { const sugestões = await gerarSugestoesGemini(destination, objects); items = sugestões.items; registeredItems = sugestões.registeredItems; ai = true; }
      catch (error) { console.error('Sugestão GPS Gemini indisponível:', error.message); }
    }
    await db.execute('UPDATE routine_location_visits SET last_suggested_at=NOW() WHERE user_id=? AND destination_hash=?', [q.user.id, destinationHash]);
    r.json({ destination, items, registeredItems, ai, repeated: false });
  } catch (error) {
    r.status(502).json({ error: error.message || 'Não consegui analisar o local detectado.' });
  }
});

app.post('/routine/plans', auth, idempotenciaOffline, async (q, r) => {
  const destination = String(q.body.destination || '').trim();
  if (destination.length < 2 || destination.length > 180) return r.status(400).json({ error: 'Informe um destino entre 2 e 180 caracteres.' });
  const [setting] = await db.execute('SELECT routine_enabled FROM settings WHERE user_id=?', [q.user.id]);
  if (!setting[0] || !setting[0].routine_enabled) return r.status(403).json({ error: 'Ative o reconhecimento opcional de rotina nas configurações para salvar destinos.' });
  const [plano] = await db.execute('INSERT INTO routine_plans(user_id,destination) VALUES(?,?)', [q.user.id, destination]);
  r.status(201).json({ ok: true, id: plano.insertId });
});


};
