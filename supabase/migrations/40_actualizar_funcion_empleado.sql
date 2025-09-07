-- supabase/migrations/40_actualizar_funcion_empleado.sql
-- Actualizar función crear_empleado_completo para que no cree usuarios en tabla usuario
-- ya que ahora esto se maneja desde el API endpoint con Supabase Auth

BEGIN;

-- Actualizar la función para que NO cree el usuario en tabla usuario
-- (esto ahora se hace desde el API endpoint)
CREATE OR REPLACE FUNCTION public.crear_empleado_completo(
  p_usu_id INT, -- NUEVO: ID del usuario ya creado en Auth
  p_nombre VARCHAR(60),
  p_apellido VARCHAR(60),
  p_dni VARCHAR(20),
  p_email VARCHAR(120),
  p_contrasena VARCHAR(255),
  p_estado VARCHAR(20),
  p_est_id INT,
  p_disponibilidad JSON DEFAULT '[]'::json
)
RETURNS JSON AS $$
DECLARE
  v_disponibilidad_item JSON;
  v_result JSON;
BEGIN
  -- Paso 1: Actualizar usuario en tabla usuario (ya debería existir)
  UPDATE public.usuario SET
    usu_nom = p_nombre,
    usu_ape = p_apellido,
    usu_dni = p_dni,
    usu_email = p_email,
    usu_contrasena = p_contrasena,
    usu_estado = COALESCE(p_estado, 'Activo'),
    requiere_cambio_contrasena = FALSE,
    usu_fechareg = COALESCE(usu_fechareg, NOW())
  WHERE usu_id = p_usu_id;

  -- Si no se actualizó ningún registro, el usuario no existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario con ID % no encontrado', p_usu_id;
  END IF;

  -- Paso 2: Insertar en playeros (si no existe)
  INSERT INTO public.playeros (play_id)
  VALUES (p_usu_id)
  ON CONFLICT (play_id) DO NOTHING;

  -- Paso 3: Insertar en empleados_estacionamiento (si no existe)
  INSERT INTO public.empleados_estacionamiento (play_id, est_id)
  VALUES (p_usu_id, p_est_id)
  ON CONFLICT (play_id, est_id) DO NOTHING;

  -- Paso 4: Limpiar disponibilidad existente y crear nueva
  DELETE FROM public.disponibilidad_empleado WHERE play_id = p_usu_id;

  -- Insertar nueva disponibilidad si se proporcionó
  IF json_array_length(p_disponibilidad::json) > 0 THEN
    FOR v_disponibilidad_item IN SELECT * FROM json_array_elements(p_disponibilidad::json)
    LOOP
      INSERT INTO public.disponibilidad_empleado (
        play_id,
        dia_semana,
        turno_id
      ) VALUES (
        p_usu_id,
        (v_disponibilidad_item->>'dia_semana')::SMALLINT,
        (v_disponibilidad_item->>'turno_id')::INT
      );
    END LOOP;
  END IF;

  -- Retornar información del empleado actualizado
  SELECT json_build_object(
    'usu_id', u.usu_id,
    'nombre', u.usu_nom,
    'apellido', u.usu_ape,
    'dni', u.usu_dni,
    'email', u.usu_email,
    'estado', u.usu_estado,
    'fecha_asignacion', ee.fecha_asignacion,
    'estacionamiento_id', ee.est_id
  ) INTO v_result
  FROM public.usuario u
  JOIN public.empleados_estacionamiento ee ON u.usu_id = ee.play_id
  WHERE u.usu_id = p_usu_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al crear/actualizar empleado: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION public.crear_empleado_completo TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_empleado_completo TO anon;

COMMIT;
