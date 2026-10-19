-- ============================================================================
-- START FROM ZERO
-- Deletes every record and every user so the app looks brand new:
--   * all feeding, animal movements, bultos deliveries, deletion history
--   * all users and open sessions (the /setup page works again)
-- Keeps the 20 corrales (the farm layout), and the database structure.
-- THIS CANNOT BE UNDONE.
--
-- Run it with:   npm run db:remote:reset      (the real, deployed database)
--                npm run db:local:reset       (your local test copy)
-- ============================================================================

DELETE FROM sessions;
DELETE FROM deletion_log;
DELETE FROM feed_consumption;
DELETE FROM animal_movements;
DELETE FROM food_lots;
DELETE FROM users;

-- Restart the id counters so the first new record is #1 again.
DELETE FROM sqlite_sequence
 WHERE name IN ('sessions','deletion_log','feed_consumption','animal_movements','food_lots','users');
