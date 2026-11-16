-- 005: visitor tracking for the admin "Visitors" page. Additive and idempotent.
-- (The API server also runs this on startup, so applying it manually is optional.)
CREATE TABLE IF NOT EXISTS site_visits (
  id bigserial PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  referrer_host text,
  source text NOT NULL DEFAULT 'direct',
  country text, region text, city text,
  device text, browser text, os text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON site_visits (visitor_id);
