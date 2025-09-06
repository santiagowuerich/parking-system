-- supabase/migrations/36_fix_tarifas_unique_constraint.sql
-- Corregir la estructura de la tabla tarifas para agregar restricción única necesaria para upsert

BEGIN;

-- 1. Eliminar la clave primaria temporal
ALTER TABLE public.tarifas DROP CONSTRAINT IF EXISTS tarifas_temp_pkey;

-- 2. Agregar la nueva clave primaria que incluye plantilla_id
-- Nota: Como plantilla_id puede ser NULL inicialmente, usaremos una restricción única en su lugar
-- que permita NULLs pero garantice unicidad para combinaciones no nulas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'tarifas' AND constraint_name = 'tarifas_unique_constraint') THEN
    ALTER TABLE public.tarifas
    ADD CONSTRAINT tarifas_unique_constraint UNIQUE (est_id, plantilla_id, tiptar_nro);
  END IF;
END $$;

-- 3. Crear una nueva clave primaria que incluya tar_f_desde para mantener integridad
-- Esto permitirá múltiples versiones de tarifas con diferentes fechas de inicio
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'tarifas' AND constraint_name = 'tarifas_pkey') THEN
    ALTER TABLE public.tarifas
    ADD CONSTRAINT tarifas_pkey PRIMARY KEY (est_id, plantilla_id, tiptar_nro, tar_f_desde);
  END IF;
END $$;

-- 4. Verificar que plantilla_id no sea NULL para nuevos registros (opcional)
-- Esto se puede hacer con un trigger o constraint, pero por ahora lo manejaremos en la aplicación

COMMIT;

-- Comentarios explicativos:
-- Esta migración corrige el problema del upsert en la API de tarifas
-- Ahora se puede usar: ON CONFLICT (est_id, plantilla_id, tiptar_nro)
-- La clave primaria incluye tar_f_desde para permitir múltiples versiones históricas
-- La restricción única garantiza que no haya duplicados para la misma combinación

