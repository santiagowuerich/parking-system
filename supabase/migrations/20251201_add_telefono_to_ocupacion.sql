-- Migración: Agregar campo de teléfono opcional a la tabla ocupacion
-- Fecha: 2024-12-01
-- Descripción: Permite guardar un teléfono opcional al registrar el ingreso de un vehículo para poder enviar el ticket por WhatsApp

-- Agregar columna ocu_telefono a la tabla ocupacion
ALTER TABLE public.ocupacion 
  ADD COLUMN IF NOT EXISTS ocu_telefono VARCHAR(20) NULL;

-- Comentario para documentación
COMMENT ON COLUMN public.ocupacion.ocu_telefono IS 'Teléfono opcional del conductor para envío de tickets por WhatsApp';

