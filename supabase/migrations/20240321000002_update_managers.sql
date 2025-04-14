-- Add session_restrictions column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_start_time TIME DEFAULT '08:00:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_end_time TIME DEFAULT '22:00:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Create function to check if current time is within allowed session hours
CREATE OR REPLACE FUNCTION is_within_session_hours(start_time TIME, end_time TIME, tz TEXT)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXTRACT(HOUR FROM NOW() AT TIME ZONE tz) * 60 + 
         EXTRACT(MINUTE FROM NOW() AT TIME ZONE tz) 
         BETWEEN 
         EXTRACT(HOUR FROM start_time) * 60 + EXTRACT(MINUTE FROM start_time)
         AND
         EXTRACT(HOUR FROM end_time) * 60 + EXTRACT(MINUTE FROM end_time);
END;
$$;

-- Update RLS policies to include time restrictions for managers
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (
  (auth.uid() = auth_user_id AND get_jwt_role() = 'admin'::user_role) OR
  (auth.uid() = auth_user_id AND get_jwt_role() = 'manager'::user_role AND 
   is_within_session_hours(session_start_time, session_end_time, timezone))
);

-- Update manager locations
UPDATE users 
SET allowed_locations = ARRAY['tustin']
WHERE name = 'Cach';

UPDATE users 
SET allowed_locations = ARRAY['santa_ana']
WHERE name = 'Hung';

UPDATE users 
SET allowed_locations = ARRAY['irvine', 'tustin']
WHERE name = 'Sim';

UPDATE users 
SET allowed_locations = ARRAY['tustin', 'costa_mesa', 'santa_ana']
WHERE name = 'Sergio';

-- Set session hours for all managers
UPDATE users
SET 
  session_start_time = '08:00:00',
  session_end_time = '22:00:00',
  timezone = 'America/Los_Angeles'
WHERE role = 'manager'; 