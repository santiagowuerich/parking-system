-- Verificación específica de asignaciones de empleados a estacionamientos
-- Ejecutar en SQL Editor de Supabase

-- 1. Ver empleados asignados por estacionamiento
SELECT
    'EMPLEADOS_POR_ESTACIONAMIENTO' as consulta,
    e.est_id,
    e.est_nombre,
    e.est_locali,
    COUNT(ee.play_id) as total_empleados,
    STRING_AGG(
        u.usu_nom || ' ' || u.usu_ape || ' (' || u.usu_email || ')',
        ' | '
    ) as empleados_detalle
FROM estacionamientos e
LEFT JOIN empleados_estacionamiento ee ON e.est_id = ee.est_id AND ee.activo = true
LEFT JOIN playeros p ON ee.play_id = p.play_id
LEFT JOIN usuario u ON p.play_id = u.usu_id
GROUP BY e.est_id, e.est_nombre, e.est_locali
ORDER BY e.est_id;

-- 2. Ver asignaciones detalladas con estado
SELECT
    'ASIGNACIONES_DETALLADAS' as consulta,
    ee.play_id,
    ee.est_id,
    ee.fecha_asignacion,
    ee.activo,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    u.usu_estado,
    e.est_nombre,
    e.est_locali,
    CASE
        WHEN ee.activo = true THEN '✅ Activo'
        ELSE '❌ Inactivo'
    END as estado_asignacion,
    EXTRACT(DAY FROM (NOW() - ee.fecha_asignacion)) as dias_desde_asignacion
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
ORDER BY ee.activo DESC, ee.fecha_asignacion DESC;

-- 3. Ver empleados SIN asignación activa
SELECT
    'EMPLEADOS_SIN_ASIGNACION_ACTIVA' as consulta,
    u.usu_id,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    u.usu_estado,
    u.usu_fechareg,
    CASE
        WHEN ee.play_id IS NULL THEN 'Nunca asignado'
        ELSE 'Asignación inactiva'
    END as estado_asignacion,
    MAX(ee.fecha_asignacion) as ultima_asignacion
FROM usuario u
JOIN playeros p ON u.usu_id = p.play_id
LEFT JOIN empleados_estacionamiento ee ON p.play_id = ee.play_id
GROUP BY u.usu_id, u.usu_nom, u.usu_ape, u.usu_email, u.usu_estado, u.usu_fechareg, ee.play_id
HAVING ee.activo IS NULL OR ee.activo = false
ORDER BY u.usu_fechareg DESC;

-- 4. Ver empleados MULTI-ASIGNADOS (trabajan en varios estacionamientos)
SELECT
    'EMPLEADOS_MULTI_ASIGNADOS' as consulta,
    u.usu_id,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    COUNT(DISTINCT ee.est_id) as estacionamientos_asignados,
    STRING_AGG(
        e.est_nombre || ' (' || CASE WHEN ee.activo THEN 'Activo' ELSE 'Inactivo' END || ')',
        ' | '
    ) as estacionamientos,
    MIN(ee.fecha_asignacion) as primera_asignacion,
    MAX(ee.fecha_asignacion) as ultima_asignacion
FROM usuario u
JOIN playeros p ON u.usu_id = p.play_id
JOIN empleados_estacionamiento ee ON p.play_id = ee.play_id
JOIN estacionamientos e ON ee.est_id = e.est_id
GROUP BY u.usu_id, u.usu_nom, u.usu_ape, u.usu_email
HAVING COUNT(DISTINCT ee.est_id) > 1
ORDER BY estacionamientos_asignados DESC;

