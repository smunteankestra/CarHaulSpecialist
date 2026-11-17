CREATE INDEX IF NOT EXISTS orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS orders_delivery_eta ON orders(delivery_eta);
CREATE INDEX IF NOT EXISTS order_events_kind_actor ON order_events(kind, actor, created_at);
