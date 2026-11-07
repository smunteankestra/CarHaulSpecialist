CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  origin_zip TEXT NOT NULL,
  origin_city TEXT,
  origin_state TEXT,
  dest_zip TEXT NOT NULL,
  dest_city TEXT,
  dest_state TEXT,
  transport_type TEXT NOT NULL,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  condition TEXT NOT NULL,
  available_date TEXT,
  distance_miles INTEGER,
  price_estimate INTEGER,
  price_is_estimate INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_created ON leads(id DESC);
CREATE INDEX IF NOT EXISTS leads_status ON leads(status, id DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
