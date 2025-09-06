-- Migración de limpieza: eliminar sistema de zonas complejo y restaurar sistema original
-- Elimina tablas: zonas, zona_capacidad
-- Elimina columna: zona_id de plazas  
-- Restaura vista: vw_ocupacion_actual original

BEGIN;

-- 1. Eliminar vista que usa el sistema complejo
DROP VIEW IF EXISTS public.vw_zonas_con_capacidad;

-- 2. Eliminar tabla zona_capacidad y sus dependencias
DROP TRIGGER IF EXISTS trigger_update_zona_capacidad_updated_at ON public.zona_capacidad;
DROP FUNCTION IF EXISTS update_zona_capacidad_updated_at();
DROP TABLE IF EXISTS public.zona_capacidad;

-- 3. Eliminar constraint de zona_id en plazas antes de eliminar la tabla zonas
ALTER TABLE IF EXISTS public.plazas DROP CONSTRAINT IF EXISTS fk_plazas_zona;

-- 4. Eliminar tabla zonas
DROP TABLE IF EXISTS public.zonas;

-- 5. Eliminar columna zona_id de plazas (mantener pla_zona original)
ALTER TABLE IF EXISTS public.plazas DROP COLUMN IF EXISTS zona_id;

-- 6. Restaurar la vista original vw_ocupacion_actual (versión de migración 23)
DROP VIEW IF EXISTS public.vw_ocupacion_actual;

CREATE VIEW public.vw_ocupacion_actual AS
SELECT
  o.est_id,
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  o.pla_numero AS plaza_number
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
WHERE o.ocu_fh_salida IS NULL;

COMMIT;





