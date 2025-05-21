-- Script para corregir problemas de optimización en Supabase
-- Generado para el sistema de estacionamiento

-------------------------------------------------
-- 1. CORRECCIÓN DE AUTH RLS INITIALIZATION PLAN
-------------------------------------------------
-- Problema: Las llamadas a auth.<function>() se evalúan para cada fila
-- Solución: Reemplazar con (SELECT auth.<function>())

-- Tabla: public.parking_settings
DROP POLICY IF EXISTS "Allow users to manage their own settings" ON public.parking_settings;
CREATE POLICY "Allow users to manage their own settings" ON public.parking_settings
USING ((SELECT auth.uid()) = user_id);

-- Tabla: public.user_capacity
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.user_capacity;
CREATE POLICY "Enable delete for users based on user_id" ON public.user_capacity
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_capacity;
CREATE POLICY "Enable insert for authenticated users" ON public.user_capacity
FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Enable read for users" ON public.user_capacity;
CREATE POLICY "Enable read for users" ON public.user_capacity
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_capacity;
CREATE POLICY "Enable update for users based on user_id" ON public.user_capacity
FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view and modify their own capacity" ON public.user_capacity;
CREATE POLICY "Users can view and modify their own capacity" ON public.user_capacity
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_capacity_delete_policy" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_insert_policy" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_select_policy" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_update_policy" ON public.user_capacity;

-- Tabla: public.user_rates
DROP POLICY IF EXISTS "user_rates_delete_policy" ON public.user_rates;
CREATE POLICY "user_rates_delete_policy" ON public.user_rates
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_rates_insert_policy" ON public.user_rates;
CREATE POLICY "user_rates_insert_policy" ON public.user_rates
FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_rates_select_policy" ON public.user_rates;
CREATE POLICY "user_rates_select_policy" ON public.user_rates
FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_rates_update_policy" ON public.user_rates;
CREATE POLICY "user_rates_update_policy" ON public.user_rates
FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Tabla: public.user_settings
DROP POLICY IF EXISTS "user_settings_delete_policy" ON public.user_settings;
CREATE POLICY "user_settings_delete_policy" ON public.user_settings
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_settings_insert_policy" ON public.user_settings;
CREATE POLICY "user_settings_insert_policy" ON public.user_settings
FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_settings_select_policy" ON public.user_settings;
CREATE POLICY "user_settings_select_policy" ON public.user_settings
FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_settings_update_policy" ON public.user_settings;
CREATE POLICY "user_settings_update_policy" ON public.user_settings
FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Tabla: public.configuration
DROP POLICY IF EXISTS "Permitir lectura a autenticados" ON public.configuration;
CREATE POLICY "Permitir lectura a autenticados" ON public.configuration
FOR SELECT USING ((SELECT auth.role()) IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Permitir modificación a autenticados" ON public.configuration;
CREATE POLICY "Permitir modificación a autenticados" ON public.configuration
USING ((SELECT auth.role()) = 'authenticated');

-------------------------------------------------
-- 2. CORRECCIÓN DE MULTIPLE PERMISSIVE POLICIES
-------------------------------------------------
-- Problema: Múltiples políticas permisivas redundantes
-- Solución: Consolidar en una sola política por rol/acción

-- Tabla: public.configuration
-- Consolidar políticas para SELECT
DROP POLICY IF EXISTS "Permitir lectura a autenticados" ON public.configuration;
DROP POLICY IF EXISTS "Permitir modificación a autenticados" ON public.configuration;
CREATE POLICY "configuration_select_policy" ON public.configuration
FOR SELECT USING ((SELECT auth.role()) IN ('anon', 'authenticated', 'authenticator', 'dashboard_user'));

-- Consolidar políticas para UPDATE/INSERT/DELETE
CREATE POLICY "configuration_modify_policy" ON public.configuration
USING ((SELECT auth.role()) = 'authenticated');

-- Tabla: public.parked_vehicles
-- Consolidar políticas para todos los permisos
DROP POLICY IF EXISTS "Acceso total a parked_vehicles" ON public.parked_vehicles;
DROP POLICY IF EXISTS "Permitir acceso completo a parked_vehicles" ON public.parked_vehicles;
CREATE POLICY "parked_vehicles_all_access" ON public.parked_vehicles
USING ((SELECT auth.role()) = 'authenticated');

-- Tabla: public.parking_history
-- Consolidar políticas para todos los permisos
DROP POLICY IF EXISTS "Acceso total a parking_history" ON public.parking_history;
DROP POLICY IF EXISTS "Permitir acceso completo a parking_history" ON public.parking_history;
CREATE POLICY "parking_history_all_access" ON public.parking_history
USING ((SELECT auth.role()) = 'authenticated');

-- Tabla: public.user_capacity
-- Consolidar todas las políticas para cada acción
-- Políticas para DELETE
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.user_capacity;
DROP POLICY IF EXISTS "Users can view and modify their own capacity" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_delete_policy" ON public.user_capacity;
CREATE POLICY "user_capacity_delete_consolidated" ON public.user_capacity
FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Políticas para INSERT
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_insert_policy" ON public.user_capacity;
CREATE POLICY "user_capacity_insert_consolidated" ON public.user_capacity
FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- Políticas para SELECT
DROP POLICY IF EXISTS "Enable read for users" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_select_policy" ON public.user_capacity;
CREATE POLICY "user_capacity_select_consolidated" ON public.user_capacity
FOR SELECT USING (true);

-- Políticas para UPDATE
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_capacity;
DROP POLICY IF EXISTS "user_capacity_update_policy" ON public.user_capacity;
CREATE POLICY "user_capacity_update_consolidated" ON public.user_capacity
FOR UPDATE USING ((SELECT auth.uid()) = user_id); 