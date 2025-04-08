-- Drop existing table and policies
DROP TABLE IF EXISTS user_rates;

-- Create the user_rates table
CREATE TABLE user_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('Auto', 'Moto', 'Camioneta')),
    rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_vehicle_type_rate UNIQUE (user_id, vehicle_type)
);

-- Create index for better performance
CREATE INDEX idx_user_rates_user_id ON user_rates(user_id);

-- Enable RLS
ALTER TABLE user_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_rates_select_policy ON user_rates;
DROP POLICY IF EXISTS user_rates_insert_policy ON user_rates;
DROP POLICY IF EXISTS user_rates_update_policy ON user_rates;
DROP POLICY IF EXISTS user_rates_delete_policy ON user_rates;

-- Create new policies
CREATE POLICY user_rates_select_policy ON user_rates 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_rates_insert_policy ON user_rates 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_rates_update_policy ON user_rates 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_rates_delete_policy ON user_rates 
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL ON user_rates TO authenticated; 