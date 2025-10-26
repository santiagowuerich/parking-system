-- Migración: Actualizar vista vw_ocupacion_actual
-- Fecha: 2025-01-27
-- Descripción: Agregar campo res_codigo a la vista de ocupación actual

-- Actualizar vista para incluir res_codigo
CREATE OR REPLACE VIEW vw_ocupacion_actual AS
SELECT 
    o.ocu_id,
    o.est_id,
    o.veh_patente as license_plate,
    o.ocu_fh_entrada as entry_time,
    o.pla_numero as plaza_number,
    o.ocu_duracion_tipo,
    o.ocu_precio_acordado,
    o.ocu_fecha_limite,
    o.res_codigo,
    v.catv_segmento as vehicle_type
FROM ocupacion o
LEFT JOIN vehiculos v ON o.veh_patente = v.veh_patente
WHERE o.ocu_fh_salida IS NULL;
