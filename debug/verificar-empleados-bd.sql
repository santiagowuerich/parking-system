-- Script SQL para verificar empleados en la base de datos
-- Ejecutar en el SQL Editor de Supabase

-- 1. Ver empleados asignados a estacionamientos
SELECT
    'EMPLEADOS_ASIGNADOS' as tipo_consulta,
    ee.play_id,
    ee.est_id,
    ee.fecha_asignacion,
    ee.activo,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    u.usu_estado,
    e.est_nombre,
    e.est_locali
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE ee.activo = true
ORDER BY ee.fecha_asignacion DESC;

-- 2. Ver todos los empleados (independientemente de asignación)
SELECT
    'TODOS_LOS_EMPLEADOS' as tipo_consulta,
    u.usu_id,
    u.usu_nom,
    u.usu_ape,
    u.usu_dni,
    u.usu_email,
    u.usu_estado,
    u.usu_fechareg,
    p.play_id,
    'Empleado' as tipo_usuario
FROM usuario u
JOIN playeros p ON u.usu_id = p.play_id
ORDER BY u.usu_fechareg DESC;

-- 3. Ver asignaciones activas detalladas
SELECT
    'ASIGNACIONES_ACTIVAS' as tipo_consulta,
    ee.play_id,
    ee.est_id,
    ee.fecha_asignacion,
    ee.activo,
    u.usu_nom || ' ' || u.usu_ape as nombre_completo,
    u.usu_email,
    u.usu_estado,
    e.est_nombre,
    e.est_locali,
    -- Calcular días desde la asignación
    EXTRACT(DAY FROM (NOW() - ee.fecha_asignacion)) as dias_asignado
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE ee.activo = true
ORDER BY ee.fecha_asignacion DESC;

-- 4. Ver empleados por estacionamiento (útil para dashboard)
SELECT
    'EMPLEADOS_POR_ESTACIONAMIENTO' as tipo_consulta,
    e.est_id,
    e.est_nombre,
    e.est_locali,
    COUNT(ee.play_id) as total_empleados,
    STRING_AGG(u.usu_nom || ' ' || u.usu_ape, ', ') as empleados
FROM estacionamientos e
LEFT JOIN empleados_estacionamiento ee ON e.est_id = ee.est_id AND ee.activo = true
LEFT JOIN playeros p ON ee.play_id = p.play_id
LEFT JOIN usuario u ON p.play_id = u.usu_id
GROUP BY e.est_id, e.est_nombre, e.est_locali
ORDER BY e.est_id;

-- 5. Ver disponibilidad de empleados
SELECT
    'DISPONIBILIDAD_EMPLEADOS' as tipo_consulta,
    u.usu_nom || ' ' || u.usu_ape as nombre_completo,
    u.usu_email,
    CASE de.dia_semana
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
        WHEN 7 THEN 'Domingo'
    END as dia,
    t.nombre_turno as turno,
    de.dia_semana,
    de.turno_id
FROM disponibilidad_empleado de
JOIN playeros p ON de.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN turnos_catalogo t ON de.turno_id = t.turno_id
ORDER BY u.usu_nom, u.usu_ape, de.dia_semana, de.turno_id;

-- 6. Verificar si hay empleados sin asignación activa
SELECT
    'EMPLEADOS_SIN_ASIGNACION_ACTIVA' as tipo_consulta,
    u.usu_id,
    u.usu_nom || ' ' || u.usu_ape as nombre_completo,
    u.usu_email,
    u.usu_estado,
    CASE WHEN ee.play_id IS NULL THEN 'Sin asignación' ELSE 'Con asignación inactiva' END as estado_asignacion
FROM usuario u
JOIN playeros p ON u.usu_id = p.play_id
LEFT JOIN empleados_estacionamiento ee ON p.play_id = ee.play_id AND ee.activo = true
WHERE ee.play_id IS NULL OR ee.activo = false;

-- 7. Resumen general
SELECT
    'RESUMEN_GENERAL' as tipo_consulta,
    (SELECT COUNT(*) FROM usuario WHERE usu_id IN (SELECT play_id FROM playeros)) as total_usuarios_empleados,
    (SELECT COUNT(*) FROM playeros) as total_playeros,
    (SELECT COUNT(*) FROM empleados_estacionamiento WHERE activo = true) as asignaciones_activas,
    (SELECT COUNT(*) FROM empleados_estacionamiento WHERE activo = false) as asignaciones_inactivas,
    (SELECT COUNT(DISTINCT est_id) FROM empleados_estacionamiento WHERE activo = true) as estacionamientos_con_empleados,
    (SELECT COUNT(DISTINCT play_id) FROM empleados_estacionamiento WHERE activo = true) as empleados_asignados;
