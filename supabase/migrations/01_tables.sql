-- Crear tabla de vehículos estacionados
CREATE TABLE IF NOT EXISTS parked_vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_plate TEXT NOT NULL,
    type TEXT NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de historial de estacionamiento
CREATE TABLE IF NOT EXISTS parking_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_plate TEXT NOT NULL,
    type TEXT NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration NUMERIC NOT NULL,
    fee NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_parked_vehicles_license_plate ON parked_vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_parked_vehicles_user_id ON parked_vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_parking_history_license_plate ON parking_history(license_plate);
CREATE INDEX IF NOT EXISTS idx_parking_history_user_id ON parking_history(user_id); 