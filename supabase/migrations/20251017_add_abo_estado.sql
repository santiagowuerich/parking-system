-- Migración: Agregar columna abo_estado a tabla abonos
-- Fecha: 2025-10-17
-- Descripción: Implementa baja lógica para abonos mediante columna de estado

-- 1. Agregar columna abo_estado
ALTER TABLE abonos
ADD COLUMN IF NOT EXISTS abo_estado VARCHAR(20) DEFAULT 'activo';

-- 2. Agregar constraint para validar solo valores permitidos
ALTER TABLE abonos
ADD CONSTRAINT check_abo_estado
CHECK (abo_estado IN ('activo', 'inactivo'));

-- 3. Actualizar todos los registros existentes a 'activo'
UPDATE abonos
SET abo_estado = 'activo'
WHERE abo_estado IS NULL;

-- 4. Crear índice para mejorar performance en consultas filtradas por estado
CREATE INDEX IF NOT EXISTS idx_abonos_estado
ON abonos(abo_estado);

-- 5. Crear índice compuesto para consultas comunes (est_id + estado)
CREATE INDEX IF NOT EXISTS idx_abonos_est_estado
ON abonos(est_id, abo_estado);

-- Comentarios
COMMENT ON COLUMN abonos.abo_estado IS 'Estado del abono para baja lógica: activo (vigente) o inactivo (dado de baja)';
