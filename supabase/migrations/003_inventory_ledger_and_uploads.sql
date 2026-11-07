-- 003: stock movement ledger, validated image storage, product slug backfill.
-- Additive and idempotent.
CREATE TABLE IF NOT EXISTS stock_movements (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  order_id integer,
  note text,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id, created_at);

CREATE TABLE IF NOT EXISTS uploaded_images (
  id text PRIMARY KEY,
  content_type text NOT NULL,
  size integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  data bytea NOT NULL,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Products created before slugs were generated have slug = ''
UPDATE products
   SET slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || id
 WHERE slug = '';
