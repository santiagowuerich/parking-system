-- Vistas en español para consumo por la app

DROP VIEW IF EXISTS vw_ocupacion_actual;
DROP VIEW IF EXISTS vw_historial_estacionamiento;

-- Ocupación actual (vehículos estacionados)
CREATE VIEW vw_ocupacion_actual AS
SELECT
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  NULL::uuid AS user_id
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
WHERE o.ocu_fh_salida IS NULL;

-- Historial de estacionamiento
CREATE VIEW vw_historial_estacionamiento AS
SELECT
  uuid_generate_v5(uuid_ns_url(), o.est_id::text || '-' || o.pla_numero::text || '-' || to_char(o.ocu_fh_entrada, 'YYYYMMDDHH24MISSMS')) AS id,
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  o.ocu_fh_salida  AS exit_time,
  (EXTRACT(EPOCH FROM (o.ocu_fh_salida - o.ocu_fh_entrada)) * 1000)::bigint AS duration,
  COALESCE(p.pag_monto::double precision, 0) AS fee,
  p.mepa_metodo AS payment_method,
  NULL::uuid AS user_id,
  o.ocu_fh_salida AS created_at
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
LEFT JOIN pagos p ON p.pag_nro = o.pag_nro
WHERE o.ocu_fh_salida IS NOT NULL;




