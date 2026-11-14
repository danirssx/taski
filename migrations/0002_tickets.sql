-- One installation owns one immutable project identity; bound on first use.
CREATE TABLE project_identity (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  project_id TEXT NOT NULL,
  prefix TEXT NOT NULL,
  epoch TEXT NOT NULL DEFAULT (lower(hex(randomblob(16))))
);

CREATE TABLE tickets (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  base_url TEXT NOT NULL,
  key TEXT GENERATED ALWAYS AS (prefix || '-' || printf('%03d', number)) STORED UNIQUE,
  url TEXT GENERATED ALWAYS AS (base_url || '/t/' || key) STORED,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 240),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 100000),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','in_review','done')),
  assignee_id TEXT,
  area_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('task','feedback')),
  highlighted INTEGER NOT NULL DEFAULT 0 CHECK (highlighted IN (0,1)),
  pr_url TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX tickets_status_updated ON tickets(status, updated_at, number);
CREATE INDEX tickets_assignee_status ON tickets(assignee_id, status, number);
CREATE INDEX tickets_type_number ON tickets(type, number);
CREATE INDEX tickets_area_number ON tickets(area_id, number);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  ticket_version INTEGER NOT NULL,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 20000),
  actor TEXT NOT NULL CHECK (json_valid(actor)),
  created_at TEXT NOT NULL
);
CREATE INDEX comments_ticket_time ON comments(ticket_id, ticket_version, id);

CREATE TABLE activity (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  ticket_version INTEGER NOT NULL,
  actor TEXT NOT NULL CHECK (json_valid(actor)),
  changes TEXT NOT NULL CHECK (json_valid(changes)),
  created_at TEXT NOT NULL,
  UNIQUE(ticket_id, ticket_version)
);
CREATE INDEX activity_ticket_sequence ON activity(ticket_id, seq);

CREATE TABLE mutation_receipts (
  actor_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  receipt TEXT CHECK (receipt IS NULL OR json_valid(receipt)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_id, operation, idempotency_key)
);

CREATE TRIGGER tickets_project_guard BEFORE INSERT ON tickets
WHEN NEW.prefix IS NOT (SELECT prefix FROM project_identity WHERE singleton=1)
BEGIN SELECT RAISE(ABORT, 'PROJECT_IDENTITY_CONFLICT'); END;

CREATE TRIGGER tickets_update_guard BEFORE UPDATE ON tickets
BEGIN
  SELECT CASE WHEN NEW.version != OLD.version + 1 THEN RAISE(ABORT, 'VERSION_CONFLICT') END;
  SELECT CASE WHEN NEW.id != OLD.id OR NEW.number != OLD.number OR NEW.prefix != OLD.prefix
    OR NEW.base_url != OLD.base_url OR NEW.created_at != OLD.created_at OR NEW.created_by != OLD.created_by
    THEN RAISE(ABORT, 'IMMUTABLE_IDENTITY') END;
END;
CREATE TRIGGER tickets_no_delete BEFORE DELETE ON tickets
BEGIN SELECT RAISE(ABORT, 'TICKET_DELETE_DISABLED'); END;
CREATE TRIGGER activity_no_update BEFORE UPDATE ON activity
BEGIN SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER activity_no_delete BEFORE DELETE ON activity
BEGIN SELECT RAISE(ABORT, 'AUDIT_APPEND_ONLY'); END;
CREATE TRIGGER comments_no_update BEFORE UPDATE ON comments
BEGIN SELECT RAISE(ABORT, 'COMMENT_APPEND_ONLY'); END;
CREATE TRIGGER comments_no_delete BEFORE DELETE ON comments
BEGIN SELECT RAISE(ABORT, 'COMMENT_APPEND_ONLY'); END;
