-- Create the user_role enum type
CREATE TYPE user_role AS ENUM ('admin', 'manager');

-- Create the users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'manager',
    allowed_locations TEXT[] DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add a unique constraint on pin_code to ensure no duplicate PINs
ALTER TABLE users ADD CONSTRAINT users_pin_code_unique UNIQUE (pin_code);

-- Create an index on pin_code for faster lookups during authentication
CREATE INDEX users_pin_code_idx ON users (pin_code);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to read their own data
CREATE POLICY "Users can read their own data"
    ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Allow admins to manage all users
CREATE POLICY "Admins can manage all users"
    ON users
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert Admin Users
INSERT INTO users (name, pin_code, role) VALUES
('Ross', '7404', 'admin'),
('Tonet', '0328', 'admin'),
('Archie', '7588', 'admin'),
('Katelyn', '6626', 'admin'),
('Dylan', '6867', 'admin'),
('Martin', '5050', 'admin'),
('Katie', '0570', 'admin'),
('Michael', '5378', 'admin');

-- Insert Manager Users
INSERT INTO users (name, pin_code, role) VALUES
('Cach', '0279', 'manager'),
('Sergio', '1753', 'manager'),
('Hung', '2051', 'manager'),
('Sim', '9631', 'manager'); 