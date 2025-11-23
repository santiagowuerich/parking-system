-- Migración para arreglar el timezone en res_created_at
-- Fecha: 2025-11-22
-- Descripción: Cambiar res_created_at para guardar en Argentina timezone en lugar de UTC

-- ============================================
-- 1. ACTUALIZAR TRIGGER para usar Argentina timezone
-- ============================================

-- Recrear la función del trigger para usar AT TIME ZONE
CREATE OR REPLACE FUNCTION trigger_generar_codigo_reserva()
RETURNS trigger AS $$
BEGIN
    -- Solo generar código si no existe
    IF NEW.res_codigo IS NULL OR NEW.res_codigo = '' THEN
        NEW.res_codigo := generar_codigo_reserva();
    END IF;

    -- Establecer fecha de creación si no existe
    -- FIX: Usar Argentina timezone en lugar de UTC
    IF NEW.res_created_at IS NULL THEN
        NEW.res_created_at := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::timestamp without time zone;
    END IF;

    -- Validar que res_fh_fin sea posterior a res_fh_ingreso
    IF NEW.res_fh_fin IS NOT NULL AND NEW.res_fh_fin <= NEW.res_fh_ingreso THEN
        RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ACTUALIZAR DEFAULT del campo res_created_at
-- ============================================

-- Cambiar el default de la columna para usar Argentina timezone
ALTER TABLE public.reservas
ALTER COLUMN res_created_at
SET DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::timestamp without time zone);

-- ============================================
-- 3. CORRECCIÓN DE REGISTROS EXISTENTES
-- ============================================

-- Nota: Si hay registros existentes con res_created_at incorrectos,
-- descomentar la siguiente línea para corregirlos:
-- UPDATE public.reservas
-- SET res_created_at = (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::timestamp without time zone
-- WHERE res_created_at IS NOT NULL;
