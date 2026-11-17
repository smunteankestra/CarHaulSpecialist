CREATE TABLE IF NOT EXISTS ad_spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  month TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ad_spend_channel_month ON ad_spend(channel, month);
