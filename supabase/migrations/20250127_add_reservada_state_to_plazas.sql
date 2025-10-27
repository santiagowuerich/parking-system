-- Migración: Agregar estado "Reservada" a plazas
-- Fecha: 2025-01-27
-- Descripción: Permitir que las plazas tengan estado "Reservada" cuando se confirma el pago de una reserva

-- Agregar el estado "Reservada" al CHECK constraint
ALTER TABLE plazas
DROP CONSTRAINT IF EXISTS plazas_pla_estado_check;

ALTER TABLE plazas
ADD CONSTRAINT plazas_pla_estado_check
CHECK (pla_estado::text = ANY (ARRAY['Libre'::character varying, 'Ocupada'::character varying, 'Abonado'::character varying, 'Reservada'::character varying]::text[]));

-- Comentario
COMMENT ON COLUMN plazas.pla_estado IS 'Estado de la plaza: Libre, Ocupada, Abonado, Reservada';

