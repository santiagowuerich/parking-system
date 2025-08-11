-- Backfill idempotente: vehiculos faltantes, pagos y ocupacion

-- 1) Asegurar vehiculos para todas las patentes conocidas
INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT TRIM(x.license_plate), NULL::INT,
       CASE WHEN x.type ILIKE 'Auto' THEN 'AUT'
            WHEN x.type ILIKE 'Moto' THEN 'MOT'
            ELSE 'CAM' END
FROM (
  SELECT license_plate, type FROM parked_vehicles
  UNION ALL
  SELECT license_plate, type FROM parking_history
) x
WHERE COALESCE(TRIM(x.license_plate), '') <> ''
ON CONFLICT (veh_patente) DO NOTHING;

-- 2) Pagos desde parking_history (mapeo método)
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
WHERE ph.exit_time IS NOT NULL AND COALESCE(TRIM(ph.license_plate), '') <> ''
ON CONFLICT (est_id, veh_patente, pag_h_fh) DO NOTHING;

-- 3) Ocupacion sin salida desde parked_vehicles
INSERT INTO ocupacion (est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro)
SELECT 1, pv.entry_time, 1, NULL::timestamp, TRIM(pv.license_plate), NULL::INT, NULL::INT
FROM parked_vehicles pv
WHERE COALESCE(TRIM(pv.license_plate), '') <> ''
ON CONFLICT DO NOTHING;

-- 4) Ocupacion con salida enlazada a pagos
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
WHERE ph.exit_time IS NOT NULL AND COALESCE(TRIM(ph.license_plate), '') <> ''
ON CONFLICT DO NOTHING;




