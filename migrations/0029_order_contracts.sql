CREATE TABLE IF NOT EXISTS order_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_contracts_order ON order_contracts(order_id);
