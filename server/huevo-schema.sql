CREATE TABLE IF NOT EXISTS huevo_wallets (
  owner TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance<=9007199254740991), revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS huevo_operations (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS huevo_operations_owner ON huevo_operations(owner,created);
CREATE TABLE IF NOT EXISTS huevo_deposits (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, amount INTEGER NOT NULL, intent TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', credited INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS huevo_withdrawals (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', receipt TEXT
);
CREATE TABLE IF NOT EXISTS huevo_hands (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS huevo_hands_owner ON huevo_hands(owner,closed);
-- Forces an entire D1 batch to roll back if a wallet/hand CAS changed zero rows.
CREATE TABLE IF NOT EXISTS huevo_write_guard (ok INTEGER NOT NULL CHECK(ok=1));
