-- Drop existing table and policies
DROP TABLE IF EXISTS user_capacity;

-- Create the user_capacity table
CREATE TABLE user_capacity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('Auto', 'Moto', 'Camioneta')),
    capacity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_vehicle_type UNIQUE (user_id, vehicle_type)
);

-- Create index for better performance
CREATE INDEX idx_user_capacity_user_id ON user_capacity(user_id);

-- Enable RLS
ALTER TABLE user_capacity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_capacity_select_policy ON user_capacity;
DROP POLICY IF EXISTS user_capacity_insert_policy ON user_capacity;
DROP POLICY IF EXISTS user_capacity_update_policy ON user_capacity;
DROP POLICY IF EXISTS user_capacity_delete_policy ON user_capacity;

-- Create new policies
CREATE POLICY user_capacity_select_policy ON user_capacity 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_capacity_insert_policy ON user_capacity 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_capacity_update_policy ON user_capacity 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_capacity_delete_policy ON user_capacity 
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL ON user_capacity TO authenticated;
