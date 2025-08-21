-- Actualizar vw_ocupacion_actual para incluir plaza_number
-- Esto permite mostrar el número de plaza asignada en el panel de operador

DROP VIEW IF EXISTS vw_ocupacion_actual;

-- Ocupación actual (vehículos estacionados) con plaza_number
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
