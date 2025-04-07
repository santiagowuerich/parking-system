-- Primero deshabilitamos RLS
ALTER TABLE parked_vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE parking_history DISABLE ROW LEVEL SECURITY;

-- Eliminamos todas las políticas existentes
DROP POLICY IF EXISTS "Permitir todas las operaciones" ON parked_vehicles;
DROP POLICY IF EXISTS "Permitir todas las operaciones en historial" ON parking_history;

-- Habilitamos RLS
ALTER TABLE parked_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_history ENABLE ROW LEVEL SECURITY;

-- Política para parked_vehicles que permite todas las operaciones sin restricciones
CREATE POLICY "Permitir acceso completo a parked_vehicles"
ON parked_vehicles
FOR ALL
USING (true)
WITH CHECK (true);

-- Política para parking_history que permite todas las operaciones sin restricciones
CREATE POLICY "Permitir acceso completo a parking_history"
ON parking_history
FOR ALL
USING (true)
WITH CHECK (true); 