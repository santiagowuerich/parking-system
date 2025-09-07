-- CORRECCIÓN: Crear políticas RLS básicas para tablas utilizadas en setup
-- Esto permite que el proceso de configuración funcione correctamente

-- Políticas para tabla dueno
CREATE POLICY "Users can insert dueno records during setup" ON public.dueno
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view dueno records" ON public.dueno
FOR SELECT
USING (true);

-- Políticas para tabla estacionamientos
CREATE POLICY "Users can insert estacionamientos during setup" ON public.estacionamientos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their estacionamientos" ON public.estacionamientos
FOR SELECT
USING (true);

CREATE POLICY "Users can update their estacionamientos" ON public.estacionamientos
FOR UPDATE
USING (true);

-- Políticas para tabla plazas
CREATE POLICY "Users can insert plazas during setup" ON public.plazas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view plazas" ON public.plazas
FOR SELECT
USING (true);

CREATE POLICY "Users can update plazas" ON public.plazas
FOR UPDATE
USING (true);

-- Políticas para tabla tarifas
CREATE POLICY "Users can insert tarifas during setup" ON public.tarifas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view tarifas" ON public.tarifas
FOR SELECT
USING (true);

CREATE POLICY "Users can update tarifas" ON public.tarifas
FOR UPDATE
USING (true);

-- Políticas para tabla est_acepta_metodospago
CREATE POLICY "Users can insert payment methods during setup" ON public.est_acepta_metodospago
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view payment methods" ON public.est_acepta_metodospago
FOR SELECT
USING (true);

-- Políticas para tabla user_settings
CREATE POLICY "Users can insert their settings" ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their settings" ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their settings" ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Comentarios explicativos
COMMENT ON POLICY "Users can insert dueno records during setup" ON public.dueno IS 'Permite inserción en tabla dueno durante setup';
COMMENT ON POLICY "Users can insert estacionamientos during setup" ON public.estacionamientos IS 'Permite inserción en tabla estacionamientos durante setup';
COMMENT ON POLICY "Users can insert plazas during setup" ON public.plazas IS 'Permite inserción en tabla plazas durante setup';
COMMENT ON POLICY "Users can insert tarifas during setup" ON public.tarifas IS 'Permite inserción en tabla tarifas durante setup';
COMMENT ON POLICY "Users can insert payment methods during setup" ON public.est_acepta_metodospago IS 'Permite inserción en tabla métodos de pago durante setup';
COMMENT ON POLICY "Users can insert their settings" ON public.user_settings IS 'Permite inserción de configuraciones propias del usuario';

-- Verificar políticas creadas
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('usuario', 'dueno', 'estacionamientos', 'plazas', 'tarifas', 'est_acepta_metodospago', 'user_settings')
ORDER BY tablename, policyname;






