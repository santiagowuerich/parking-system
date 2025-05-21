-- Script para habilitar Row Level Security (RLS) en tablas públicas
-- CORRECCIÓN DE ERRORES CRÍTICOS DE SEGURIDAD (VERSIÓN CORREGIDA V3)

-------------------------------------------------
-- SOLUCIÓN: USAR UNA TABLA DE ROLES SEPARADA Y AJUSTAR POLÍTICAS
-------------------------------------------------

-- Crear tabla de roles de usuario si no existe
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en la tabla de roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política para que los administradores gestionen la tabla de roles
-- Y para que los usuarios puedan verse a sí mismos (si no son admin)
DROP POLICY IF EXISTS "user_roles_admin_policy" ON public.user_roles;
CREATE POLICY "user_roles_admin_policy" ON public.user_roles
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

CREATE POLICY "user_roles_self_view_policy" ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- IMPORTANTE: Crear manualmente el primer administrador
-- después de ejecutar este script usando:
-- INSERT INTO public.user_roles (user_id, is_admin) 
-- VALUES ('ID-de-usuario-aquí', true);

-------------------------------------------------
-- HABILITAR RLS EN TABLAS PÚBLICAS SIN PROTECCIÓN
-------------------------------------------------

ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-------------------------------------------------
-- CREAR POLÍTICAS DE SEGURIDAD BÁSICAS
-------------------------------------------------

-- Políticas para tariffs
DROP POLICY IF EXISTS "tariffs_select_policy" ON public.tariffs;
CREATE POLICY "tariffs_select_policy" ON public.tariffs
FOR SELECT 
USING (true); -- Permitir lectura a todos, incluso anónimos si es necesario para la UI inicial

DROP POLICY IF EXISTS "tariffs_modify_policy" ON public.tariffs;
CREATE POLICY "tariffs_modify_policy" ON public.tariffs
FOR ALL -- INSERT, UPDATE, DELETE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para admins
DROP POLICY IF EXISTS "admins_select_policy" ON public.admins;
CREATE POLICY "admins_select_policy" ON public.admins
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

DROP POLICY IF EXISTS "admins_modify_policy" ON public.admins;
CREATE POLICY "admins_modify_policy" ON public.admins
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para rates
DROP POLICY IF EXISTS "rates_select_policy" ON public.rates;
CREATE POLICY "rates_select_policy" ON public.rates
FOR SELECT 
USING (true); -- Permitir lectura a todos, incluso anónimos si es necesario para la UI inicial

DROP POLICY IF EXISTS "rates_modify_policy" ON public.rates;
CREATE POLICY "rates_modify_policy" ON public.rates
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Políticas para vehicles
DROP POLICY IF EXISTS "vehicles_select_policy" ON public.vehicles;
CREATE POLICY "vehicles_select_policy" ON public.vehicles
FOR SELECT 
USING ((SELECT auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

DROP POLICY IF EXISTS "vehicles_modify_policy" ON public.vehicles;
CREATE POLICY "vehicles_modify_policy" ON public.vehicles
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
))
WITH CHECK ((SELECT auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND is_admin = true
));

-- Considerar si el rol 'anon' necesita acceso de lectura a ciertas tablas
-- Si es así, se puede añadir: 
-- CREATE POLICY "tariffs_anon_select_policy" ON public.tariffs FOR SELECT TO anon USING (true);
-- CREATE POLICY "rates_anon_select_policy" ON public.rates FOR SELECT TO anon USING (true); 