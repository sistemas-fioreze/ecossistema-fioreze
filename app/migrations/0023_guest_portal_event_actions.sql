PRAGMA foreign_keys = ON;

ALTER TABLE events ADD COLUMN action_text TEXT;
ALTER TABLE events ADD COLUMN action_url TEXT;
