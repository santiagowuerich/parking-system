-- supabase/migrations/27_plaza_templates.sql

BEGIN;

-- 1. Tabla principal para las plantillas de plazas.
CREATE TABLE IF NOT EXISTS public.plantillas (
  plantilla_id SERIAL PRIMARY KEY,
  est_id INT NOT NULL,
  nombre_plantilla VARCHAR(100) NOT NULL,
  catv_segmento CHAR(3) NOT NULL,
  CONSTRAINT fk_plantillas_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id) ON DELETE CASCADE,
  CONSTRAINT fk_plantillas_cat_vehiculo FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento)
);

-- 2. Tablas para un sistema de características extensible.
CREATE TABLE IF NOT EXISTS public.caracteristica_tipos (
  tipo_id SERIAL PRIMARY KEY,
  nombre_tipo VARCHAR(50) UNIQUE NOT NULL -- Ej: 'Techo', 'Seguridad', 'Conectividad'
);

CREATE TABLE IF NOT EXISTS public.caracteristicas (
  caracteristica_id SERIAL PRIMARY KEY,
  tipo_id INT NOT NULL,
  valor VARCHAR(100) NOT NULL,
  CONSTRAINT fk_caracteristicas_tipo FOREIGN KEY (tipo_id) REFERENCES public.caracteristica_tipos(tipo_id) ON DELETE CASCADE,
  CONSTRAINT uq_tipo_valor UNIQUE (tipo_id, valor)
);

-- 3. Tabla intermedia para la relación muchos-a-muchos entre plantillas y características.
CREATE TABLE IF NOT EXISTS public.plantilla_caracteristicas (
  plantilla_id INT NOT NULL,
  caracteristica_id INT NOT NULL,
  CONSTRAINT pk_plantilla_caracteristicas PRIMARY KEY (plantilla_id, caracteristica_id),
  CONSTRAINT fk_pc_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id) ON DELETE CASCADE,
  CONSTRAINT fk_pc_caracteristica FOREIGN KEY (caracteristica_id) REFERENCES public.caracteristicas(caracteristica_id) ON DELETE CASCADE
);

-- 4. Modificar la tabla 'plazas' para asignarle una plantilla.
ALTER TABLE public.plazas ADD COLUMN IF NOT EXISTS plantilla_id INT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'plazas' and constraint_name = 'fk_plazas_plantilla') THEN
    ALTER TABLE public.plazas
      ADD CONSTRAINT fk_plazas_plantilla FOREIGN KEY (plantilla_id)
      REFERENCES public.plantillas(plantilla_id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Modificar la tabla 'tarifas' para basarse en plantillas en lugar de 'pla_tipo'.
ALTER TABLE public.tarifas DROP CONSTRAINT IF EXISTS fk_tarifas_tipo_plaza;
ALTER TABLE public.tarifas DROP CONSTRAINT IF EXISTS tarifas_pkey;
ALTER TABLE public.tarifas DROP COLUMN IF EXISTS pla_tipo;
ALTER TABLE public.tarifas ADD COLUMN IF NOT EXISTS plantilla_id INT;

-- Crear clave primaria temporal sin plantilla_id para evitar problemas con NULLs
ALTER TABLE public.tarifas ADD CONSTRAINT tarifas_temp_pkey PRIMARY KEY (est_id, tiptar_nro, tar_f_desde);

-- Agregar la restricción de clave foránea para plantilla_id (puede ser NULL inicialmente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'tarifas' and constraint_name = 'fk_tarifas_plantilla') THEN
    ALTER TABLE public.tarifas
      ADD CONSTRAINT fk_tarifas_plantilla FOREIGN KEY (plantilla_id)
      REFERENCES public.plantillas(plantilla_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Nota: La clave primaria final se actualizará cuando se asignen plantillas a las tarifas existentes


-- 6. Insertar los tipos de características y sus valores iniciales.
INSERT INTO public.caracteristica_tipos (nombre_tipo) VALUES ('Techo'), ('Seguridad'), ('Conectividad') ON CONFLICT DO NOTHING;
INSERT INTO public.caracteristicas (tipo_id, valor) VALUES
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Techo'), 'Cubierto'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Techo'), 'Descubierto'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Seguridad'), 'Cámaras'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Seguridad'), 'Vigilado'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Seguridad'), 'Acceso controlado'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Conectividad'), 'Cargador EV'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Conectividad'), 'Toma 220V'),
((SELECT tipo_id FROM public.caracteristica_tipos WHERE nombre_tipo = 'Conectividad'), 'Wi-Fi')
ON CONFLICT DO NOTHING;

COMMIT;
