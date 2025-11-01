-- Migración: Crear función get_conductor_reservas
-- Fecha: 2025-01-28
-- Descripción: Función para obtener reservas de un conductor con todos los datos relacionados

-- Eliminar función si existe (para poder recrearla con tipos correctos)
DROP FUNCTION IF EXISTS get_conductor_reservas(integer);

CREATE OR REPLACE FUNCTION get_conductor_reservas(p_conductor_id integer)
RETURNS TABLE (
    est_id integer,
    pla_numero integer,
    veh_patente text,
    res_fh_ingreso timestamp,
    res_fh_fin timestamp,
    con_id integer,
    pag_nro integer,
    res_estado character varying(50),
    res_monto real,
    res_tiempo_gracia_min integer,
    res_created_at timestamp,
    res_codigo character varying,
    metodo_pago character varying,
    payment_info jsonb,
    estacionamiento jsonb,
    plaza jsonb,
    vehiculo jsonb,
    conductor jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.est_id,
        r.pla_numero,
        r.veh_patente,
        r.res_fh_ingreso,
        r.res_fh_fin,
        r.con_id,
        r.pag_nro,
        r.res_estado,
        r.res_monto,
        r.res_tiempo_gracia_min,
        r.res_created_at,
        r.res_codigo,
        COALESCE(r.metodo_pago, 'transferencia')::character varying as metodo_pago,
        r.payment_info,
        -- Estacionamiento como objeto JSON
        jsonb_build_object(
            'est_nombre', COALESCE(e.est_nombre, 'N/A'),
            'est_direc', COALESCE(e.est_direc, 'N/A'),
            'est_telefono', COALESCE(e.est_telefono, ''),
            'est_email', COALESCE(e.est_email, '')
        ) as estacionamiento,
        -- Plaza como objeto JSON
        jsonb_build_object(
            'pla_zona', COALESCE(p.pla_zona, 'N/A'),
            'catv_segmento', COALESCE(p.catv_segmento, 'N/A')
        ) as plaza,
        -- Vehículo como objeto JSON
        jsonb_build_object(
            'veh_marca', COALESCE(v.veh_marca, 'N/A'),
            'veh_modelo', COALESCE(v.veh_modelo, 'N/A'),
            'veh_color', COALESCE(v.veh_color, 'N/A')
        ) as vehiculo,
        -- Conductor como objeto JSON
        jsonb_build_object(
            'usu_nom', COALESCE(u.usu_nom, 'N/A'),
            'usu_ape', COALESCE(u.usu_ape, 'N/A'),
            'usu_tel', COALESCE(u.usu_tel, ''),
            'usu_email', COALESCE(u.usu_email, 'N/A')
        ) as conductor
    FROM reservas r
    LEFT JOIN estacionamientos e ON r.est_id = e.est_id
    LEFT JOIN plazas p ON r.est_id = p.est_id AND r.pla_numero = p.pla_numero
    LEFT JOIN vehiculos v ON r.veh_patente = v.veh_patente
    LEFT JOIN usuario u ON r.con_id = u.usu_id
    WHERE r.con_id = p_conductor_id
    ORDER BY r.res_fh_ingreso DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comentario para documentación
COMMENT ON FUNCTION get_conductor_reservas(integer) IS 'Obtiene todas las reservas de un conductor con datos relacionados (estacionamiento, plaza, vehículo, conductor) en formato JSON estructurado';

