module.exports = db => async (q, r, next) => {
  const operação = String(q.headers['x-offline-operation-id'] || '');
  if (!/^[0-9a-f-]{36}$/i.test(operação) || !q.user?.id) return next();
  try {
    const [linhas] = await db.execute(
      'SELECT status_code,response_json FROM offline_sync_operations WHERE user_id=? AND operation_id=?',
      [q.user.id, operação]
    );
    if (linhas.length) {
      const corpo = typeof linhas[0].response_json === 'string' ? JSON.parse(linhas[0].response_json) : linhas[0].response_json;
      return r.status(linhas[0].status_code).json(corpo);
    }
  } catch (erro) {
    console.error('Não foi possível consultar a chave de sincronização offline:', erro.message);
    return next();
  }

  const responder = r.json.bind(r);
  r.json = corpo => {
    if (r.statusCode >= 400) return responder(corpo);
    db.execute(
      `INSERT INTO offline_sync_operations(user_id,operation_id,status_code,response_json)
       VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE operation_id=VALUES(operation_id)`,
      [q.user.id, operação, r.statusCode, JSON.stringify(corpo)]
    ).then(() => responder(corpo)).catch(erro => {
      console.error('Não foi possível salvar a chave de sincronização offline:', erro.message);
      responder(corpo);
    });
    return r;
  };
  next();
};
