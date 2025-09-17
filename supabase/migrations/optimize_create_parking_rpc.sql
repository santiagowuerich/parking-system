-- Función RPC para listar estacionamientos de usuario con métricas agregadas
-- Reduce múltiples roundtrips a una sola consulta optimizada
CREATE OR REPLACE FUNCTION list_user_parkings(p_user_email TEXT)
RETURNS TABLE (
    est_id INTEGER,
    est_nombre VARCHAR(80),
    est_direc VARCHAR(120),
    est_capacidad INTEGER,
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
        e.est_direc,
        e.est_capacidad,
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
    GROUP BY e.est_id, e.est_nombre, e.est_direc, e.est_capacidad
    ORDER BY e.est_id;
END;
$$;

-- Función RPC para validar y crear estacionamiento en una sola transacción
-- Reduce múltiples roundtrips a una sola llamada
CREATE OR REPLACE FUNCTION create_parking_with_validation(
    p_email TEXT,
    p_name TEXT,
    p_direccion TEXT,
    p_max_parkings INTEGER DEFAULT 5
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usuario_id INTEGER;
    v_next_est_id INTEGER;
    v_current_count INTEGER;
    v_dueno_exists BOOLEAN;
    v_direccion_exists BOOLEAN;
    v_result JSON;
BEGIN
    -- 1. Verificar que el usuario existe y obtener su ID
    SELECT usu_id INTO v_usuario_id
    FROM usuario
    WHERE usu_email = p_email;
    
    IF v_usuario_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuario no encontrado en sistema tradicional',
            'code', 'USER_NOT_FOUND'
        );
    END IF;
    
    -- 2. Verificar que el usuario es dueño
    SELECT EXISTS(
        SELECT 1 FROM dueno WHERE due_id = v_usuario_id
    ) INTO v_dueno_exists;
    
    IF NOT v_dueno_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuario no tiene permisos de dueño',
            'code', 'NOT_OWNER'
        );
    END IF;
    
    -- 3. Verificar dirección única
    SELECT EXISTS(
        SELECT 1 FROM estacionamientos WHERE est_direc = p_direccion
    ) INTO v_direccion_exists;
    
    IF v_direccion_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'La dirección ya está registrada',
            'code', 'DUPLICATE_ADDRESS',
            'details', format('La dirección "%s" ya existe en el sistema', p_direccion)
        );
    END IF;
    
    -- 4. Verificar límite de estacionamientos por usuario
    SELECT COUNT(*) INTO v_current_count
    FROM estacionamientos
    WHERE due_id = v_usuario_id;
    
    IF v_current_count >= p_max_parkings THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Límite de estacionamientos excedido',
            'code', 'LIMIT_EXCEEDED',
            'details', format('Usuario tiene %s estacionamientos (máx: %s)', v_current_count, p_max_parkings),
            'current_count', v_current_count,
            'max_allowed', p_max_parkings
        );
    END IF;
    
    -- 5. Obtener próximo ID disponible (thread-safe)
    SELECT get_next_est_id_v2() INTO v_next_est_id;
    
    -- 6. Crear estacionamiento
    INSERT INTO estacionamientos (
        est_id,
        est_prov,
        est_locali,
        est_direc,
        est_nombre,
        est_capacidad,
        due_id,
        est_cantidad_espacios_disponibles,
        est_horario_funcionamiento,
        est_tolerancia_min
    ) VALUES (
        v_next_est_id,
        'Por configurar',
        'Por configurar',
        p_direccion,
        p_name,
        0,
        v_usuario_id,
        0,
        24,
        15
    );
    
    -- 7. Crear tarifas básicas por defecto
    INSERT INTO tarifas (est_id, tiptar_nro, catv_segmento, tar_f_desde, tar_precio, tar_fraccion)
    VALUES 
        (v_next_est_id, 1, 'AUT', NOW(), 500, 1),
        (v_next_est_id, 1, 'MOT', NOW(), 300, 1),
        (v_next_est_id, 1, 'CAM', NOW(), 700, 1);
    
    -- 8. Configurar métodos de pago aceptados
    INSERT INTO est_acepta_metodospago (est_id, mepa_metodo)
    VALUES 
        (v_next_est_id, 'Efectivo'),
        (v_next_est_id, 'Transferencia'),
        (v_next_est_id, 'MercadoPago');
    
    -- 9. Retornar resultado exitoso
    RETURN json_build_object(
        'success', true,
        'estacionamiento_id', v_next_est_id,
        'usuario_id', v_usuario_id,
        'message', format('Estacionamiento "%s" creado exitosamente', p_name),
        'details', json_build_object(
            'est_id', v_next_est_id,
            'est_nombre', p_name,
            'usuario_id', v_usuario_id,
            'plazas_creadas', 0,
            'tarifas_creadas', 3,
            'metodos_configurados', 3,
            'note', 'Estacionamiento creado sin plazas predeterminadas. Configure las plazas desde el Panel de Administrador.'
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Error interno del servidor',
            'code', 'INTERNAL_ERROR',
            'details', SQLERRM
        );
END;
$$;

-- Función RPC para obtener plantillas con características agrupadas
-- Optimiza el procesamiento moviendo la lógica de agrupamiento a Postgres
CREATE OR REPLACE FUNCTION get_plantillas_agrupadas(p_est_id INTEGER)
RETURNS TABLE (
    plantilla_id INTEGER,
    nombre_plantilla VARCHAR(100),
    catv_segmento CHAR(3),
    est_id INTEGER,
    caracteristicas JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Retornar plantillas con características agrupadas directamente desde SQL
    RETURN QUERY
    SELECT
        p.plantilla_id,
        p.nombre_plantilla,
        p.catv_segmento,
        p.est_id,
        -- Construir JSON con características agrupadas por tipo
        COALESCE(
            (SELECT jsonb_object_agg(tipo, valores)
             FROM (
                 SELECT
                     ct.nombre_tipo as tipo,
                     jsonb_agg(c.valor ORDER BY c.valor) as valores
                 FROM plantilla_caracteristicas pc
                 JOIN caracteristicas c ON pc.caracteristica_id = c.caracteristica_id
                 JOIN caracteristica_tipos ct ON c.tipo_id = ct.tipo_id
                 WHERE pc.plantilla_id = p.plantilla_id
                 GROUP BY ct.nombre_tipo
             ) grouped_types
            ), '{}'::jsonb
        ) as caracteristicas
    FROM plantillas p
    WHERE p.est_id = p_est_id
    ORDER BY p.nombre_plantilla;
END;
$$;

-- Crear índices para mejorar rendimiento de consultas de plantillas
CREATE INDEX IF NOT EXISTS idx_plantillas_est_id ON plantillas(est_id);
CREATE INDEX IF NOT EXISTS idx_plantilla_caracteristicas_plantilla_id ON plantilla_caracteristicas(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_plantilla_caracteristicas_caracteristica_id ON plantilla_caracteristicas(caracteristica_id);
CREATE INDEX IF NOT EXISTS idx_caracteristicas_tipo_id ON caracteristicas(tipo_id);
