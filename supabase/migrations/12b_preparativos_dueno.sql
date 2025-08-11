-- Crear DUENO placeholder y usarlo en estacionamientos por defecto
DO $$
DECLARE
  v_due_id INT;
BEGIN
  -- Crear usuario placeholder si no hay ninguno asociado a dueno
  IF NOT EXISTS (SELECT 1 FROM dueno) THEN
    INSERT INTO usuario (
      usu_nom, usu_ape, usu_dni, usu_tel, usu_email, usu_fechareg, usu_contrasena
    ) VALUES (
      'Placeholder', 'Owner', '00000000', NULL, NULL, NOW(), 'changeme'
    ) RETURNING usu_id INTO v_due_id;

    INSERT INTO dueno (due_id) VALUES (v_due_id) ON CONFLICT DO NOTHING;
  ELSE
    SELECT due_id INTO v_due_id FROM dueno LIMIT 1;
  END IF;

  -- Insertar estacionamiento por defecto con el due_id obtenido
  IF NOT EXISTS (SELECT 1 FROM estacionamientos WHERE est_id = 1) THEN
    INSERT INTO estacionamientos (
      est_id, est_prov, est_locali, est_direc, est_nombre, est_capacidad,
      due_id, est_cantidad_espacios_disponibles, est_horario_funcionamiento, est_tolerancia_min
    ) VALUES (
      1, 'NA', 'NA', 'NA', 'Principal', 99999,
      v_due_id, 99999, 24, 15
    );
  END IF;

  -- Asegurar una plaza por defecto
  IF NOT EXISTS (SELECT 1 FROM plazas WHERE est_id = 1 AND pla_numero = 1) THEN
    INSERT INTO plazas (est_id, pla_numero, pla_estado, catv_segmento, pla_zona)
    VALUES (1, 1, 'Libre', 'AUT', NULL);
  END IF;
END $$;




