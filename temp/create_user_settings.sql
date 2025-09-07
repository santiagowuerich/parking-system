-- Drop existing table and policies
DROP TABLE IF EXISTS user_settings;

-- Create the user_settings table
CREATE TABLE user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    mercadopago_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for better performance
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_settings_select_policy ON user_settings;
DROP POLICY IF EXISTS user_settings_insert_policy ON user_settings;
DROP POLICY IF EXISTS user_settings_update_policy ON user_settings;
DROP POLICY IF EXISTS user_settings_delete_policy ON user_settings;

-- Create new policies
CREATE POLICY user_settings_select_policy ON user_settings 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_settings_insert_policy ON user_settings 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_settings_update_policy ON user_settings 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_settings_delete_policy ON user_settings 
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL ON user_settings TO authenticated; 