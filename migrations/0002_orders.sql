CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  lead_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  transport_type TEXT NOT NULL,
  condition TEXT NOT NULL,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vin TEXT,
  origin_street TEXT,
  origin_city TEXT,
  origin_state TEXT,
  origin_zip TEXT NOT NULL,
  origin_contact TEXT,
  origin_phone TEXT,
  dest_street TEXT,
  dest_city TEXT,
  dest_state TEXT,
  dest_zip TEXT NOT NULL,
  dest_contact TEXT,
  dest_phone TEXT,
  ready_date TEXT,
  distance_miles INTEGER,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  carrier_name TEXT,
  carrier_mc TEXT,
  carrier_phone TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_status ON orders(status, id DESC);
CREATE INDEX IF NOT EXISTS orders_token ON orders(token);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  actor TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_events_order ON order_events(order_id, id);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT 'Vehicle transport',
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at INTEGER NOT NULL,
  due_at INTEGER,
  paid_at INTEGER,
  note TEXT
);

CREATE INDEX IF NOT EXISTS invoices_order ON invoices(order_id, id DESC);
