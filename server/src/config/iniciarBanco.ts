const fs = require('fs');
const path = require('path');

module.exports = async function initializeDatabase(db) {
  const caminhoSchema = path.resolve(__dirname, '../../sql/schema.sql');
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
  await db.execute(`CREATE TABLE IF NOT EXISTS account_sessions(
    id CHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    device_label VARCHAR(120) NOT NULL DEFAULT 'Dispositivo não identificado',
    location_label VARCHAR(180) NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    active_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_account_sessions_user_started(user_id, started_at),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await ensureColumn('account_sessions', 'location_label', 'VARCHAR(180) NULL');
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS routine_location_visits(
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      destination VARCHAR(180) NOT NULL,
      destination_hash CHAR(64) NOT NULL,
      visit_count INT NOT NULL DEFAULT 1,
      first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_suggested_at DATETIME NULL,
      UNIQUE KEY uq_location_visit(user_id,destination_hash),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.execute('DELETE FROM routine_location_visits WHERE last_seen < DATE_SUB(NOW(),INTERVAL 90 DAY)');
  const limpezaLocais = setInterval(() => {
    db.execute('DELETE FROM routine_location_visits WHERE last_seen < DATE_SUB(NOW(),INTERVAL 90 DAY)').catch(() => {});
  }, 24 * 60 * 60 * 1000);
  limpezaLocais.unref?.();

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS offline_sync_operations(
      user_id BIGINT NOT NULL,
      operation_id CHAR(36) NOT NULL,
      status_code SMALLINT NOT NULL,
      response_json JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, operation_id),
      INDEX ix_offline_sync_created(created_at),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

};