-- 5. Simular consulta del dashboard (por estacionamiento específico)
-- Reemplaza ? por el ID del estacionamiento que quieres consultar
SELECT
    'SIMULACION_DASHBOARD_EST_?' as consulta,
    u.usu_id,
    u.usu_nom as nombre,
    u.usu_ape as apellido,
    u.usu_dni as dni,
    u.usu_email as email,
    u.usu_estado as estado,
    u.requiere_cambio_contrasena,
    e.est_id,
    e.est_nombre,
    e.est_locali,
    ee.fecha_asignacion,
    ee.activo,
    -- Disponibilidad del empleado
    (
        SELECT json_agg(
            json_build_object(
                'dia_semana', de.dia_semana,
                'turno', tc.nombre_turno,
                'turno_id', de.turno_id
            )
        )
        FROM disponibilidad_empleado de
        JOIN turnos_catalogo tc ON de.turno_id = tc.turno_id
        WHERE de.play_id = u.usu_id
    ) as disponibilidad
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE ee.activo = true
  AND ee.est_id = 4  -- ⚠️ CAMBIA ESTE ID según el estacionamiento que quieres consultar
ORDER BY u.usu_nom, u.usu_ape;

-- 6. Verificar que los índices están creados
SELECT
    'INDICES_CREADOS' as consulta,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('empleados_estacionamiento', 'disponibilidad_empleado', 'usuario', 'playeros')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. Verificar estructura de tablas
SELECT
    'ESTRUCTURA_TABLAS' as consulta,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    pgd.description as column_comment
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
LEFT JOIN pg_catalog.pg_description pgd ON (
    pgd.objoid = (SELECT oid FROM pg_catalog.pg_class WHERE relname = t.table_name)
    AND pgd.objsubid = c.ordinal_position
)
WHERE t.table_schema = 'public'
  AND t.table_name IN ('usuario', 'playeros', 'empleados_estacionamiento', 'disponibilidad_empleado', 'turnos_catalogo')
ORDER BY t.table_name, c.ordinal_position;

-- 8. Contar registros por tabla
SELECT
    'ESTADISTICAS_TABLAS' as consulta,
    'usuario' as tabla,
    COUNT(*) as registros
FROM usuario
UNION ALL
SELECT
    'playeros' as tabla,
    COUNT(*) as registros
FROM playeros
UNION ALL
SELECT
    'empleados_estacionamiento' as tabla,
    COUNT(*) as registros
FROM empleados_estacionamiento
UNION ALL
SELECT
    'empleados_estacionamiento_activos' as tabla,
    COUNT(*) as registros
FROM empleados_estacionamiento
WHERE activo = true
UNION ALL
SELECT
    'disponibilidad_empleado' as tabla,
    COUNT(*) as registros
FROM disponibilidad_empleado
UNION ALL
SELECT
    'turnos_catalogo' as tabla,
    COUNT(*) as registros
FROM turnos_catalogo
UNION ALL
SELECT
    'estacionamientos' as tabla,
    COUNT(*) as registros
FROM estacionamientos;

-- 9. Verificar integridad referencial
SELECT
    'INTEGRIDAD_REFERENCIAL' as consulta,
    'Empleados sin usuario' as problema,
    COUNT(*) as cantidad
FROM playeros p
LEFT JOIN usuario u ON p.play_id = u.usu_id
WHERE u.usu_id IS NULL
UNION ALL
SELECT
    'Asignaciones sin empleado' as problema,
    COUNT(*) as cantidad
FROM empleados_estacionamiento ee
LEFT JOIN playeros p ON ee.play_id = p.play_id
WHERE p.play_id IS NULL
UNION ALL
SELECT
    'Asignaciones sin estacionamiento' as problema,
    COUNT(*) as cantidad
FROM empleados_estacionamiento ee
LEFT JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE e.est_id IS NULL
UNION ALL
SELECT
    'Disponibilidad sin empleado' as problema,
    COUNT(*) as cantidad
FROM disponibilidad_empleado de
LEFT JOIN playeros p ON de.play_id = p.play_id
WHERE p.play_id IS NULL
UNION ALL
SELECT
    'Disponibilidad sin turno' as problema,
    COUNT(*) as cantidad
FROM disponibilidad_empleado de
LEFT JOIN turnos_catalogo tc ON de.turno_id = tc.turno_id
WHERE tc.turno_id IS NULL;
