-- 004: customer accounts. Additive and idempotent. Guest checkout is unaffected.
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL,
  address text, city text, state text, pincode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
