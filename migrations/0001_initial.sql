PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS jail_state (
  source TEXT NOT NULL,
  jail TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  collected_at INTEGER NOT NULL,
  currently_banned INTEGER NOT NULL CHECK(currently_banned >= 0),
  total_banned INTEGER NOT NULL CHECK(total_banned >= 0),
  public_ip_count INTEGER NOT NULL CHECK(public_ip_count >= 0),
  write_token TEXT NOT NULL,
  PRIMARY KEY(source, jail)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS ip_observations (
  source TEXT NOT NULL,
  jail TEXT NOT NULL,
  ip TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  country TEXT,
  asn INTEGER,
  organization TEXT,
  network TEXT,
  PRIMARY KEY(source, jail, ip),
  FOREIGN KEY(source, jail) REFERENCES jail_state(source, jail)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_ip_lookup ON ip_observations(ip, source, jail);
CREATE INDEX IF NOT EXISTS idx_active_bans ON ip_observations(active, ip, source, jail);
CREATE INDEX IF NOT EXISTS idx_country ON ip_observations(country, active, ip);
CREATE INDEX IF NOT EXISTS idx_asn ON ip_observations(asn, active, ip);
