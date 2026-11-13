-- Local runtime readiness only. Ticket schema belongs to B3.
CREATE TABLE taski_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bootstrap_version INTEGER NOT NULL CHECK (bootstrap_version > 0)
);

INSERT INTO taski_bootstrap (id, bootstrap_version) VALUES (1, 1);
