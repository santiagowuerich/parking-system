-- Script para consolidar políticas RLS permisivas múltiples
-- Optimización de rendimiento de base de datos PostgreSQL/Supabase

-------------------------------------------------
-- CONSIDERACIONES GENERALES PARA CONSOLIDAR POLÍTICAS PERMISIVAS:
-- 1. Para combinar políticas PERMISSIVE, usamos OR entre las condiciones
-- 2. Las políticas PERMISSIVE se evalúan en modalidad de "cualquiera permite acceso"
-- 3. Primero eliminamos las políticas existentes y luego creamos la consolidada
-------------------------------------------------

-------------------------------------------------
-- 1. TABLA: public.configuration
-------------------------------------------------

-- Consolidar políticas para rol 'anon' y acción 'SELECT'
DROP POLICY IF EXISTS "configuration_modify_policy" ON public.configuration;
DROP POLICY IF EXISTS "configuration_select_policy" ON public.configuration;
CREATE POLICY "configuration_anon_select_consolidated" ON public.configuration
FOR SELECT
TO anon
USING ((SELECT auth.role()) = 'authenticated' OR (SELECT auth.role()) IN ('anon', 'authenticated', 'authenticator', 'dashboard_user'));

-- Consolidar políticas para rol 'authenticated' y acción 'SELECT'
CREATE POLICY "configuration_authenticated_select_consolidated" ON public.configuration
FOR SELECT
TO authenticated
USING ((SELECT auth.role()) = 'authenticated' OR (SELECT auth.role()) IN ('anon', 'authenticated', 'authenticator', 'dashboard_user'));

-- Consolidar políticas para rol 'authenticator' y acción 'SELECT'
CREATE POLICY "configuration_authenticator_select_consolidated" ON public.configuration
FOR SELECT
TO authenticator
USING ((SELECT auth.role()) = 'authenticated' OR (SELECT auth.role()) IN ('anon', 'authenticated', 'authenticator', 'dashboard_user'));

-- Consolidar políticas para rol 'dashboard_user' y acción 'SELECT'
CREATE POLICY "configuration_dashboard_user_select_consolidated" ON public.configuration
FOR SELECT
TO dashboard_user
USING ((SELECT auth.role()) = 'authenticated' OR (SELECT auth.role()) IN ('anon', 'authenticated', 'authenticator', 'dashboard_user'));

-- Crear política para acciones modificadoras (que no presentaban conflictos)
CREATE POLICY "configuration_authenticated_modify" ON public.configuration
FOR ALL
TO authenticated
USING ((SELECT auth.role()) = 'authenticated');

-------------------------------------------------
-- 2. TABLA: public.user_rates
-------------------------------------------------

-- Eliminar políticas existentes para luego crear las consolidadas
DROP POLICY IF EXISTS "user_rates_delete_policy" ON public.user_rates;
DROP POLICY IF EXISTS "user_rates_insert_policy" ON public.user_rates;
DROP POLICY IF EXISTS "user_rates_select_policy" ON public.user_rates;
DROP POLICY IF EXISTS "user_rates_update_policy" ON public.user_rates;

-- Rol 'anon'
-- INSERT
CREATE POLICY "user_rates_anon_insert_consolidated" ON public.user_rates
FOR INSERT
TO anon
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_rates_anon_select_consolidated" ON public.user_rates
FOR SELECT
TO anon
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_rates_anon_update_consolidated" ON public.user_rates
FOR UPDATE
TO anon
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_rates_anon_delete_consolidated" ON public.user_rates
FOR DELETE
TO anon
USING ((SELECT auth.uid()) = user_id);

-- Rol 'authenticated'
-- INSERT
CREATE POLICY "user_rates_authenticated_insert_consolidated" ON public.user_rates
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_rates_authenticated_select_consolidated" ON public.user_rates
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_rates_authenticated_update_consolidated" ON public.user_rates
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_rates_authenticated_delete_consolidated" ON public.user_rates
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Rol 'authenticator'
-- INSERT
CREATE POLICY "user_rates_authenticator_insert_consolidated" ON public.user_rates
FOR INSERT
TO authenticator
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_rates_authenticator_select_consolidated" ON public.user_rates
FOR SELECT
TO authenticator
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_rates_authenticator_update_consolidated" ON public.user_rates
FOR UPDATE
TO authenticator
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_rates_authenticator_delete_consolidated" ON public.user_rates
FOR DELETE
TO authenticator
USING ((SELECT auth.uid()) = user_id);

-- Rol 'dashboard_user'
-- INSERT
CREATE POLICY "user_rates_dashboard_user_insert_consolidated" ON public.user_rates
FOR INSERT
TO dashboard_user
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_rates_dashboard_user_select_consolidated" ON public.user_rates
FOR SELECT
TO dashboard_user
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_rates_dashboard_user_update_consolidated" ON public.user_rates
FOR UPDATE
TO dashboard_user
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_rates_dashboard_user_delete_consolidated" ON public.user_rates
FOR DELETE
TO dashboard_user
USING ((SELECT auth.uid()) = user_id);

-------------------------------------------------
-- 3. TABLA: public.user_settings
-------------------------------------------------

-- Eliminar políticas existentes para luego crear las consolidadas
DROP POLICY IF EXISTS "user_settings_delete_policy" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert_policy" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_select_policy" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update_policy" ON public.user_settings;

-- Rol 'anon'
-- INSERT
CREATE POLICY "user_settings_anon_insert_consolidated" ON public.user_settings
FOR INSERT
TO anon
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_settings_anon_select_consolidated" ON public.user_settings
FOR SELECT
TO anon
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_settings_anon_update_consolidated" ON public.user_settings
FOR UPDATE
TO anon
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_settings_anon_delete_consolidated" ON public.user_settings
FOR DELETE
TO anon
USING ((SELECT auth.uid()) = user_id);

-- Rol 'authenticated'
-- INSERT
CREATE POLICY "user_settings_authenticated_insert_consolidated" ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_settings_authenticated_select_consolidated" ON public.user_settings
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_settings_authenticated_update_consolidated" ON public.user_settings
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_settings_authenticated_delete_consolidated" ON public.user_settings
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Rol 'authenticator'
-- INSERT
CREATE POLICY "user_settings_authenticator_insert_consolidated" ON public.user_settings
FOR INSERT
TO authenticator
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_settings_authenticator_select_consolidated" ON public.user_settings
FOR SELECT
TO authenticator
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_settings_authenticator_update_consolidated" ON public.user_settings
FOR UPDATE
TO authenticator
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_settings_authenticator_delete_consolidated" ON public.user_settings
FOR DELETE
TO authenticator
USING ((SELECT auth.uid()) = user_id);

-- Rol 'dashboard_user'
-- INSERT
CREATE POLICY "user_settings_dashboard_user_insert_consolidated" ON public.user_settings
FOR INSERT
TO dashboard_user
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- SELECT
CREATE POLICY "user_settings_dashboard_user_select_consolidated" ON public.user_settings
FOR SELECT
TO dashboard_user
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- UPDATE
CREATE POLICY "user_settings_dashboard_user_update_consolidated" ON public.user_settings
FOR UPDATE
TO dashboard_user
USING ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) = user_id);

-- DELETE
CREATE POLICY "user_settings_dashboard_user_delete_consolidated" ON public.user_settings
FOR DELETE
TO dashboard_user
USING ((SELECT auth.uid()) = user_id);

-- Nota: Como hemos combinado políticas permisivas con OR, cualquier condición que permita acceso 
-- en las políticas originales permitirá acceso en la política consolidada, manteniendo el mismo 
-- comportamiento funcional pero mejorando el rendimiento. 