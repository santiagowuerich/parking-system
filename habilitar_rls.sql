-- Script para habilitar Row Level Security (RLS) en tablas públicas
-- CORRECCIÓN DE ERRORES CRÍTICOS DE SEGURIDAD

-------------------------------------------------
-- HABILITAR RLS EN TABLAS PÚBLICAS SIN PROTECCIÓN
-------------------------------------------------

-- 1. Tabla: public.tariffs
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

-- 2. Tabla: public.admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 3. Tabla: public.rates
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;

-- 4. Tabla: public.vehicles
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-------------------------------------------------
-- CREAR POLÍTICAS DE SEGURIDAD BÁSICAS
-------------------------------------------------

-- Políticas para tariffs
-- Permitir solo a usuarios autenticados ver tarifas
CREATE POLICY "tariffs_select_policy" ON public.tariffs
FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- Permitir solo a administradores modificar tarifas
CREATE POLICY "tariffs_modify_policy" ON public.tariffs
FOR ALL
TO authenticated
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- Políticas para admins
-- Solo otros administradores pueden ver y gestionar administradores
CREATE POLICY "admins_select_policy" ON public.admins
FOR SELECT USING ((SELECT is_admin FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "admins_modify_policy" ON public.admins
FOR ALL
TO authenticated
USING ((SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- Políticas para rates
-- Permitir a usuarios autenticados ver tarifas
CREATE POLICY "rates_select_policy" ON public.rates
FOR SELECT USING ((SELECT auth.role()) = 'authenticated');

-- Permitir solo a administradores modificar tarifas
CREATE POLICY "rates_modify_policy" ON public.rates
FOR ALL
TO authenticated
USING ((SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- Políticas para vehicles
-- Usuarios pueden ver sus propios vehículos
CREATE POLICY "vehicles_select_policy" ON public.vehicles
FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Usuarios pueden modificar sus propios vehículos
CREATE POLICY "vehicles_modify_policy" ON public.vehicles
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Administradores pueden ver todos los vehículos
CREATE POLICY "vehicles_admin_select_policy" ON public.vehicles
FOR SELECT
TO authenticated
USING ((SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- Administradores pueden modificar todos los vehículos
CREATE POLICY "vehicles_admin_modify_policy" ON public.vehicles
FOR ALL
TO authenticated
USING ((SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- NOTA: Este script asume que existe una columna is_admin en la tabla auth.users
-- Si no existe, debe crear esta columna o utilizar otra forma de identificar administradores 