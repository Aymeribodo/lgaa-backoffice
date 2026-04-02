INSERT OR IGNORE INTO channels (
  channel_id,
  code,
  name,
  is_active,
  metadata,
  created_at,
  updated_at
) VALUES
  ('vinted', 'V', 'Vinted', 1, '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('site', 'S', 'Site', 1, '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('ebay', 'E', 'eBay', 1, '{}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

