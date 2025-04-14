-- Add auth_user_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Create a function to get user role from JWT claims
CREATE OR REPLACE FUNCTION get_jwt_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true)::json->>'user_metadata', '')::json->>'role')::user_role,
    'manager'::user_role
  );
$$;

-- Update RLS policies to use auth_user_id and JWT claims
DROP POLICY IF EXISTS "Users can read their own data" ON users;
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = auth_user_id
);

-- Allow admins to read all users based on JWT claims
DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (
  get_jwt_role() = 'admin'::user_role
);

-- Allow admins to update users based on JWT claims
DROP POLICY IF EXISTS "Admins can update users" ON users;
CREATE POLICY "Admins can update users"
ON users
FOR UPDATE
TO authenticated
USING (
  get_jwt_role() = 'admin'::user_role
)
WITH CHECK (
  get_jwt_role() = 'admin'::user_role
);

-- Allow admins to insert users based on JWT claims
DROP POLICY IF EXISTS "Admins can insert users" ON users;
CREATE POLICY "Admins can insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  get_jwt_role() = 'admin'::user_role
);

-- Allow admins to delete users based on JWT claims
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
ON users
FOR DELETE
TO authenticated
USING (
  get_jwt_role() = 'admin'::user_role
); 