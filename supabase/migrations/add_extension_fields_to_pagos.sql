-- Migración: Agregar campos para extensiones de abonos a tabla pagos
-- Fecha: 2025-01-16
-- Versión: 1.0

-- Descripción:
-- Esta migración añade campos adicionales a la tabla pagos para soportar
-- el sistema de extensiones de abonos, permitiendo distinguir tipos de pago,
-- agregar descripciones detalladas y mantener referencias a abonos.

-- Agregar columnas adicionales a tabla pagos
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS pag_tipo VARCHAR(50) DEFAULT 'ocupacion',
ADD COLUMN IF NOT EXISTS pag_descripcion TEXT,
ADD COLUMN IF NOT EXISTS pag_estado VARCHAR(20) DEFAULT 'completado',
ADD COLUMN IF NOT EXISTS abo_nro INTEGER,
ADD COLUMN IF NOT EXISTS pag_datos_tarjeta JSONB;

-- Crear índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(pag_tipo);
CREATE INDEX IF NOT EXISTS idx_pagos_abono ON pagos(abo_nro) WHERE abo_nro IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(pag_estado);

-- Crear índice compuesto para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_pagos_tipo_estado ON pagos(pag_tipo, pag_estado);

-- Crear Foreign Key para abo_nro (opcional, puede ser null para pagos de ocupaciones)
-- Nota: No creamos FK estricta porque abo_nro puede ser null para pagos de ocupaciones normales

-- Comentarios para documentación
COMMENT ON COLUMN pagos.pag_tipo IS 'Tipo de pago: ocupacion (estacionamiento normal), extension (extensión de abono), etc.';
COMMENT ON COLUMN pagos.pag_descripcion IS 'Descripción detallada del pago (ej: "Extensión mensual x3 - Sin observaciones")';
COMMENT ON COLUMN pagos.pag_estado IS 'Estado del pago: completado, pendiente, fallido, cancelado';
COMMENT ON COLUMN pagos.abo_nro IS 'Referencia al abono si es extensión (NULL para pagos de ocupaciones normales)';
COMMENT ON COLUMN pagos.pag_datos_tarjeta IS 'Datos de tarjeta (solo últimos 4 dígitos para seguridad)';

-- Comentario de la migración:
-- Esta migración prepara la tabla pagos para soportar múltiples tipos de pago,
-- especialmente extensiones de abonos. Los índices creados optimizan las consultas
-- más frecuentes como buscar extensiones por abono o filtrar por tipo de pago.

-- Después de ejecutar esta migración, se podrán:
-- 1. Crear pagos de extensiones con información detallada
-- 2. Filtrar pagos por tipo (ocupaciones vs extensiones)
-- 3. Relacionar pagos directamente con abonos específicos
-- 4. Mantener historial completo de transacciones
