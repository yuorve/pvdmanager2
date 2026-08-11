-- Migration number: 0000 	 2026-08-11T00:00:00.000Z

CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    addressIP TEXT NOT NULL UNIQUE,
    userID TEXT,
    stateID INTEGER DEFAULT 0,
    timer TEXT DEFAULT '00:00:00',
    timeSTAMP DATETIME DEFAULT CURRENT_TIMESTAMP,
    KeepAlive DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    state_from INTEGER,
    state_to INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operator ON operator_activity (operator_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON operator_activity (created_at);

CREATE TABLE IF NOT EXISTS pvd_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id TEXT NOT NULL,
    date TEXT NOT NULL,
    window_hour INTEGER NOT NULL,
    start_minute INTEGER NOT NULL,
    UNIQUE(operator_id, date, window_hour)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('OPERATOR', 'SUPERVISOR')) DEFAULT 'OPERATOR',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
