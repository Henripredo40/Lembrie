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
const db = require('./config/banco');
const createAuth = require('./middleware/autenticacao');
const createOfflineIdempotency = require('./middleware/idempotenciaOffline');
const initializeDatabase = require('./config/iniciarBanco');

const app = express();

const registerAccountRoutes = require('./rotas/conta');
const registerInventoryRoutes = require('./rotas/objetos');
const registerPlanningRoutes = require('./rotas/planejamento');
const registerPlacesRoutes = require('./rotas/lugares');


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
const idempotenciaOffline = createOfflineIdempotency(db);
const estadoDosMapas = { cache: new Map(), ultimoPedido: 0, fila: Promise.resolve() };

const validarEmail = valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
const resumirHash = valor => crypto.createHash('sha256').update(valor).digest('hex');
const rotuloDispositivo = valor => {
  const rotulo = String(valor || '').replace(/[<>\r\n]/g, '').trim().slice(0, 120);
  return rotulo || 'Dispositivo não identificado';
};
async function criarSessaoConta(userId, deviceLabel) {
  const sessionId = crypto.randomUUID();
  await db.execute('INSERT INTO account_sessions(id,user_id,device_label) VALUES(?,?,?)', [sessionId, userId, rotuloDispositivo(deviceLabel)]);
  return sessionId;
}
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

const { suggestions, sugestõesPorPerto, registeredSuggestions } = require('./servicos/sugestoes');

const { formatarResultadoLugar, pontuarCorrespondenciaBusca } = require('./servicos/lugares');

const contextoDasRotas = { app, auth, idempotenciaOffline, db, bcrypt, jwt, crypto, OAuth2Client, secret, validarEmail, resumirHash, rotuloDispositivo, criarSessaoConta, emailConfigurado, enviarEmail, suggestions, sugestõesPorPerto, registeredSuggestions, formatarResultadoLugar, pontuarCorrespondenciaBusca, estadoDosMapas };
registerAccountRoutes(contextoDasRotas);
const { gerarSugestoesGemini } = registerPlanningRoutes(contextoDasRotas);
registerInventoryRoutes({ ...contextoDasRotas, gerarSugestoesGemini });
registerPlacesRoutes(contextoDasRotas);

app.get('/', (_q, r, next) => {
  const index = path.join(diretorioWeb, 'index.html');
  if (!fs.existsSync(index)) return next();
  r.sendFile(index);
});

initializeDatabase(db)
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
