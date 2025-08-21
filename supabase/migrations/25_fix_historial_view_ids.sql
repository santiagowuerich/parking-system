-- Arreglar IDs problemáticos en vista del historial
-- Esta migración asegura que todos los registros tengan IDs únicos y válidos

BEGIN;

-- Recrear la vista del historial con mejor manejo de IDs
DROP VIEW IF EXISTS vw_historial_estacionamiento;

CREATE VIEW vw_historial_estacionamiento AS
SELECT
  o.est_id,
  o.ocu_id AS id, -- Usar ocu_id directamente como ID único
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
  COALESCE(p.mepa_metodo, 'No especificado') AS payment_method,
  o.ocu_fh_salida AS created_at
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
LEFT JOIN pagos p ON p.pag_nro = o.pag_nro
WHERE o.ocu_fh_salida IS NOT NULL
  AND o.ocu_id IS NOT NULL; -- Asegurar que solo incluimos registros con ID válido

COMMIT;
