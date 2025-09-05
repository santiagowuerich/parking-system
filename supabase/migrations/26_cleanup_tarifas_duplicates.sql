-- Limpiar duplicados en tabla tarifas antes de migración de plantillas
-- Este archivo debe ejecutarse ANTES de 27_plaza_templates.sql

BEGIN;

-- Crear tabla temporal con los registros únicos (manteniendo el más reciente por grupo)
CREATE TEMP TABLE tarifas_unique AS
SELECT DISTINCT ON (est_id, tiptar_nro, tar_f_desde)
       est_id, tiptar_nro, catv_segmento, tar_f_desde, tar_precio, tar_fraccion, pla_tipo
FROM public.tarifas
ORDER BY est_id, tiptar_nro, tar_f_desde, tar_precio DESC; -- Mantener el precio más alto en caso de duplicados

-- Limpiar la tabla original
DELETE FROM public.tarifas;

-- Insertar los registros únicos de vuelta
INSERT INTO public.tarifas (est_id, tiptar_nro, catv_segmento, tar_f_desde, tar_precio, tar_fraccion, pla_tipo)
SELECT est_id, tiptar_nro, catv_segmento, tar_f_desde, tar_precio, tar_fraccion, pla_tipo
FROM tarifas_unique;

-- Verificar que ya no hay duplicados
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT est_id, tiptar_nro, tar_f_desde, COUNT(*)
        FROM public.tarifas
        GROUP BY est_id, tiptar_nro, tar_f_desde
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Aún existen % registros duplicados en tarifas', duplicate_count;
    END IF;
END $$;

COMMIT;
