-- ============================================================================
-- Seed data: 20 corrales. Users are created on first run via the
-- /api/auth/setup endpoint (see README): the FIRST POST to that endpoint,
-- while the users table is empty, creates the admin and the 3 workers
-- with passwords you choose. After that, the endpoint refuses to run.
-- ============================================================================

INSERT OR IGNORE INTO corrales (name) VALUES
  ('Corral 1'),  ('Corral 2'),  ('Corral 3'),  ('Corral 4'),  ('Corral 5'),
  ('Corral 6'),  ('Corral 7'),  ('Corral 8'),  ('Corral 9'),  ('Corral 10'),
  ('Corral 11'), ('Corral 12'), ('Corral 13'), ('Corral 14'), ('Corral 15'),
  ('Corral 16'), ('Corral 17'), ('Corral 18'), ('Corral 19'), ('Corral 20');
