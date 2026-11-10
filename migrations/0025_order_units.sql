CREATE TABLE IF NOT EXISTS order_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vin TEXT,
  vehicle_type TEXT,
  condition TEXT,
  price INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_units_order ON order_units(order_id, position);
