-- Preparativos para migración de datos al esquema en español

-- 1) Permitir con_id NULL temporalmente para migrar sin mapear conductores
ALTER TABLE IF EXISTS vehiculos
  ALTER COLUMN con_id DROP NOT NULL;

-- 2) Crear secuencia para pagos si no existe y setear default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND c.relname = 'seq_pagos'
  ) THEN
    CREATE SEQUENCE seq_pagos START 1000 INCREMENT 1;
  END IF;
END $$;

ALTER TABLE IF EXISTS pagos
  ALTER COLUMN pag_nro SET DEFAULT nextval('seq_pagos');

-- 3) Crear un estacionamiento por defecto si no existe (est_id = 1)
INSERT INTO estacionamientos (
  est_id, est_prov, est_locali, est_direc, est_nombre, est_capacidad,
  due_id, est_cantidad_espacios_disponibles, est_horario_funcionamiento, est_tolerancia_min
) VALUES (
  1, 'NA', 'NA', 'NA', 'Principal', 99999,
  0, 99999, 24, 15
) ON CONFLICT (est_id) DO NOTHING;

-- 4) Crear al menos una plaza por defecto (est_id=1, pla_numero=1)
INSERT INTO plazas (est_id, pla_numero, pla_estado, catv_segmento, pla_zona)
VALUES (1, 1, 'Libre', 'AUT', NULL)
ON CONFLICT (est_id, pla_numero) DO NOTHING;




