import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const createAuth = require('../middleware/autenticacao');
const registrarRotasDaConta = require('./conta');
const registrarRotasDeObjetos = require('./objetos');
const registrarRotasDePlanejamento = require('./planejamento');
const registrarRotasDeLugares = require('./lugares');
const { sugerirItensDestino, sugestõesPorPerto, sugerirObjetosRelacionados } = require('../servicos/sugestoes');
const { formatarResultadoLugar, pontuarCorrespondenciaBusca } = require('../servicos/lugares');

function criarAppDeTeste(sobrescritas: { query?: (...argumentos: any[]) => unknown; execute?: (...argumentos: any[]) => unknown } = {}) {
  const app = express();
  app.use(express.json());
  const db = {
    query: sobrescritas.query || (async () => [[]]),
    execute: sobrescritas.execute || (async () => [[]]),
  };
  const secret = 'segredo-exclusivo-de-teste';
  const estadoDosMapas = { cache: new Map(), ultimoPedido: 0, fila: Promise.resolve() };
  const contexto = {
    app,
    auth: createAuth(secret),
    idempotenciaOffline: (_q: unknown, _r: unknown, next: () => void) => next(),
    db,
    bcrypt: { hash: async () => 'hash-de-teste', compare: async () => false },
    jwt,
    crypto,
    OAuth2Client: class {},
    secret,
    validarEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    resumirHash: (valor: string) => crypto.createHash('sha256').update(valor).digest('hex'),
    rotuloDispositivo: () => 'Dispositivo de teste',
    criarSessaoConta: async () => 'sessao-de-teste',
    emailConfigurado: () => false,
    enviarEmail: async () => {},
    sugerirItensDestino,
    sugestõesPorPerto,
    sugerirObjetosRelacionados,
    formatarResultadoLugar,
    pontuarCorrespondenciaBusca,
    estadoDosMapas,
  };
  registrarRotasDaConta(contexto);
  const servicosDePlanejamento = registrarRotasDePlanejamento(contexto);
  registrarRotasDeObjetos({ ...contexto, ...servicosDePlanejamento });
  registrarRotasDeLugares(contexto);
  return { app, db, token: jwt.sign({ id: 41 }, secret) };
}

describe('integração HTTP da API Express', () => {
  it('devolve estado saudável quando o banco responde', async () => {
    const { app } = criarAppDeTeste({ query: async () => [[{ ok: 1 }]] });
    const resposta = await request(app).get('/health');
    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, { ok: true, database: true });
  });

  it('devolve indisponibilidade quando o banco falha', async () => {
    const { app } = criarAppDeTeste({ query: async () => { throw new Error('banco indisponível'); } });
    const resposta = await request(app).get('/health');
    assert.equal(resposta.status, 503);
    assert.deepEqual(resposta.body, { ok: false, database: false });
  });

  it('protege rotas autenticadas em cada área da API', async () => {
    const { app } = criarAppDeTeste();
    const rotas = [
      ['get', '/me'], ['get', '/me/security'], ['post', '/sessions/location'], ['post', '/sessions/start'],
      ['post', '/sessions/heartbeat'], ['post', '/sessions/end'], ['post', '/me/email-verification/send'],
      ['patch', '/me'], ['post', '/auth/change-password'], ['get', '/postal-codes/lookup'],
      ['get', '/postal-codes/search'], ['get', '/places/search?q=escola'], ['get', '/places/postal-code'],
      ['get', '/places/reverse'], ['get', '/places/nearby'], ['get', '/objects'], ['post', '/objects'],
      ['patch', '/objects/1'], ['delete', '/objects/1'], ['post', '/devices/heartbeat'], ['post', '/devices/locate'],
      ['get', '/events'], ['post', '/events'], ['get', '/settings'], ['patch', '/settings'],
      ['get', '/routine/plans'], ['post', '/routine/location'], ['post', '/routine/plans'],
      ['post', '/departure/check'], ['get', '/assistant/status'], ['post', '/assistant'], ['get', '/assistant'],
      ['post', '/exit-profiles'], ['get', '/exit-profiles'], ['get', '/recommendations'], ['post', '/recommendations/ai'],
    ] as const;
    for (const [metodo, caminho] of rotas) {
      const resposta = await request(app)[metodo](caminho);
      assert.equal(resposta.status, 401, `${metodo.toUpperCase()} ${caminho} deve exigir autenticação`);
    }
  });

  it('rejeita cadastro incompleto antes de acessar o banco', async () => {
    let consultouBanco = false;
    const { app } = criarAppDeTeste({ execute: async () => { consultouBanco = true; return [[]]; } });
    const resposta = await request(app).post('/auth/register').send({ name: '', email: 'email-invalido', password: '123' });
    assert.equal(resposta.status, 400);
    assert.equal(consultouBanco, false);
  });

  it('lista objetos do usuário autenticado', async () => {
    const objetos = [{ id: 3, name: 'Chaves', essential: 1 }];
    const { app, token } = criarAppDeTeste({ execute: async () => [objetos] });
    const resposta = await request(app).get('/objects').set('Authorization', `Bearer ${token}`);
    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, objetos);
  });

  it('rejeita objeto sem nome e evita gravar dados inválidos', async () => {
    let executouSql = false;
    const { app, token } = criarAppDeTeste({ execute: async () => { executouSql = true; return [[]]; } });
    const resposta = await request(app).post('/objects').set('Authorization', `Bearer ${token}`).send({ category: 'Chaves' });
    assert.equal(resposta.status, 400);
    assert.equal(executouSql, false);
  });

  it('valida a consulta de locais antes de chamar o provedor externo', async () => {
    const { app, token } = criarAppDeTeste();
    const resposta = await request(app).get('/places/search?q=ab').set('Authorization', `Bearer ${token}`);
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.error, /pelo menos 3 caracteres/i);
  });

  it('valida mensagens vazias no assistente', async () => {
    const { app, token } = criarAppDeTeste();
    const resposta = await request(app).post('/assistant').set('Authorization', `Bearer ${token}`).send({ message: '  ' });
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.error, /Escreva uma mensagem/i);
  });

  it('informa o estado do provedor do assistente', async () => {
    const { app, token } = criarAppDeTeste();
    const resposta = await request(app).get('/assistant/status').set('Authorization', `Bearer ${token}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.provider, 'Gemini');
    assert.equal(typeof resposta.body.enabled, 'boolean');
  });
});
