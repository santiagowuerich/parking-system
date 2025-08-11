-- Ajuste de longitud de patentes con manejo de vistas dependientes

-- 1) Dropear vistas dependientes
DROP VIEW IF EXISTS vw_parked_vehicles;
DROP VIEW IF EXISTS vw_parking_history;

-- 2) Eliminar FKs que referencian vehiculos(veh_patente)
ALTER TABLE IF EXISTS pagos DROP CONSTRAINT IF EXISTS fk_pagos_vehiculo;
ALTER TABLE IF EXISTS reservas DROP CONSTRAINT IF EXISTS fk_res_vehiculo;
ALTER TABLE IF EXISTS ocupacion DROP CONSTRAINT IF EXISTS fk_ocu_vehiculo;
ALTER TABLE IF EXISTS vehiculos_abonados DROP CONSTRAINT IF EXISTS fk_va_vehiculo;

-- 3) Cambiar tipos de columnas a TEXT
ALTER TABLE vehiculos ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE pagos ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE reservas ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE ocupacion ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE vehiculos_abonados ALTER COLUMN veh_patente TYPE TEXT;

-- 4) Re-crear FKs
ALTER TABLE pagos
  ADD CONSTRAINT fk_pagos_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE reservas
  ADD CONSTRAINT fk_res_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE ocupacion
  ADD CONSTRAINT fk_ocu_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE vehiculos_abonados
  ADD CONSTRAINT fk_va_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

-- 5) Recrear vistas
CREATE VIEW vw_parked_vehicles AS
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
  NULL::uuid AS user_id
FROM ocupacion o
JOIN vehiculos v ON v.veh_patente = o.veh_patente
WHERE o.ocu_fh_salida IS NULL;

CREATE VIEW vw_parking_history AS
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




