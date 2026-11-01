CREATE INDEX IF NOT EXISTS idx_observations_first_seen ON ip_observations(first_seen, ip, source, jail);
CREATE INDEX IF NOT EXISTS idx_observations_last_seen ON ip_observations(last_seen, ip, source, jail);
CREATE INDEX IF NOT EXISTS idx_observations_organization ON ip_observations(organization, ip, source, jail);
CREATE INDEX IF NOT EXISTS idx_observations_active_last_seen ON ip_observations(active, last_seen, ip, source, jail);
