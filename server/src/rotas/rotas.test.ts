import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

const registerAccountRoutes = require('./conta');
const registerInventoryRoutes = require('./objetos');
const registerPlanningRoutes = require('./planejamento');
const registerPlacesRoutes = require('./lugares');

function createRouteHarness() {
  const routes = new Map<string, (...args: any[]) => unknown>();
  const app = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map(method => [method, (path: string, ...handlers: Array<(...args: any[]) => unknown>) => {
    routes.set(`${method.toUpperCase()} ${path}`, handlers[handlers.length - 1]);
  }]));
  const context = {
    app,
    auth: (_request: unknown, _response: unknown, next: () => void) => next(),
    db: { query: async () => [[]], execute: async () => [[]] },
    bcrypt: {}, jwt: {}, crypto: require('node:crypto'), OAuth2Client: class {},
    secret: 'test-secret', validarEmail: () => true, resumirHash: () => 'hash',
    rotuloDispositivo: () => 'Teste', criarSessaoConta: async () => 'session',
    emailConfigurado: () => false, enviarEmail: async () => {}, suggestions: () => [],
    sugestõesPorPerto: () => [], registeredSuggestions: () => [],
    formatarResultadoLugar: () => ({}), pontuarCorrespondenciaBusca: () => ({}),
    estadoDosMapas: { cache: new Map(), ultimoPedido: 0, fila: Promise.resolve() },
    gerarSugestoesGemini: async () => ({ items: [], registeredItems: [] }),
  };
  return { routes, context };
}

describe('módulos de rotas da API', () => {
  it('registra endpoints separados por domínio', () => {
    const { routes, context } = createRouteHarness();
    registerAccountRoutes(context);
    const serviçosDePlanejamento = registerPlanningRoutes(context);
    registerInventoryRoutes({ ...context, ...serviçosDePlanejamento });
    registerPlacesRoutes(context);

    for (const endpoint of [
      'GET /health', 'POST /auth/register', 'GET /me',
      'GET /objects', 'POST /objects', 'GET /events',
      'POST /departure/check', 'POST /assistant', 'GET /recommendations',
      'GET /places/search', 'GET /places/reverse', 'GET /places/nearby',
    ]) assert.ok(routes.has(endpoint), `Rota não registrada: ${endpoint}`);
  });

  it('responde que a API está saudável quando o banco responde', async () => {
    const { routes, context } = createRouteHarness();
    registerAccountRoutes(context);
    let código = 200;
    let corpo: unknown;
    const resposta = {
      status(valor: number) { código = valor; return this; },
      json(valor: unknown) { corpo = valor; return this; },
    };

    await routes.get('GET /health')?.({}, resposta);
    assert.equal(código, 200);
    assert.deepEqual(corpo, { ok: true, database: true });
  });
});
