-- Asegurar que todos los vehículos existen antes de crear pagos/ocupación

-- Normaliza y carga patentes desde parked_vehicles
INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT TRIM(pv.license_plate) AS veh_patente,
       NULL::INT AS con_id,
       map_tipo_to_segmento(pv.type) AS catv_segmento
FROM parked_vehicles pv
WHERE COALESCE(TRIM(pv.license_plate), '') <> ''
ON CONFLICT (veh_patente) DO NOTHING;

-- Normaliza y carga patentes desde parking_history
INSERT INTO vehiculos (veh_patente, con_id, catv_segmento)
SELECT DISTINCT TRIM(ph.license_plate) AS veh_patente,
       NULL::INT AS con_id,
       map_tipo_to_segmento(ph.type) AS catv_segmento
FROM parking_history ph
WHERE COALESCE(TRIM(ph.license_plate), '') <> ''
ON CONFLICT (veh_patente) DO NOTHING;




