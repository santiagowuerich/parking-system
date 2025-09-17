-- Migración para corregir la visualización de campos del estacionamiento
-- Incluye est_prov, est_locali, est_horario_funcionamiento, est_tolerancia_min

-- Actualizar la función RPC para incluir todos los campos necesarios
CREATE OR REPLACE FUNCTION list_user_parkings(p_user_email TEXT)
RETURNS TABLE (
    est_id INTEGER,
    est_nombre VARCHAR(80),
    est_prov VARCHAR(50),
    est_locali VARCHAR(50),
    est_direc VARCHAR(120),
    est_capacidad INTEGER,
    est_horario_funcionamiento INTEGER,
    est_tolerancia_min INTEGER,
    plazas_total INTEGER,
    plazas_ocupadas INTEGER,
    plazas_libres INTEGER,
    ingreso_hoy NUMERIC,
    vehiculos_activos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id INTEGER;
BEGIN
    -- Obtener ID del usuario
    SELECT usu_id INTO v_usuario_id
    FROM usuario
    WHERE usu_email = p_user_email;

    IF v_usuario_id IS NULL THEN
        RETURN;
    END IF;

    -- Retornar datos agregados de estacionamientos con métricas
    RETURN QUERY
    SELECT
        e.est_id,
        e.est_nombre,
        e.est_prov,
        e.est_locali,
        e.est_direc,
        e.est_capacidad,
        e.est_horario_funcionamiento,
        e.est_tolerancia_min,
        -- Conteos de plazas
        COUNT(p.pla_numero)::INTEGER as plazas_total,
        COUNT(CASE WHEN p.pla_estado = 'Ocupada' THEN 1 END)::INTEGER as plazas_ocupadas,
        COUNT(CASE WHEN p.pla_estado = 'Libre' THEN 1 END)::INTEGER as plazas_libres,
        -- Ingreso del día (placeholder por ahora)
        0::NUMERIC as ingreso_hoy,
        -- Vehículos activos (usando la vista existente)
        COUNT(DISTINCT vw.license_plate)::INTEGER as vehiculos_activos
    FROM estacionamientos e
    LEFT JOIN plazas p ON e.est_id = p.est_id
    LEFT JOIN vw_ocupacion_actual vw ON e.est_id = vw.est_id
    WHERE e.due_id = v_usuario_id
    GROUP BY e.est_id, e.est_nombre, e.est_prov, e.est_locali, e.est_direc, e.est_capacidad, e.est_horario_funcionamiento, e.est_tolerancia_min
    ORDER BY e.est_id;
END;
$$;

-- Comentario: Esta migración corrige el problema donde la dirección del estacionamiento
-- no aparecía arriba de "0 disponibles" y las horas de funcionamiento no mostraban
-- el valor predeterminado de 24 horas, ya que la función RPC no estaba devolviendo
-- todos los campos necesarios del estacionamiento.
