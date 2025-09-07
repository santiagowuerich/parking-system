-- Fix Auth RLS Initialization Plan Performance Issues
-- Problema: Las políticas RLS re-evalúan auth.<function>() para cada fila
-- Solución: Usar (select auth.<function>()) para optimizar el rendimiento

-- =====================================================
-- 1. ARREGLAR POLÍTICAS DE user_settings
-- =====================================================

-- Primero, eliminar las políticas existentes problemáticas
DROP POLICY IF EXISTS "Users can insert their settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view their settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their settings" ON public.user_settings;

-- Recrear las políticas con la optimización de rendimiento
-- Usar (select auth.uid()) en lugar de auth.uid() para evitar re-evaluación por fila
CREATE POLICY "Users can insert their settings" ON public.user_settings
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = user_id
    );

CREATE POLICY "Users can view their settings" ON public.user_settings
    FOR SELECT
    USING (
        (select auth.uid()) = user_id
    );

CREATE POLICY "Users can update their settings" ON public.user_settings
    FOR UPDATE
    USING (
        (select auth.uid()) = user_id
    )
    WITH CHECK (
        (select auth.uid()) = user_id
    );

-- =====================================================
-- 2. VERIFICACIÓN
-- =====================================================

-- Verificar que las políticas se crearon correctamente
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_settings'
ORDER BY policyname;

-- =====================================================
-- 3. COMENTARIOS DE LA OPTIMIZACIÓN
-- =====================================================

/*
OPTIMIZACIÓN DE RENDIMIENTO - Auth RLS Initialization Plan:

PROBLEMA ANTERIOR:
- Las políticas usaban auth.uid() directamente
- Esto causaba que PostgreSQL re-evaluara auth.uid() para cada fila
- En consultas con muchas filas, esto generaba overhead significativo

SOLUCIÓN IMPLEMENTADA:
- Cambiar auth.uid() por (select auth.uid())
- Esto permite que PostgreSQL evalúe auth.uid() una sola vez por consulta
- Mejora significativa en el rendimiento, especialmente en tablas grandes

BENEFICIOS:
- ✅ Menor tiempo de ejecución en consultas
- ✅ Mejor escalabilidad
- ✅ Reducción de carga en el servidor
- ✅ Cumplimiento con mejores prácticas de Supabase

FUENTE: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
*/







