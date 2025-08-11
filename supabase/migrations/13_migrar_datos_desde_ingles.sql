-- Migración de datos desde tablas en inglés a esquema en español

-- Helper: función para mapear tipo texto a segmento CHAR(3)
CREATE OR REPLACE FUNCTION map_tipo_to_segmento(tipo TEXT)
RETURNS CHAR(3) AS $$
BEGIN
  IF tipo ILIKE 'Auto' THEN RETURN 'AUT';
  ELSIF tipo ILIKE 'Moto' THEN RETURN 'MOT';
  ELSE RETURN 'CAM';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 1) Vehículos únicos a partir de parked_vehicles y parking_history
INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT pv.license_plate, NULL::INT, map_tipo_to_segmento(pv.type)
FROM parked_vehicles pv
ON CONFLICT (veh_patente) DO NOTHING;

INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT ph.license_plate, NULL::INT, map_tipo_to_segmento(ph.type)
FROM parking_history ph
ON CONFLICT (veh_patente) DO NOTHING;

-- 2) Ocupación actual a partir de parked_vehicles (sin salida)
INSERT INTO ocupacion (
  est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro
)
SELECT 1 AS est_id,
       pv.entry_time AS ocu_fh_entrada,
       1 AS pla_numero,
       NULL::timestamp AS ocu_fh_salida,
       pv.license_plate AS veh_patente,
       NULL::INT AS tiptar_nro,
       NULL::INT AS pag_nro
FROM parked_vehicles pv
ON CONFLICT DO NOTHING;

-- 3) Historial: crear pagos y ocupación con salida desde parking_history
WITH pagos_ins AS (
  INSERT INTO pagos (pag_monto, pag_h_fh, est_id, mepa_metodo, veh_patente)
  SELECT ph.fee::real, ph.exit_time, 1, ph.payment_method, ph.license_plate
  FROM parking_history ph
  ON CONFLICT DO NOTHING
  RETURNING pag_nro, veh_patente, pag_h_fh
)
INSERT INTO ocupacion (
  est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro
)
SELECT 1,
       ph.entry_time,
       1,
       ph.exit_time,
       ph.license_plate,
       NULL::INT,
       p.pag_nro
FROM parking_history ph
JOIN pagos p ON p.veh_patente = ph.license_plate AND p.pag_h_fh = ph.exit_time AND p.est_id = 1
ON CONFLICT DO NOTHING;




