-- CORRECCIÓN: Arreglar función auth.email() inexistente en políticas RLS
-- Problema: Las políticas RLS están usando auth.email() que no existe en Supabase
-- Solución: Usar auth.jwt() ->> 'email' en su lugar

-- =====================================================
-- 1. ELIMINAR POLÍTICAS CON auth.email() INCORRECTO
-- =====================================================

-- Eliminar políticas defectuosas de estacionamientos
DROP POLICY IF EXISTS "estacionamientos_authenticated_insert" ON public.estacionamientos;
DROP POLICY IF EXISTS "estacionamientos_authenticated_select" ON public.estacionamientos;
DROP POLICY IF EXISTS "estacionamientos_authenticated_update" ON public.estacionamientos;

-- Eliminar políticas defectuosas de plazas
DROP POLICY IF EXISTS "plazas_authenticated_insert" ON public.plazas;
DROP POLICY IF EXISTS "plazas_authenticated_select" ON public.plazas;
DROP POLICY IF EXISTS "plazas_authenticated_update" ON public.plazas;

-- =====================================================
-- 2. CREAR POLÍTICAS CORREGIDAS PARA estacionamientos
-- =====================================================

-- Política para INSERT en estacionamientos (authenticated)
CREATE POLICY "estacionamientos_authenticated_insert" ON public.estacionamientos
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    );

-- Política para SELECT en estacionamientos (authenticated)
CREATE POLICY "estacionamientos_authenticated_select" ON public.estacionamientos
    FOR SELECT
    USING (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    );

-- Política para UPDATE en estacionamientos (authenticated)
CREATE POLICY "estacionamientos_authenticated_update" ON public.estacionamientos
    FOR UPDATE
    USING (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    )
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    );

-- =====================================================
-- 3. CREAR POLÍTICAS CORREGIDAS PARA plazas
-- =====================================================

-- Política para INSERT en plazas (authenticated)
CREATE POLICY "plazas_authenticated_insert" ON public.plazas
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        pla_est_id IN (
            SELECT est_id FROM public.estacionamientos
            WHERE due_id IN (
                SELECT usu_id FROM public.usuario
                WHERE usu_email = (select auth.jwt() ->> 'email')
            )
        )
    );

-- Política para SELECT en plazas (authenticated)
CREATE POLICY "plazas_authenticated_select" ON public.plazas
    FOR SELECT
    USING (
        (select auth.uid()) IS NOT NULL AND
        pla_est_id IN (
            SELECT est_id FROM public.estacionamientos
            WHERE due_id IN (
                SELECT usu_id FROM public.usuario
                WHERE usu_email = (select auth.jwt() ->> 'email')
            )
        )
    );

-- Política para UPDATE en plazas (authenticated)
CREATE POLICY "plazas_authenticated_update" ON public.plazas
    FOR UPDATE
    USING (
        (select auth.uid()) IS NOT NULL AND
        pla_est_id IN (
            SELECT est_id FROM public.estacionamientos
            WHERE due_id IN (
                SELECT usu_id FROM public.usuario
                WHERE usu_email = (select auth.jwt() ->> 'email')
            )
        )
    )
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        pla_est_id IN (
            SELECT est_id FROM public.estacionamientos
            WHERE due_id IN (
                SELECT usu_id FROM public.usuario
                WHERE usu_email = (select auth.jwt() ->> 'email')
            )
        )
    );

-- =====================================================
-- 4. CREAR POLÍTICAS PARA tablas relacionadas faltantes
-- =====================================================

-- Política para usuario (authenticated)
DROP POLICY IF EXISTS "Users can insert their own user record during setup" ON public.usuario;
DROP POLICY IF EXISTS "Users can view their own user record" ON public.usuario;

CREATE POLICY "usuario_authenticated_insert" ON public.usuario
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        usu_email = (select auth.jwt() ->> 'email')
    );

CREATE POLICY "usuario_authenticated_select" ON public.usuario
    FOR SELECT
    USING (
        (select auth.uid()) IS NOT NULL AND
        usu_email = (select auth.jwt() ->> 'email')
    );

CREATE POLICY "usuario_authenticated_update" ON public.usuario
    FOR UPDATE
    USING (
        (select auth.uid()) IS NOT NULL AND
        usu_email = (select auth.jwt() ->> 'email')
    )
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        usu_email = (select auth.jwt() ->> 'email')
    );

-- Política para dueno (authenticated)
CREATE POLICY "dueno_authenticated_all" ON public.dueno
    FOR ALL
    USING (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    )
    WITH CHECK (
        (select auth.uid()) IS NOT NULL AND
        due_id IN (
            SELECT usu_id FROM public.usuario
            WHERE usu_email = (select auth.jwt() ->> 'email')
        )
    );

-- =====================================================
-- 5. VERIFICACIÓN DE POLÍTICAS
-- =====================================================

-- Verificar que las políticas se crearon correctamente
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('estacionamientos', 'plazas', 'usuario', 'dueno')
ORDER BY tablename, policyname;

-- =====================================================
-- 6. COMENTARIOS DE LA CORRECCIÓN
-- =====================================================

/*
CORRECCIÓN DE FUNCIONES AUTH INCORRECTAS:

PROBLEMA ANTERIOR:
- Uso de auth.email() que NO existe en Supabase
- Políticas RLS fallando silenciosamente
- Errores 400 en creación de estacionamientos

SOLUCIÓN IMPLEMENTADA:
- Reemplazar auth.email() con auth.jwt() ->> 'email'
- Crear políticas específicas para usuario y dueno
- Asegurar que todas las consultas usen sintaxis correcta

FUNCIONES AUTH DISPONIBLES EN SUPABASE:
- auth.uid() - ID del usuario autenticado
- auth.jwt() - Token JWT completo
- auth.jwt() ->> 'email' - Email del usuario desde JWT
- auth.jwt() ->> 'sub' - Subject (normalmente el UID)

BENEFICIOS:
- ✅ Políticas RLS funcionando correctamente
- ✅ Seguridad mejorada con aislamiento de datos
- ✅ Creación de estacionamientos funcionando
- ✅ Consultas optimizadas
*/
