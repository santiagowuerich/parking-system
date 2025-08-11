-- Backfill total: función de mapeo + inserciones idempotentes

-- Extensiones necesarias (uuid-ossp para uuid_generate_v5 en vistas; crypto para digest si fuera necesario)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función de mapeo de tipo (texto) a segmento CHAR(3)
CREATE OR REPLACE FUNCTION map_tipo_to_segmento(tipo TEXT)
RETURNS CHAR(3) AS $$
BEGIN
  IF tipo ILIKE 'Auto' THEN RETURN 'AUT';
  ELSIF tipo ILIKE 'Moto' THEN RETURN 'MOT';
  ELSE RETURN 'CAM';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 1) Vehículos desde parked_vehicles y parking_history
INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT TRIM(pv.license_plate) AS veh_patente, NULL::INT, map_tipo_to_segmento(pv.type)
FROM parked_vehicles pv
WHERE COALESCE(TRIM(pv.license_plate), '') <> ''
ON CONFLICT (veh_patente) DO NOTHING;

INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT TRIM(ph.license_plate) AS veh_patente, NULL::INT, map_tipo_to_segmento(ph.type)
FROM parking_history ph
WHERE COALESCE(TRIM(ph.license_plate), '') <> ''
ON CONFLICT (veh_patente) DO NOTHING;

-- 2) Ocupación actual (sin salida) desde parked_vehicles
INSERT INTO ocupacion (est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro)
SELECT 1, pv.entry_time, 1, NULL::timestamp, TRIM(pv.license_plate), NULL::INT, NULL::INT
FROM parked_vehicles pv
ON CONFLICT DO NOTHING;

-- 3) Pagos desde parking_history con mapeo de método
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_pagos_key'
  ) THEN
    CREATE UNIQUE INDEX ux_pagos_key ON pagos(est_id, veh_patente, pag_h_fh);
  END IF;
END $$;

INSERT INTO pagos (pag_monto, pag_h_fh, est_id, mepa_metodo, veh_patente)
SELECT ph.fee::real,
       ph.exit_time,
       1,
       CASE 
         WHEN ph.payment_method ILIKE 'efectivo%' THEN 'Efectivo'
         WHEN ph.payment_method ILIKE 'transfer%' THEN 'Transferencia'
         WHEN ph.payment_method ILIKE 'mercado%' THEN 'MercadoPago'
         WHEN ph.payment_method ILIKE 'mp%' THEN 'MercadoPago'
         ELSE 'Efectivo'
       END,
       TRIM(ph.license_plate)
FROM parking_history ph
WHERE ph.exit_time IS NOT NULL
ON CONFLICT (est_id, veh_patente, pag_h_fh) DO NOTHING;

-- 4) Ocupación con salida enlazada a pagos
INSERT INTO ocupacion (est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro)
SELECT 1,
       ph.entry_time,
       1,
       ph.exit_time,
       TRIM(ph.license_plate),
       NULL::INT,
       p.pag_nro
FROM parking_history ph
JOIN pagos p
  ON p.est_id = 1
 AND p.veh_patente = TRIM(ph.license_plate)
 AND p.pag_h_fh = ph.exit_time
WHERE ph.exit_time IS NOT NULL
ON CONFLICT DO NOTHING;


