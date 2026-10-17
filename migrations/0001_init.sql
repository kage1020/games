-- プレイヤーは引き継ぎコードの SHA-256 で識別する。コードそのものは持たない
CREATE TABLE players (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  mode TEXT NOT NULL,
  player_key TEXT NOT NULL REFERENCES players (key),
  score INTEGER NOT NULL,
  played_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX scores_board ON scores (game, mode, played_at);

CREATE INDEX scores_player ON scores (player_key, game, mode, created_at);
