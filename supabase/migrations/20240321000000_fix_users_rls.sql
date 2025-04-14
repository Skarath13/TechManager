-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create a function to get user role from JWT claims
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::user_role),
    'manager'::user_role
  );
$$;

-- Create new policies
-- Allow users to read their own data (excluding pin_code)
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- Allow admins to read all users (excluding pin_code)
CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'admin'::user_role
);

-- Allow admins to update users
CREATE POLICY "Admins can update users"
ON users
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'admin'::user_role
)
WITH CHECK (
  get_user_role() = 'admin'::user_role
);

-- Allow admins to insert new users
CREATE POLICY "Admins can insert users"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin'::user_role
);

-- Allow admins to delete users
CREATE POLICY "Admins can delete users"
ON users
FOR DELETE
TO authenticated
USING (
  get_user_role() = 'admin'::user_role
);

-- Revoke direct access to pin_code column for all users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
REVOKE SELECT (pin_code) ON users FROM PUBLIC;
GRANT SELECT (id, name, role, allowed_locations, created_at, updated_at) ON users TO authenticated;
GRANT INSERT (name, pin_code, role, allowed_locations) ON users TO authenticated;
GRANT UPDATE (name, pin_code, role, allowed_locations) ON users TO authenticated;
GRANT DELETE ON users TO authenticated; 