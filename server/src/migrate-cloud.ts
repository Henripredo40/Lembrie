import 'dotenv/config';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '../.env.migrate') });

const tabelas = [
  { nome: 'users', chave: 'id' },
  { nome: 'objects', chave: 'id' },
  { nome: 'devices', chave: 'id' },
  { nome: 'events', chave: 'id' },
  { nome: 'settings', chave: 'user_id' },
  { nome: 'routines', chave: 'id' },
  { nome: 'routine_plans', chave: 'id' },
  { nome: 'exit_profiles', chave: 'id' },
];

async function main() {
  const destino = {
    host: process.env.TARGET_DB_HOST,
    port: Number(process.env.TARGET_DB_PORT || 4000),
    user: process.env.TARGET_DB_USER,
    password: process.env.TARGET_DB_PASSWORD,
    database: process.env.TARGET_DB_NAME,
    ssl: process.env.TARGET_DB_SSL === 'true'
      ? {
          minVersion: 'TLSv1.2' as const,
          ...(process.env.TARGET_DB_TLS_SERVERNAME ? { servername: process.env.TARGET_DB_TLS_SERVERNAME } : {}),
        }
      : undefined,
  };
  if (!destino.host || !destino.user || !destino.password || !destino.database) {
    throw new Error('Preencha as variáveis TARGET_DB_* em server/.env.migrate.');
  }

  const origem = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2' as const } } : {}),
    connectionLimit: 2,
  });
  const destinoPool = mysql.createPool({ ...destino, connectionLimit: 2 });

  try {
    await origem.query('SELECT 1');
    await destinoPool.query('SELECT 1');

    for (const tabela of tabelas) {
      const [[{ total }]] = await destinoPool.query(`SELECT COUNT(*) AS total FROM \`${tabela.nome}\``) as any;
      if (Number(total) !== 0) {
        throw new Error(`A tabela online ${tabela.nome} já contém dados. A migração foi interrompida sem alterar o banco.`);
      }
    }

    const conexaoDestino = await destinoPool.getConnection();
    try {
      await conexaoDestino.beginTransaction();
      for (const tabela of tabelas) {
        const [linhas] = await origem.query(`SELECT * FROM \`${tabela.nome}\` ORDER BY \`${tabela.chave}\``) as any;
        if (!linhas.length) {
          process.stdout.write(`${tabela.nome}: 0 registros\n`);
          continue;
        }
        const colunas = Object.keys(linhas[0]);
        const nomesColunas = colunas.map(coluna => `\`${coluna}\``).join(', ');
        const valores = `(${colunas.map(() => '?').join(', ')})`;
        const comando = `INSERT INTO \`${tabela.nome}\` (${nomesColunas}) VALUES ${linhas.map(() => valores).join(', ')}`;
        await conexaoDestino.query(comando, linhas.flatMap(linha => colunas.map(coluna => linha[coluna])));
        process.stdout.write(`${tabela.nome}: ${linhas.length} registros\n`);
      }
      await conexaoDestino.commit();
    } catch (falha) {
      await conexaoDestino.rollback();
      throw falha;
    } finally {
      conexaoDestino.release();
    }
    process.stdout.write('Migração concluída. Os códigos temporários de recuperação não foram copiados.\n');
  } finally {
    await Promise.all([origem.end(), destinoPool.end()]);
  }
}

main().catch(falha => {
  process.stderr.write((falha?.message || 'Falha ao migrar os dados.') + '\n');
  process.exitCode = 1;
});
