CREATE DATABASE IF NOT EXISTS chaveiro_antiperda CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chaveiro_antiperda;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS account_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  device_label VARCHAR(120) NOT NULL DEFAULT 'Dispositivo não identificado',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  active_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_account_sessions_user_started(user_id, started_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS objects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(80) DEFAULT 'Outros',
  important BOOLEAN DEFAULT FALSE,
  image_data LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  object_id BIGINT NOT NULL,
  ble_uuid VARCHAR(100) NOT NULL,
  connected BOOLEAN DEFAULT FALSE,
  last_seen_at DATETIME NULL,
  last_rssi INT NULL,
  battery_percent INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_ble (user_id, ble_uuid)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  object_id BIGINT NULL,
  type VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  rssi INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id BIGINT PRIMARY KEY,
  notifications BOOLEAN DEFAULT TRUE,
  routine_enabled BOOLEAN DEFAULT FALSE,
  routine_consent_at DATETIME NULL,
  preventive_alerts BOOLEAN DEFAULT TRUE,
  essential_only BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exit_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  destination VARCHAR(180) NULL,
  checklist_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routines (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  day_of_week TINYINT NOT NULL,
  routine_time CHAR(5) NOT NULL,
  destination VARCHAR(180) NULL,
  object_ids_json JSON NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  destination VARCHAR(180) NOT NULL,
  planned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_routine_user_date (user_id, planned_at)
);

CREATE TABLE IF NOT EXISTS routine_location_visits (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  destination VARCHAR(180) NOT NULL,
  destination_hash CHAR(64) NOT NULL,
  visit_count INT NOT NULL DEFAULT 1,
  first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_suggested_at DATETIME NULL,
  UNIQUE KEY uq_location_visit (user_id, destination_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_reset_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS email_change_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  email VARCHAR(254) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_email_change_user (user_id, created_at),
  INDEX ix_email_change_email (email)
);

CREATE TABLE IF NOT EXISTS google_password_reset_uses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX ix_google_reset_user (user_id, created_at)
);
