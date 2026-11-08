CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  message TEXT NOT NULL,
  page TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_created ON chat_messages(created_at);
