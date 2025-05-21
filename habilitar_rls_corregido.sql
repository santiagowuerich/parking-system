-- Script para habilitar Row Level Security (RLS) en tablas públicas
-- CORRECCIÓN DE ERRORES CRÍTICOS DE SEGURIDAD (VERSIÓN CORREGIDA)

-------------------------------------------------
-- OPCIÓN 1: CREAR COLUMNA IS_ADMIN EN AUTH.USERS
-------------------------------------------------

-- Antes de aplicar las políticas, agregamos la columna is_admin si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'is_admin'
  ) THEN
    -- Añadir la columna is_admin a auth.users
    ALTER TABLE auth.users ADD COLUMN is_admin BOOLEAN DEFAULT false;
    
    -- Aquí puedes establecer algunos usuarios como administradores
    -- Ejemplo (reemplaza los UUIDs con los IDs reales de tus administradores):
    -- UPDATE auth.users SET is_admin = true WHERE id = '00000000-0000-0000-0000-000000000000';
  END IF;
END $$;

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

-- Opción 1: Usando la columna is_admin que acabamos de crear
CREATE POLICY "tariffs_modify_policy" ON public.tariffs
FOR ALL
TO authenticated
USING ((SELECT auth.role()) = 'authenticated' AND (SELECT is_admin FROM auth.users WHERE id = auth.uid()));

-- Políticas para admins
-- Solo administradores pueden ver y gestionar administradores
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

-------------------------------------------------
-- OPCIÓN 2: ALTERNATIVA SIN MODIFICAR AUTH.USERS
-------------------------------------------------
-- Si no quieres modificar la tabla auth.users, puedes crear una tabla separada
-- para gestionar los administradores y usar esa tabla en tus políticas.

/*
-- Descomentar para usar esta opción en lugar de modificar auth.users
DROP TABLE IF EXISTS public.user_roles;
CREATE TABLE public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false
);

-- Habilitar RLS en la tabla de roles también
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver/modificar esta tabla
CREATE POLICY "user_roles_admin_policy" ON public.user_roles
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_admin = true));

-- Aquí puedes insertar algunos usuarios como administradores
-- INSERT INTO public.user_roles (user_id, is_admin) VALUES ('00000000-0000-0000-0000-000000000000', true);

-- Luego modifica las políticas para usar esta tabla en lugar de auth.users.is_admin:
-- Ejemplo:
-- CREATE POLICY "tariffs_modify_policy" ON public.tariffs
-- FOR ALL
-- TO authenticated
-- USING ((SELECT auth.role()) = 'authenticated' AND EXISTS (
--     SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_admin = true
-- ));
*/ 