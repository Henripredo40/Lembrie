module.exports = function registrarRotasDePerimetros({ app, auth, db }) {
  function validarPerimetro(body) {
    const nome = String(body.nome || '').trim();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const raio = Number(body.raio_m);

    if (!nome || nome.length > 120) return { erro: 'Informe um nome com até 120 caracteres.' };
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { erro: 'Latitude inválida.' };
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { erro: 'Longitude inválida.' };
    if (!Number.isInteger(raio) || raio < 25 || raio > 5000) return { erro: 'O raio deve estar entre 25 e 5000 metros.' };

    return { nome, latitude, longitude, raio };
  }

  function formatarPerimetro(perimetro) {
    return {
      ...perimetro,
      latitude: Number(perimetro.latitude),
      longitude: Number(perimetro.longitude),
      raio_m: Number(perimetro.raio_m),
    };
  }

  app.get('/perimeters', auth, async (q, r) => {
    const [linhas] = await db.execute(
      'SELECT id,nome,latitude,longitude,raio_m,created_at,updated_at FROM saved_perimeters WHERE user_id=? ORDER BY updated_at DESC,id DESC',
      [q.user.id]
    );
    r.json(linhas.map(formatarPerimetro));
  });

  app.post('/perimeters', auth, async (q, r) => {
    const perimetro = validarPerimetro(q.body || {});
    if (perimetro.erro) return r.status(400).json({ error: perimetro.erro });

    const [resultado] = await db.execute(
      'INSERT INTO saved_perimeters(user_id,nome,latitude,longitude,raio_m) VALUES(?,?,?,?,?)',
      [q.user.id, perimetro.nome, perimetro.latitude, perimetro.longitude, perimetro.raio]
    );
    const [linhas] = await db.execute(
      'SELECT id,nome,latitude,longitude,raio_m,created_at,updated_at FROM saved_perimeters WHERE id=? AND user_id=?',
      [resultado.insertId, q.user.id]
    );
    r.status(201).json(formatarPerimetro(linhas[0]));
  });

  app.patch('/perimeters/:id', auth, async (q, r) => {
    const perimetro = validarPerimetro(q.body || {});
    if (perimetro.erro) return r.status(400).json({ error: perimetro.erro });

    const [existentes] = await db.execute(
      'SELECT id FROM saved_perimeters WHERE id=? AND user_id=?',
      [q.params.id, q.user.id]
    );
    if (!existentes.length) return r.status(404).json({ error: 'Perímetro não encontrado.' });

    await db.execute(
      'UPDATE saved_perimeters SET nome=?,latitude=?,longitude=?,raio_m=? WHERE id=? AND user_id=?',
      [perimetro.nome, perimetro.latitude, perimetro.longitude, perimetro.raio, q.params.id, q.user.id]
    );

    const [linhas] = await db.execute(
      'SELECT id,nome,latitude,longitude,raio_m,created_at,updated_at FROM saved_perimeters WHERE id=? AND user_id=?',
      [q.params.id, q.user.id]
    );
    r.json(formatarPerimetro(linhas[0]));
  });

  app.delete('/perimeters/:id', auth, async (q, r) => {
    const [resultado] = await db.execute(
      'DELETE FROM saved_perimeters WHERE id=? AND user_id=?',
      [q.params.id, q.user.id]
    );
    if (!resultado.affectedRows) return r.status(404).json({ error: 'Perímetro não encontrado.' });
    r.json({ ok: true });
  });
};
