-- Migración para agregar relación plaza-abono
-- Ejecutar esta migración DESPUÉS de add-abonado-estado-plazas.sql

-- Agregar columnas a tabla abonos
ALTER TABLE abonos
ADD COLUMN IF NOT EXISTS pla_numero INTEGER,
ADD COLUMN IF NOT EXISTS est_id INTEGER;

-- Crear Foreign Keys
ALTER TABLE abonos
ADD CONSTRAINT fk_abonos_plazas 
FOREIGN KEY (pla_numero, est_id) 
REFERENCES plazas(pla_numero, est_id) 
ON DELETE RESTRICT;

-- Crear índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_abonos_plaza 
ON abonos(pla_numero, est_id);

-- Marcar como completado
COMMENT ON COLUMN abonos.pla_numero IS 'Número de plaza asignada al abono';
COMMENT ON COLUMN abonos.est_id IS 'ID del estacionamiento (desnormalizado para optimizar queries)';
COMMENT ON CONSTRAINT fk_abonos_plazas ON abonos IS 'FK que relaciona abono con plaza específica';
COMMENT ON INDEX idx_abonos_plaza IS 'Índice para optimizar búsquedas de abonos por plaza';

