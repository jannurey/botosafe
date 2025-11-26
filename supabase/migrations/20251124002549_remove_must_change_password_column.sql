-- Remove must_change_password column from users table
ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;