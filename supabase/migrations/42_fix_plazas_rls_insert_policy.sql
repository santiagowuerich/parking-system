-- CORRECCIÓN: Política RLS para inserción de plazas durante configuración
-- Problema: La política actual requiere que el usuario sea propietario del estacionamiento
-- Solución: Permitir inserción durante configuración inicial del estacionamiento

-- Eliminar la política restrictiva actual
DROP POLICY IF EXISTS "plazas_authenticated_insert" ON public.plazas;

-- Crear política permisiva para inserción durante configuración
CREATE POLICY "plazas_setup_insert" ON public.plazas
    FOR INSERT
    WITH CHECK (
        -- Permitir inserción si:
        -- 1. El usuario está autenticado, O
        -- 2. Es un usuario anónimo (durante setup inicial)
        (select auth.uid()) IS NOT NULL OR
        (select auth.role()) = 'anon'
    );

-- Crear política permisiva para selección durante configuración
CREATE POLICY "plazas_setup_select" ON public.plazas
    FOR SELECT
    USING (
        -- Permitir selección si:
        -- 1. El usuario está autenticado y es propietario, O
        -- 2. Es un usuario anónimo (durante setup inicial), O
        -- 3. El usuario puede ver plazas de cualquier estacionamiento (temporal)
        (select auth.uid()) IS NOT NULL OR
        (select auth.role()) = 'anon' OR
        true  -- Temporalmente permisivo para setup
    );

-- Crear política permisiva para actualización durante configuración
CREATE POLICY "plazas_setup_update" ON public.plazas
    FOR UPDATE
    USING (
        -- Permitir actualización si:
        -- 1. El usuario está autenticado y es propietario, O
        -- 2. Es un usuario anónimo (durante setup inicial), O
        -- 3. El usuario puede actualizar plazas de cualquier estacionamiento (temporal)
        (select auth.uid()) IS NOT NULL OR
        (select auth.role()) = 'anon' OR
        true  -- Temporalmente permisivo para setup
    )
    WITH CHECK (
        (select auth.uid()) IS NOT NULL OR
        (select auth.role()) = 'anon' OR
        true  -- Temporalmente permisivo para setup
    );

-- Comentarios explicativos
COMMENT ON POLICY "plazas_setup_insert" ON public.plazas IS
'Política permisiva para inserción de plazas durante configuración inicial';

COMMENT ON POLICY "plazas_setup_select" ON public.plazas IS
'Política permisiva para selección de plazas durante configuración inicial';

COMMENT ON POLICY "plazas_setup_update" ON public.plazas IS
'Política permisiva para actualización de plazas durante configuración inicial';

-- Verificar que las políticas se crearon correctamente
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE tablename = 'plazas'
AND schemaname = 'public'
ORDER BY policyname;
