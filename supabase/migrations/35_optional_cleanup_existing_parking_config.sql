-- Migración opcional: Limpiar configuración de estacionamientos existentes
-- Esta migración es OPCIONAL y solo debe ejecutarse si se quiere limpiar
-- estacionamientos existentes que tengan plazas predeterminadas automáticas

-- =====================================================
-- ATENCIÓN: ESTA MIGRACIÓN ES OPCIONAL
-- =====================================================

/*
Esta migración está diseñada para limpiar estacionamientos existentes que puedan
tener plazas predeterminadas creadas automáticamente por el sistema anterior.

SOLO EJECUTAR SI:
1. Quieres limpiar estacionamientos existentes
2. Estás seguro de que las plazas existentes son automáticas y no reales
3. Has hecho backup de la base de datos

Si no estás seguro, NO ejecutes esta migración.
*/

-- =====================================================
-- 1. IDENTIFICAR ESTACIONAMIENTOS CON PLAZAS PREDERMINADAS
-- =====================================================

-- Crear una tabla temporal para identificar plazas que parecen ser predeterminadas
CREATE TEMP TABLE temp_default_plazas AS
SELECT
    p.est_id,
    p.pla_numero,
    p.catv_segmento,
    COUNT(*) OVER (PARTITION BY p.est_id) as total_plazas_est
FROM public.plazas p
WHERE
    -- Patrón típico de plazas predeterminadas:
    -- 3 plazas con números 1, 2, 3 y segmentos AUT, MOT, CAM
    (p.pla_numero IN (1, 2, 3) AND p.catv_segmento IN ('AUT', 'MOT', 'CAM'))
    -- Y no tienen zona asignada (típico de plazas automáticas)
    AND p.pla_zona IS NULL;

-- =====================================================
-- 2. ACTUALIZAR CAPACIDAD DE ESTACIONAMIENTOS
-- =====================================================

-- Actualizar estacionamientos que solo tienen plazas predeterminadas
UPDATE public.estacionamientos
SET
    est_capacidad = 0,
    est_cantidad_espacios_disponibles = 0
WHERE est_id IN (
    SELECT DISTINCT est_id
    FROM temp_default_plazas
    WHERE total_plazas_est = 3  -- Solo si tiene exactamente las 3 plazas predeterminadas
);

-- =====================================================
-- 3. LIMPIAR PLAZAS PREDERMINADAS (OPCIONAL - DESCOMENTAR SI SE QUIERE)
-- =====================================================

/*
-- DESCOMENTAR LAS SIGUIENTES LÍNEAS SOLO SI QUIERES ELIMINAR LAS PLAZAS PREDERMINADAS

-- Eliminar plazas que parecen ser predeterminadas
DELETE FROM public.plazas
WHERE (est_id, pla_numero, catv_segmento) IN (
    SELECT est_id, pla_numero, catv_segmento
    FROM temp_default_plazas
    WHERE total_plazas_est = 3
);

-- Actualizar secuencia de números de plaza si es necesario
-- (Esto depende de cómo manejes los números de plaza en tu aplicación)
*/

-- =====================================================
-- 4. VERIFICACIÓN
-- =====================================================

-- Mostrar resumen de cambios
SELECT
    'Estacionamientos actualizados a capacidad 0' as descripcion,
    COUNT(*) as cantidad
FROM public.estacionamientos
WHERE est_capacidad = 0;

-- Mostrar plazas que serían eliminadas (sin eliminarlas realmente)
SELECT
    'Plazas identificadas como predeterminadas' as descripcion,
    COUNT(*) as cantidad,
    STRING_AGG(DISTINCT est_id::text, ', ') as estacionamientos_afectados
FROM temp_default_plazas;

-- =====================================================
-- 5. LIMPIEZA
-- =====================================================

-- Limpiar tabla temporal
DROP TABLE temp_default_plazas;

-- =====================================================
-- 6. COMENTARIOS FINALES
-- =====================================================

/*
RESULTADO ESPERADO:
- Estacionamientos existentes tendrán capacidad = 0
- Las plazas predeterminadas siguen existiendo pero no afectan la capacidad
- Nuevos estacionamientos se crearán sin plazas predeterminadas
- Los usuarios deben crear plazas manualmente desde el Panel de Administrador

NOTA IMPORTANTE:
Esta migración NO elimina las plazas existentes por seguridad.
Si quieres eliminarlas completamente, descomenta las líneas correspondientes.
*/






