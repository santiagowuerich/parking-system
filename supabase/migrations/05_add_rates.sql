-- Crear tabla de tarifas por usuario
CREATE TABLE IF NOT EXISTS user_rates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES admins(id),
    vehicle_type TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, vehicle_type)
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_rates_user_id ON user_rates(user_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_rates_timestamp
    BEFORE UPDATE ON user_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_user_rates_updated_at(); 