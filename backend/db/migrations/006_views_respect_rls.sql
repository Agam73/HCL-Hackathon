-- Views normally run with their owner's rights, which would let the hosted
-- REST API read through them despite row level security on the tables.
-- security_invoker makes each view obey the caller's own permissions.
ALTER VIEW v_product_availability SET (security_invoker = true);
ALTER VIEW v_product_catalog      SET (security_invoker = true);
ALTER VIEW v_low_stock            SET (security_invoker = true);
