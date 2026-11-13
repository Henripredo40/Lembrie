const { strict: assert } = require('node:assert');
const { test } = require('node:test');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const createAuth = require('./autenticacao');
const createIdempotency = require('./idempotenciaOffline');

if (process.env.RUN_REAL_DB_TESTS === 'true') {
  test('middleware real repete a resposta sem duplicar escrita e reverte a transação', async () => {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.migrate') });
    const pool = mysql.createPool({
      host: process.env.TARGET_DB_HOST,
      port: Number(process.env.TARGET_DB_PORT || 4000),
      user: process.env.TARGET_DB_USER,
      password: process.env.TARGET_DB_PASSWORD,
      database: process.env.TARGET_DB_NAME,
      ssl: process.env.TARGET_DB_SSL === 'true'
        ? {
            minVersion: 'TLSv1.2',
            ...(process.env.TARGET_DB_TLS_SERVERNAME
              ? { servername: process.env.TARGET_DB_TLS_SERVERNAME }
              : {}),
          }
        : undefined,
      connectionLimit: 1,
    });

    const connection = await pool.getConnection();
    let transacaoAberta = false;
    try {
      const [[tabela]] = await connection.query(
        "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offline_sync_operations'"
      );
      assert.equal(String(tabela?.ENGINE).toLowerCase(), 'innodb', 'a tabela precisa aceitar rollback transacional');
      const [usuarios] = await connection.query('SELECT id FROM users LIMIT 1');
      assert.ok(usuarios.length, 'o banco precisa ter um usuário para validar a chave estrangeira');

      await connection.beginTransaction();
      transacaoAberta = true;
      let chamadasDaRota = 0;
      const segredo = crypto.randomBytes(32).toString('hex');
      const app = express();
      app.use(express.json());
      const db = { execute: (...argumentos) => connection.execute(...argumentos) };
      app.post('/middleware-real-db', createAuth(segredo), createIdempotency(db), (_req, res) => {
        chamadasDaRota += 1;
        res.status(201).json({ ok: true, fixture: 'temporário' });
      });

      const token = jwt.sign({ id: usuarios[0].id }, segredo);
      const operationId = crypto.randomUUID();
      const semToken = await request(app).post('/middleware-real-db').send({});
      const primeira = await request(app)
        .post('/middleware-real-db')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Offline-Operation-Id', operationId)
        .send({});
      const repetida = await request(app)
        .post('/middleware-real-db')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Offline-Operation-Id', operationId)
        .send({});
      const [gravadas] = await connection.execute(
        'SELECT status_code,response_json FROM offline_sync_operations WHERE user_id=? AND operation_id=?',
        [usuarios[0].id, operationId]
      );

      assert.equal(semToken.status, 401);
      assert.equal(primeira.status, 201);
      assert.equal(repetida.status, 201);
      assert.deepEqual(repetida.body, primeira.body);
      assert.equal(chamadasDaRota, 1, 'a segunda requisição deve reutilizar a resposta salva');
      assert.equal(gravadas.length, 1);

      await connection.rollback();
      transacaoAberta = false;
      const [restantes] = await connection.execute(
        'SELECT COUNT(*) AS total FROM offline_sync_operations WHERE user_id=? AND operation_id=?',
        [usuarios[0].id, operationId]
      );
      assert.equal(Number(restantes[0].total), 0, 'o registro de teste deve desaparecer após o rollback');
    } finally {
      if (transacaoAberta) await connection.rollback();
      connection.release();
      await pool.end();
    }
  });
}
