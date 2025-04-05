-- Eliminar todas las políticas y restricciones existentes
DROP POLICY IF EXISTS "Acceso total a parked_vehicles" ON parked_vehicles;
DROP POLICY IF EXISTS "Acceso total a parking_history" ON parking_history;
DROP TRIGGER IF EXISTS check_duplicate_vehicles ON parked_vehicles;
DROP FUNCTION IF EXISTS prevent_duplicate_vehicles();

-- Deshabilitar RLS completamente
ALTER TABLE parked_vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parking_history DISABLE ROW LEVEL SECURITY;

-- Función simple para prevenir duplicados
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

CREATE TRIGGER check_duplicate_vehicles
BEFORE INSERT OR UPDATE ON parked_vehicles
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_vehicles(); 