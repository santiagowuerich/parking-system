-- Migración para agregar estado "Abonado" a tabla plazas
-- Ejecutar esta migración ANTES de usar la funcionalidad de abonos con plazas

-- Agregar constraint CHECK a pla_estado
ALTER TABLE plazas
ADD CONSTRAINT check_pla_estado 
CHECK (pla_estado IN ('Libre', 'Ocupado', 'Abonado'));

-- Crear índice para búsquedas rápidas de plazas libres
CREATE INDEX IF NOT EXISTS idx_plazas_estado_est 
ON plazas(pla_estado, est_id);

-- Marcar como completado
COMMENT ON CONSTRAINT check_pla_estado ON plazas IS 'Constraint para estados válidos de plazas: Libre, Ocupado, Abonado';
COMMENT ON INDEX idx_plazas_estado_est IS 'Índice para optimizar búsquedas de plazas por estado y estacionamiento';

