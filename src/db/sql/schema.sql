PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS channels (
  channel_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objects (
  object_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stock_status TEXT NOT NULL,
  workflow_status TEXT NOT NULL CHECK (
    workflow_status IN (
      'BROUILLON',
      'IA_GENERE',
      'A_VERIFIER',
      'PRET',
      'PUBLIE',
      'VENDU',
      'PAYE',
      'PROBLEME',
      'ARCHIVE'
    )
  ),
  source TEXT,
  note_rapide TEXT,
  type_objet TEXT,
  titre_interne TEXT,
  description_interne TEXT,
  categorie_interne TEXT,
  etat TEXT,
  prix_ia_cents INTEGER,
  prix_reference_cents INTEGER,
  prix_final_cents INTEGER,
  confiance REAL CHECK (confiance IS NULL OR (confiance >= 0 AND confiance <= 1)),
  main_photo_id TEXT,
  location_code TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS object_photos (
  photo_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  original_filename TEXT,
  stored_filename TEXT,
  relative_path TEXT,
  mime_type TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(object_id) ON DELETE CASCADE,
  UNIQUE (object_id, position)
);

CREATE TABLE IF NOT EXISTS publications (
  publication_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_listing_id TEXT,
  channel_status TEXT NOT NULL,
  titre_publie TEXT,
  description_publiee TEXT,
  categorie_canal TEXT,
  prix_publie_cents INTEGER,
  hashtags_publies TEXT NOT NULL DEFAULT '[]',
  external_url TEXT,
  published_at TEXT,
  sold_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (object_id) REFERENCES objects(object_id) ON DELETE RESTRICT,
  FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE RESTRICT,
  UNIQUE (channel_id, channel_listing_id)
);

CREATE TABLE IF NOT EXISTS object_ai_generations (
  generation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('MANUAL', 'RETRY')),
  generation_status TEXT NOT NULL CHECK (generation_status IN ('PENDING', 'COMPLETED', 'FAILED')),
  attempt_number INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_snapshot TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  error_code TEXT,
  error_message TEXT,
  provider_response_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (object_id) REFERENCES objects(object_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('OBJECT', 'PUBLICATION')),
  entity_id TEXT NOT NULL,
  root_object_id TEXT,
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'SYSTEM' CHECK (source_type IN ('MANUAL', 'AI', 'SYSTEM')),
  summary TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS id_counters (
  scope TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_objects_workflow_status
  ON objects(workflow_status);

CREATE INDEX IF NOT EXISTS idx_objects_updated_at
  ON objects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_objects_note_rapide
  ON objects(note_rapide);

CREATE INDEX IF NOT EXISTS idx_objects_titre_interne
  ON objects(titre_interne);

CREATE INDEX IF NOT EXISTS idx_objects_categorie_interne
  ON objects(categorie_interne);

CREATE INDEX IF NOT EXISTS idx_publications_object_id
  ON publications(object_id);

CREATE INDEX IF NOT EXISTS idx_publications_channel_id
  ON publications(channel_id);

CREATE INDEX IF NOT EXISTS idx_publications_channel_status
  ON publications(channel_status);

CREATE INDEX IF NOT EXISTS idx_object_photos_object_id
  ON object_photos(object_id);

CREATE INDEX IF NOT EXISTS idx_object_ai_generations_object_id
  ON object_ai_generations(object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_events_entity
  ON history_events(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_history_events_root_object
  ON history_events(root_object_id, created_at DESC);
