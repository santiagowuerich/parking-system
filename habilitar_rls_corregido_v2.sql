-- Script para habilitar Row Level Security (RLS) en tablas públicas
-- CORRECCIÓN DE ERRORES CRÍTICOS DE SEGURIDAD (VERSIÓN CORREGIDA V2)

-------------------------------------------------
-- SOLUCIÓN: USAR UNA TABLA DE ROLES SEPARADA
-------------------------------------------------
-- No podemos modificar auth.users ya que es administrada por Supabase
-- Usaremos una tabla separada para gestionar los roles de administrador

-- Crear tabla de roles de usuario si no existe
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en la tabla de roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política inicial para que los administradores existentes gestionen la tabla
-- (necesario establecer admin inicial mediante SQL directo)
CREATE POLICY "user_roles_admin_policy" ON public.user_roles
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- IMPORTANTE: Crear manualmente el primer administrador
-- después de ejecutar este script usando:
-- INSERT INTO public.user_roles (user_id, is_admin) 
-- VALUES ('ID-de-usuario-aquí', true);

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
-- Permitir a usuarios autenticados ver tarifas
CREATE POLICY "tariffs_select_policy" ON public.tariffs
FOR SELECT 
USING ((SELECT auth.role()) = 'authenticated');

-- Permitir solo a administradores modificar tarifas
CREATE POLICY "tariffs_modify_policy" ON public.tariffs
FOR ALL
TO authenticated
USING ((SELECT auth.role()) = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para admins
-- Solo administradores pueden ver y gestionar administradores
CREATE POLICY "admins_select_policy" ON public.admins
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

CREATE POLICY "admins_modify_policy" ON public.admins
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para rates
-- Permitir a usuarios autenticados ver tarifas
CREATE POLICY "rates_select_policy" ON public.rates
FOR SELECT 
USING ((SELECT auth.role()) = 'authenticated');

-- Permitir solo a administradores modificar tarifas
CREATE POLICY "rates_modify_policy" ON public.rates
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para vehicles
-- Usuarios pueden ver sus propios vehículos
CREATE POLICY "vehicles_select_policy" ON public.vehicles
FOR SELECT 
USING ((SELECT auth.uid()) = user_id);

-- Usuarios pueden modificar sus propios vehículos
CREATE POLICY "vehicles_modify_policy" ON public.vehicles
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Administradores pueden ver todos los vehículos
CREATE POLICY "vehicles_admin_select_policy" ON public.vehicles
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Administradores pueden modificar todos los vehículos
CREATE POLICY "vehicles_admin_modify_policy" ON public.vehicles
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
)); 