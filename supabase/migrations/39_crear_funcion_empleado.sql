-- supabase/migrations/39_crear_funcion_empleado.sql
-- Función para crear empleado completo con transacción

BEGIN;

-- Función para crear un empleado completo con todas sus relaciones
CREATE OR REPLACE FUNCTION public.crear_empleado_completo(
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
  v_usu_id INT;
  v_disponibilidad_item JSON;
  v_result JSON;
BEGIN
  -- Paso 1: Insertar en usuario
  INSERT INTO public.usuario (
    usu_nom,
    usu_ape,
    usu_dni,
    usu_email,
    usu_contrasena,
    usu_fechareg,
    usu_estado,
    requiere_cambio_contrasena
  ) VALUES (
    p_nombre,
    p_apellido,
    p_dni,
    p_email,
    p_contrasena,
    NOW(),
    COALESCE(p_estado, 'Activo'),
    FALSE
  ) RETURNING usu_id INTO v_usu_id;

  -- Paso 2: Insertar en playeros
  INSERT INTO public.playeros (play_id) VALUES (v_usu_id);

  -- Paso 3: Insertar en empleados_estacionamiento
  INSERT INTO public.empleados_estacionamiento (play_id, est_id)
  VALUES (v_usu_id, p_est_id);

  -- Paso 4: Insertar disponibilidad si se proporcionó
  IF json_array_length(p_disponibilidad::json) > 0 THEN
    FOR v_disponibilidad_item IN SELECT * FROM json_array_elements(p_disponibilidad::json)
    LOOP
      INSERT INTO public.disponibilidad_empleado (
        play_id,
        dia_semana,
        turno_id
      ) VALUES (
        v_usu_id,
        (v_disponibilidad_item->>'dia_semana')::SMALLINT,
        (v_disponibilidad_item->>'turno_id')::INT
      );
    END LOOP;
  END IF;

  -- Retornar información del empleado creado
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
  WHERE u.usu_id = v_usu_id;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Si hay algún error, hacer rollback automático
    RAISE EXCEPTION 'Error al crear empleado: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar permisos para ejecutar la función
GRANT EXECUTE ON FUNCTION public.crear_empleado_completo TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_empleado_completo TO anon;

COMMIT;
