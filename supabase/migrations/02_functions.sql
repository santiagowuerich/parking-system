-- Eliminar triggers y funciones existentes
DROP TRIGGER IF EXISTS check_duplicate_vehicles ON parked_vehicles;
DROP TRIGGER IF EXISTS update_parked_vehicles_updated_at ON parked_vehicles;
DROP FUNCTION IF EXISTS prevent_duplicate_vehicles();
DROP FUNCTION IF EXISTS update_updated_at();

-- Función para prevenir duplicados de vehículos
CREATE OR REPLACE FUNCTION prevent_duplicate_vehicles()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM parked_vehicles 
    WHERE license_plate = NEW.license_plate
  ) THEN
    RAISE EXCEPTION 'Ya existe un vehículo con esta matrícula estacionado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar duplicados
CREATE TRIGGER check_duplicate_vehicles
BEFORE INSERT OR UPDATE ON parked_vehicles
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_vehicles();

-- Función para actualizar el timestamp de actualización
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el timestamp
CREATE TRIGGER update_parked_vehicles_updated_at
BEFORE UPDATE ON parked_vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at(); 