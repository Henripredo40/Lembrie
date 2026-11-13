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
const registrarRotasDeObjetos = require('../rotas/objetos');

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

  test('rotas reais de objetos, eventos e configurações persistem no banco e permitem rollback', async () => {
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
      const [tabelas] = await connection.query(
        `SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('objects','devices','events','settings','offline_sync_operations')`
      );
      const engines = new Map(tabelas.map(item => [item.TABLE_NAME, String(item.ENGINE).toLowerCase()]));
      for (const tabela of ['objects', 'devices', 'events', 'settings', 'offline_sync_operations']) {
        assert.equal(engines.get(tabela), 'innodb', `${tabela} precisa aceitar rollback transacional`);
      }

      const [usuarios] = await connection.query('SELECT id FROM users LIMIT 1');
      assert.ok(usuarios.length, 'o banco precisa ter um usuário para validar as chaves estrangeiras');
      const userId = usuarios[0].id;
      await connection.beginTransaction();
      transacaoAberta = true;

      const [configuracoesExistentes] = await connection.execute(
        'SELECT user_id FROM settings WHERE user_id=? FOR UPDATE',
        [userId]
      );
      if (!configuracoesExistentes.length) {
        await connection.execute('INSERT INTO settings(user_id) VALUES(?)', [userId]);
      }

      const segredo = crypto.randomBytes(32).toString('hex');
      const db = {
        execute: (...argumentos) => connection.execute(...argumentos),
        getConnection: async () => ({
          beginTransaction: () => connection.query('SAVEPOINT real_db_route_transaction'),
          execute: (...argumentos) => connection.execute(...argumentos),
          commit: () => connection.query('RELEASE SAVEPOINT real_db_route_transaction'),
          rollback: async () => {
            await connection.query('ROLLBACK TO SAVEPOINT real_db_route_transaction');
            await connection.query('RELEASE SAVEPOINT real_db_route_transaction');
          },
          release: () => {},
        }),
      };
      const app = express();
      app.use(express.json());
      registrarRotasDeObjetos({
        app,
        auth: createAuth(segredo),
        idempotenciaOffline: createIdempotency(db),
        db,
        crypto,
        sugerirItensDestino: () => [],
        sugerirObjetosRelacionados: () => [],
        formatarResultadoLugar: () => ({}),
        estadoDosMapas: { cache: new Map(), ultimoPedido: 0, fila: Promise.resolve() },
        gerarSugestoesGemini: async () => ({ items: [], objetosRelacionados: [] }),
      });

      const token = jwt.sign({ id: userId }, segredo);
      const operationIds = [];
      const requestWithAuth = (requestBuilder, operationId) => {
        operationIds.push(operationId);
        return requestBuilder
          .set('Authorization', `Bearer ${token}`)
          .set('X-Offline-Operation-Id', operationId);
      };
      const nomeObjeto = `Teste real ${crypto.randomUUID()}`;
      const nomeAtualizado = `${nomeObjeto} atualizado`;
      const mensagemEvento = `Evento de teste ${crypto.randomUUID()}`;

      const criado = await requestWithAuth(
        request(app).post('/objects'),
        crypto.randomUUID()
      ).send({ name: nomeObjeto, category: 'Teste', important: true });
      assert.equal(criado.status, 201);
      const objetoId = criado.body.id;
      assert.ok(objetoId);

      const listado = await request(app)
        .get('/objects')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(listado.status, 200);
      assert.ok(listado.body.some(item => String(item.id) === String(objetoId) && item.name === nomeObjeto));

      const atualizado = await requestWithAuth(
        request(app).patch(`/objects/${objetoId}`),
        crypto.randomUUID()
      ).send({ name: nomeAtualizado, category: 'Teste real', important: true });
      assert.equal(atualizado.status, 200);
      const aposAtualizacao = await connection.execute(
        'SELECT name,category,important FROM objects WHERE id=? AND user_id=?',
        [objetoId, userId]
      );
      assert.equal(aposAtualizacao[0][0].name, nomeAtualizado);
      assert.equal(aposAtualizacao[0][0].category, 'Teste real');
      assert.equal(Number(aposAtualizacao[0][0].important), 1);

      const evento = await requestWithAuth(
        request(app).post('/events'),
        crypto.randomUUID()
      ).send({ object_id: objetoId, type: 'quality-test', message: mensagemEvento, rssi: -50 });
      assert.equal(evento.status, 201);
      const eventos = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(eventos.status, 200);
      const eventoListagem = eventos.body.find(item => String(item.id) === String(evento.body.id));
      assert.equal(eventoListagem?.message, mensagemEvento);
      assert.equal(String(eventoListagem?.object_id), String(objetoId));
      assert.equal(eventoListagem?.object_name, nomeAtualizado);

      const configuracoesAntes = await request(app)
        .get('/settings')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(configuracoesAntes.status, 200);
      const notificacoesEsperadas = !Boolean(Number(configuracoesAntes.body.notifications));
      const configuracoesSalvas = await requestWithAuth(
        request(app).patch('/settings'),
        crypto.randomUUID()
      ).send({ notifications: notificacoesEsperadas, essential_only: true });
      assert.equal(configuracoesSalvas.status, 200);
      const configuracoesDepois = await request(app)
        .get('/settings')
        .set('Authorization', `Bearer ${token}`);
      assert.equal(configuracoesDepois.status, 200);
      assert.equal(Boolean(Number(configuracoesDepois.body.notifications)), notificacoesEsperadas);
      assert.equal(Boolean(Number(configuracoesDepois.body.essential_only)), true);

      const removido = await requestWithAuth(
        request(app).delete(`/objects/${objetoId}`),
        crypto.randomUUID()
      ).send({});
      assert.equal(removido.status, 200);
      const [objetoRemanescente] = await connection.execute(
        'SELECT id FROM objects WHERE id=? AND user_id=?',
        [objetoId, userId]
      );
      assert.equal(objetoRemanescente.length, 0);
      const [eventoAposExclusao] = await connection.execute('SELECT object_id FROM events WHERE id=?', [evento.body.id]);
      assert.equal(eventoAposExclusao.length, 1);
      assert.equal(eventoAposExclusao[0].object_id, null, 'a chave estrangeira preserva o evento sem o objeto removido');

      await connection.rollback();
      transacaoAberta = false;
      const [[objetoRevertido]] = await connection.execute(
        'SELECT COUNT(*) AS total FROM objects WHERE user_id=? AND name IN (?,?)',
        [userId, nomeObjeto, nomeAtualizado]
      );
      const [[eventoRevertido]] = await connection.execute(
        'SELECT COUNT(*) AS total FROM events WHERE user_id=? AND message=?',
        [userId, mensagemEvento]
      );
      const placeholders = operationIds.map(() => '?').join(',');
      const [[operacoesRevertidas]] = await connection.execute(
        `SELECT COUNT(*) AS total FROM offline_sync_operations WHERE user_id=? AND operation_id IN (${placeholders})`,
        [userId, ...operationIds]
      );
      assert.equal(Number(objetoRevertido.total), 0);
      assert.equal(Number(eventoRevertido.total), 0);
      assert.equal(Number(operacoesRevertidas.total), 0);
    } finally {
      if (transacaoAberta) await connection.rollback();
      connection.release();
      await pool.end();
    }
  });
}
