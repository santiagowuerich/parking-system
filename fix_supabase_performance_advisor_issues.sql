-- Script para corregir advertencias del Performance Advisor de Supabase
-- Corrige problemas de 'auth_rls_initplan' y 'multiple_permissive_policies'

-------------------------------------------------
-- TABLA: public.user_roles
-------------------------------------------------
-- Problema: auth_rls_initplan en user_roles_admin_policy y user_roles_self_view_policy
-- Problema: multiple_permissive_policies para SELECT (authenticated, anon, etc.)

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "user_roles_admin_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self_view_policy" ON public.user_roles;

-- Nueva política SELECT consolidada para user_roles
CREATE POLICY "user_roles_select_consolidated" ON public.user_roles
FOR SELECT
USING (
    ((SELECT auth.uid()) = user_id) -- El usuario puede ver su propio rol
    OR 
    EXISTS ( -- Un administrador puede ver todos los roles
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-- Nueva política FOR ALL (INSERT, UPDATE, DELETE) para user_roles (solo para admins)
CREATE POLICY "user_roles_modify_admins" ON public.user_roles
FOR ALL -- Solo los administradores pueden modificar roles
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-------------------------------------------------
-- TABLA: public.tariffs
-------------------------------------------------
-- Problema: auth_rls_initplan en tariffs_modify_policy
-- Problema: multiple_permissive_policies para SELECT (authenticated)

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "tariffs_select_policy" ON public.tariffs;
DROP POLICY IF EXISTS "tariffs_modify_policy" ON public.tariffs;
DROP POLICY IF EXISTS "tariffs_anon_select_policy" ON public.tariffs; -- Si existiera

-- Nueva política SELECT para tariffs (pública para lectura)
CREATE POLICY "tariffs_select_public" ON public.tariffs
FOR SELECT
USING (true);

-- Nueva política MODIFY para tariffs (solo admins)
CREATE POLICY "tariffs_modify_admins" ON public.tariffs
FOR ALL -- INSERT, UPDATE, DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-------------------------------------------------
-- TABLA: public.rates
-------------------------------------------------
-- Problema: auth_rls_initplan en rates_modify_policy
-- Problema: multiple_permissive_policies para SELECT (authenticated)

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "rates_select_policy" ON public.rates;
DROP POLICY IF EXISTS "rates_modify_policy" ON public.rates;
DROP POLICY IF EXISTS "rates_anon_select_policy" ON public.rates; -- Si existiera

-- Nueva política SELECT para rates (pública para lectura)
CREATE POLICY "rates_select_public" ON public.rates
FOR SELECT
USING (true);

-- Nueva política MODIFY para rates (solo admins)
CREATE POLICY "rates_modify_admins" ON public.rates
FOR ALL -- INSERT, UPDATE, DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-------------------------------------------------
-- TABLA: public.admins (asumiendo que esta tabla es para datos de administradores, no la de auth.users)
-------------------------------------------------
-- Problema: auth_rls_initplan en admins_modify_policy y admins_select_policy
-- Problema: multiple_permissive_policies para SELECT (authenticated)

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "admins_select_policy" ON public.admins;
DROP POLICY IF EXISTS "admins_modify_policy" ON public.admins;

-- Nueva política SELECT para admins (solo admins pueden ver datos de la tabla admins)
CREATE POLICY "admins_select_admins_only" ON public.admins
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-- Nueva política MODIFY para admins (solo admins pueden modificar datos de la tabla admins)
CREATE POLICY "admins_modify_admins_only" ON public.admins
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-------------------------------------------------
-- TABLA: public.vehicles
-------------------------------------------------
-- Problema: multiple_permissive_policies para SELECT (authenticated)
-- Se asume que las llamadas a auth.uid() ya están optimizadas si no aparecen en 'auth_rls_initplan' para esta tabla.

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "vehicles_select_policy" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_modify_policy" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_admin_select_policy" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_admin_modify_policy" ON public.vehicles;

-- Nueva política SELECT para vehicles (usuarios ven los suyos, admins ven todos)
CREATE POLICY "vehicles_select_consolidated" ON public.vehicles
FOR SELECT
TO authenticated
USING (
    ((SELECT auth.uid()) = user_id) 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-- Nueva política MODIFY para vehicles (usuarios modifican los suyos, admins modifican todos)
-- Separaremos INSERT, UPDATE, DELETE para mayor claridad si es necesario, pero FOR ALL es común.
CREATE POLICY "vehicles_modify_consolidated" ON public.vehicles
FOR ALL -- INSERT, UPDATE, DELETE
TO authenticated
USING (
    ((SELECT auth.uid()) = user_id) 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    ((SELECT auth.uid()) = user_id) 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-------------------------------------------------
-- TABLA: public.configuration
-------------------------------------------------
-- Problema: multiple_permissive_policies para SELECT (authenticated)
-- Asumo que 'configuration_authenticated_modify' era una política FOR ALL
-- y 'configuration_authenticated_select_consolidated' era una política FOR SELECT.
-- Si ambas aplicaban a SELECT para 'authenticated', necesitan consolidación.

-- Eliminar políticas antiguas si es necesario (basado en nombres de tu archivo 'problemas-json')
DROP POLICY IF EXISTS "configuration_authenticated_modify" ON public.configuration;
DROP POLICY IF EXISTS "configuration_authenticated_select_consolidated" ON public.configuration;
-- También las otras variantes si existían (anon, authenticator, dashboard_user) del script anterior.
DROP POLICY IF EXISTS "configuration_anon_select_consolidated" ON public.configuration;
DROP POLICY IF EXISTS "configuration_authenticator_select_consolidated" ON public.configuration;
DROP POLICY IF EXISTS "configuration_dashboard_user_select_consolidated" ON public.configuration;


-- Nueva política SELECT para configuration (ejemplo: permitir a autenticados y anónimos leer)
-- Ajusta los roles según tus necesidades reales para esta tabla.
CREATE POLICY "configuration_select_main" ON public.configuration
FOR SELECT
USING (
    (SELECT auth.role()) IN ('authenticated', 'anon') -- O especifica los roles que realmente necesitan leer
);

-- Nueva política MODIFY para configuration (ejemplo: solo admins pueden modificar)
CREATE POLICY "configuration_modify_admins" ON public.configuration
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (SELECT auth.uid()) AND is_admin = true
    )
);

-- Nota final:
-- Este script asume que la tabla 'public.user_roles' existe y está configurada
-- como en 'habilitar_rls_corregido_v3.sql'.
-- Todas las llamadas a auth.uid() y auth.role() han sido envueltas en (SELECT ...).
-- Es crucial probar estos cambios en un entorno de desarrollo antes de aplicarlos a producción. 