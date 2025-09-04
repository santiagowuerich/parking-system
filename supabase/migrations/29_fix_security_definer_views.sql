-- CORRECCIÓN: Recrear vistas sin SECURITY DEFINER para solucionar problemas de aislamiento de datos
-- Esto soluciona el problema del "flash de datos antiguos" al cambiar entre estacionamientos

-- Recrear vistas críticas sin SECURITY DEFINER
DROP VIEW IF EXISTS vw_ocupacion_actual;
DROP VIEW IF EXISTS vw_parked_vehicles;
DROP VIEW IF EXISTS vw_parking_history;
DROP VIEW IF EXISTS vw_historial_estacionamiento;
DROP VIEW IF EXISTS vw_zonas_con_capacidad;

-- 1. Vista de ocupación actual (sin SECURITY DEFINER)
CREATE VIEW vw_ocupacion_actual AS
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

-- 2. Vista de vehículos estacionados (sin SECURITY DEFINER)
CREATE VIEW vw_parked_vehicles AS
SELECT
  uuid_generate_v5(uuid_ns_url(), o.est_id::text || '-' || o.pla_numero::text || '-' || to_char(o.ocu_fh_entrada, 'YYYYMMDDHH24MISSMS')) AS id,
  o.est_id,
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  o.pla_numero AS plaza_number,
  NULL::uuid AS user_id
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
WHERE o.ocu_fh_salida IS NULL;

-- 3. Vista de historial de estacionamiento (sin SECURITY DEFINER)
CREATE VIEW vw_parking_history AS
SELECT
  uuid_generate_v5(uuid_ns_url(), o.est_id::text || '-' || o.pla_numero::text || '-' || to_char(o.ocu_fh_entrada, 'YYYYMMDDHH24MISSMS')) AS id,
  o.est_id,
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  o.ocu_fh_salida AS exit_time,
  (EXTRACT(EPOCH FROM (o.ocu_fh_salida - o.ocu_fh_entrada)) * 1000)::bigint AS duration,
  COALESCE(p.pag_monto::double precision, 0) AS fee,
  p.mepa_metodo AS payment_method,
  NULL::uuid AS user_id,
  o.ocu_fh_salida AS created_at
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
LEFT JOIN pagos p ON p.pag_nro = o.pag_nro
WHERE o.ocu_fh_salida IS NOT NULL;

-- 4. Vista de historial en español (sin SECURITY DEFINER)
CREATE VIEW vw_historial_estacionamiento AS
SELECT
  o.est_id,
  uuid_generate_v5(uuid_ns_url(), o.est_id::text || '-' || o.pla_numero::text || '-' || to_char(o.ocu_fh_entrada, 'YYYYMMDDHH24MISSMS')) AS id,
  v.veh_patente AS license_plate,
  CASE v.catv_segmento
    WHEN 'AUT' THEN 'Auto'
    WHEN 'MOT' THEN 'Moto'
    WHEN 'CAM' THEN 'Camioneta'
    ELSE 'Auto'
  END AS type,
  o.ocu_fh_entrada AS entry_time,
  o.ocu_fh_salida AS exit_time,
  (EXTRACT(EPOCH FROM (o.ocu_fh_salida - o.ocu_fh_entrada)) * 1000)::bigint AS duration,
  COALESCE(p.pag_monto::double precision, 0) AS fee,
  p.mepa_metodo AS payment_method,
  o.ocu_fh_salida AS created_at
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
LEFT JOIN pagos p ON p.pag_nro = o.pag_nro
WHERE o.ocu_fh_salida IS NOT NULL;

-- 5. Vista de zonas con capacidad (sin SECURITY DEFINER)
CREATE VIEW vw_zonas_con_capacidad AS
SELECT
  z.zona_nombre,
  z.zona_id,
  z.est_id,
  COUNT(o.ocu_id) as ocupadas,
  COALESCE(SUM(zc.capacidad), 0) as capacidad_total,
  COALESCE(SUM(zc.capacidad), 0) - COUNT(o.ocu_id) as disponibles
FROM zonas z
LEFT JOIN zona_capacidad zc ON z.zona_id = zc.zona_id
LEFT JOIN plazas p ON p.zona_id = z.zona_id AND p.est_id = z.est_id
LEFT JOIN ocupacion o ON o.pla_numero = p.pla_numero
  AND o.est_id = p.est_id
  AND o.ocu_fh_salida IS NULL
GROUP BY z.zona_nombre, z.zona_id, z.est_id;

-- Comentarios explicativos
COMMENT ON VIEW vw_ocupacion_actual IS 'Vista de vehículos actualmente estacionados - SIN SECURITY DEFINER para correcto aislamiento por estacionamiento';
COMMENT ON VIEW vw_parked_vehicles IS 'Vista de vehículos estacionados para API - SIN SECURITY DEFINER';
COMMENT ON VIEW vw_parking_history IS 'Vista de historial de estacionamiento - SIN SECURITY DEFINER';
COMMENT ON VIEW vw_historial_estacionamiento IS 'Vista de historial en español - SIN SECURITY DEFINER';
COMMENT ON VIEW vw_zonas_con_capacidad IS 'Vista de capacidad por zonas - SIN SECURITY DEFINER';

-- Verificar que las vistas no tienen SECURITY DEFINER
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname IN ('vw_ocupacion_actual', 'vw_parked_vehicles', 'vw_parking_history', 'vw_historial_estacionamiento', 'vw_zonas_con_capacidad')
AND schemaname = 'public';
