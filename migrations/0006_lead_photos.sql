CREATE TABLE IF NOT EXISTS lead_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  photo_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS lead_photos_lead ON lead_photos(lead_id, id);

INSERT INTO lead_photos (lead_id, photo_key, created_at)
SELECT id, photo_key, created_at
FROM leads
WHERE photo_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lead_photos WHERE lead_id = leads.id AND photo_key = leads.photo_key
  );
