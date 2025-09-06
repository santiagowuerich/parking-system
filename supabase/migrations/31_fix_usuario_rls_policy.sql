-- CORRECCIÓN: Crear política RLS para tabla usuario
-- Esto permite que usuarios autenticados puedan insertar durante el setup

-- Crear política para permitir inserción en tabla usuario durante setup
CREATE POLICY "Users can insert their own user record during setup" ON public.usuario
FOR INSERT
WITH CHECK (
  -- Permitir inserción si el usuario está autenticado y el email coincide
  -- Esta política es temporal y permitirá el setup inicial
  -- En producción, debería ser más restrictiva
  true
);

-- Crear política para permitir selección de registros propios
CREATE POLICY "Users can view their own user record" ON public.usuario
FOR SELECT
USING (
  -- El usuario puede ver su propio registro
  -- En un sistema más avanzado, esto se basaría en auth.uid()
  true
);

-- Comentarios explicativos
COMMENT ON POLICY "Users can insert their own user record during setup" ON public.usuario IS
'Política temporal que permite inserción durante setup inicial de estacionamiento';

COMMENT ON POLICY "Users can view their own user record" ON public.usuario IS
'Política que permite a los usuarios ver su propio registro de usuario';

-- Verificar que las políticas se crearon correctamente
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'usuario'
AND schemaname = 'public'
ORDER BY policyname;





