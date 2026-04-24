-- Shameify D1 Schema
-- Run: wrangler d1 execute shameify-db --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  shame_points INTEGER NOT NULL DEFAULT 0,
  badges       TEXT    NOT NULL DEFAULT '[]',
  joined_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS infractions (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  demerit_id   TEXT,
  title        TEXT    NOT NULL,
  points       INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  witness      TEXT    NOT NULL DEFAULT '',
  deadline     TEXT    NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_infractions_user ON infractions(user_id);
CREATE INDEX IF NOT EXISTS idx_infractions_ts   ON infractions(timestamp_ms DESC);

-- ── Demo seed data (INSERT OR IGNORE keeps it idempotent) ────────

INSERT OR IGNORE INTO users (id, name, shame_points, badges, joined_at) VALUES
  ('demo_margaret', 'Margaret Holsworth',  847, '["early_adopter","synergy_devotee","vanisher","reply_all_menace","hall_of_infamy"]', 1745193600000),
  ('demo_derek',    'Derek Plimpton Jr.',  390, '["early_adopter","calendar_tetris","email_warrior","boomerang","deck_criminal"]',    1745193600000),
  ('demo_vanessa',  'Vanessa Chen-Whitmore', 142, '["early_adopter","calendar_tetris"]',                                              1745193600000);

INSERT OR IGNORE INTO infractions (id, user_id, demerit_id, title, points, timestamp_ms, witness) VALUES
  -- Margaret
  ('d0', 'demo_margaret', 'reply_all',   'Reply-All on 200-Person Chain',        500, 1745107200000, 'Everyone on the distribution list'),
  ('d1', 'demo_margaret', 'synergy',     'Used "Synergy" Unironically',           100, 1745193600000, 'Leadership team, all-hands'),
  ('d2', 'demo_margaret', 'friday_sync', 'Scheduled 4:47pm Friday "Quick Sync"', 250, 1745280000000, 'The entire floor'),
  -- Derek
  ('d3', 'demo_derek', 'no_agenda',         'Meeting Invite With No Agenda',    30,  1744934400000, 'Self'),
  ('d4', 'demo_derek', 'circle_back',       'Said "Let''s Circle Back"',        10,  1745020800000, 'Self'),
  ('d5', 'demo_derek', 'per_my_last_email', '"Per My Last Email"',              25,  1745193600000, 'Entire email thread'),
  ('d6', 'demo_derek', 'missed_deadline',   'Missed Deadline',                  50,  1745280000000, 'The calendar itself'),
  ('d7', 'demo_derek', 'deck_incoming',     '"Deck Incoming" — 87 Slides',     120,  1745323200000, 'Legal and compliance'),
  ('d8', 'demo_derek', 'synergy',           'Used "Synergy" Unironically',     100,  1745344800000, 'HR business partner'),
  ('d9', 'demo_derek', 'low_hanging_fruit', 'Said "Low-Hanging Fruit"',         20,  1745355600000, 'Themselves, unfortunately'),
  ('da', 'demo_derek', 'take_it_offline',   '"Let''s Take This Offline"',       15,  1745359200000, 'No one; it never happened'),
  ('db', 'demo_derek', 'bandwidth',         'Used "Bandwidth" About a Human',   20,  1745361000000, 'The human in question'),
  -- Vanessa
  ('dc', 'demo_vanessa', 'ping_me',           'Said "Ping Me"',                    15, 1744848000000, 'Self'),
  ('dd', 'demo_vanessa', 'zoom_dropout',      'Left Zoom Without Saying Goodbye',  40, 1745193600000, 'Seven meeting participants'),
  ('de', 'demo_vanessa', 'just_following_up', '"Just Following Up" (3rd Time)',    35, 1745280000000, 'Original sender (they saw it)'),
  ('df', 'demo_vanessa', 'ooo_reply',         'Sent Emails While "Out of Office"', 60, 1745323200000, 'The auto-reply itself');
