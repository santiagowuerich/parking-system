-- Migración: Agregar res_codigo a ocupacion
-- Fecha: 2025-01-27
-- Descripción: Agregar campo para vincular ocupaciones con reservas

-- Agregar campo res_codigo a ocupacion
ALTER TABLE ocupacion 
ADD COLUMN IF NOT EXISTS res_codigo VARCHAR(50);

-- Agregar foreign key (opcional pero recomendado)
ALTER TABLE ocupacion
DROP CONSTRAINT IF EXISTS fk_ocupacion_reserva;

ALTER TABLE ocupacion
ADD CONSTRAINT fk_ocupacion_reserva 
FOREIGN KEY (res_codigo) 
REFERENCES reservas(res_codigo)
ON DELETE SET NULL;

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ocupacion_res_codigo 
ON ocupacion(res_codigo)
WHERE res_codigo IS NOT NULL;

-- Comentario
COMMENT ON COLUMN ocupacion.res_codigo IS 'Código de reserva si el ingreso proviene de reserva';



