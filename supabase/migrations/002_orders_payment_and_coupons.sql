-- 002: Payment linkage + server-side coupon discount on orders.
-- Additive and idempotent: safe to run more than once, drops nothing.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
CREATE INDEX IF NOT EXISTS orders_razorpay_order_id_idx ON orders (razorpay_order_id);
