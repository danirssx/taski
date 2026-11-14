CREATE TABLE team_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  code_fingerprint TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX team_sessions_expiry ON team_sessions(expires_at);
CREATE TABLE access_attempts (
  bucket TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
