-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.abonado (
  abon_id integer NOT NULL DEFAULT nextval('abonado_abon_id_seq'::regclass),
  con_id integer,
  abon_dni character varying NOT NULL,
  abon_nombre character varying NOT NULL,
  abon_apellido character varying NOT NULL,
  CONSTRAINT abonado_pkey PRIMARY KEY (abon_id),
  CONSTRAINT fk_abonado_conductor FOREIGN KEY (con_id) REFERENCES public.conductores(con_id)
);
CREATE TABLE public.abonos (
  est_id integer NOT NULL,
  abo_nro integer NOT NULL DEFAULT nextval('abonos_abo_nro_seq'::regclass),
  abon_id integer NOT NULL,
  abo_fecha_inicio timestamp without time zone NOT NULL,
  abo_fecha_fin timestamp without time zone NOT NULL,
  pag_nro integer,
  abo_tipoabono character varying,
  pla_numero integer,
  abo_estado character varying DEFAULT 'activo'::character varying CHECK (abo_estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying]::text[])),
  CONSTRAINT abonos_pkey PRIMARY KEY (est_id, abo_nro),
  CONSTRAINT fk_abonos_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_abonos_abonado FOREIGN KEY (abon_id) REFERENCES public.abonado(abon_id),
  CONSTRAINT fk_abonos_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro),
  CONSTRAINT fk_abonos_plazas FOREIGN KEY (est_id) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_abonos_plazas FOREIGN KEY (pla_numero) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_abonos_plazas FOREIGN KEY (est_id) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_abonos_plazas FOREIGN KEY (pla_numero) REFERENCES public.plazas(pla_numero)
);
CREATE TABLE public.cajas_empleados (
  caj_id integer NOT NULL DEFAULT nextval('cajas_empleados_caj_id_seq'::regclass),
  tur_id integer NOT NULL,
  caj_nombre character varying NOT NULL,
  caj_fondo_inicial numeric NOT NULL DEFAULT 0.00,
  caj_fondo_final numeric,
  caj_observaciones_apertura text,
  caj_observaciones_cierre text,
  caj_estado character varying NOT NULL DEFAULT 'abierta'::character varying CHECK (caj_estado::text = ANY (ARRAY['abierta'::character varying, 'cerrada'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cajas_empleados_pkey PRIMARY KEY (caj_id),
  CONSTRAINT cajas_empleados_tur_id_fkey FOREIGN KEY (tur_id) REFERENCES public.turnos_empleados(tur_id)
);
CREATE TABLE public.caracteristica_tipos (
  tipo_id integer NOT NULL DEFAULT nextval('caracteristica_tipos_tipo_id_seq'::regclass),
  nombre_tipo character varying NOT NULL UNIQUE,
  CONSTRAINT caracteristica_tipos_pkey PRIMARY KEY (tipo_id)
);
CREATE TABLE public.caracteristicas (
  caracteristica_id integer NOT NULL DEFAULT nextval('caracteristicas_caracteristica_id_seq'::regclass),
  tipo_id integer NOT NULL,
  valor character varying NOT NULL,
  CONSTRAINT caracteristicas_pkey PRIMARY KEY (caracteristica_id),
  CONSTRAINT fk_caracteristicas_tipo FOREIGN KEY (tipo_id) REFERENCES public.caracteristica_tipos(tipo_id)
);
CREATE TABLE public.cat_vehiculo (
  catv_segmento character NOT NULL,
  catv_descripcion character varying NOT NULL,
  CONSTRAINT cat_vehiculo_pkey PRIMARY KEY (catv_segmento)
);
CREATE TABLE public.conductores (
  con_id integer NOT NULL,
  CONSTRAINT conductores_pkey PRIMARY KEY (con_id),
  CONSTRAINT fk_conductores_usuario FOREIGN KEY (con_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.disponibilidad_empleado (
  play_id integer NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  turno_id integer NOT NULL,
  CONSTRAINT disponibilidad_empleado_pkey PRIMARY KEY (play_id, dia_semana, turno_id),
  CONSTRAINT fk_de_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id),
  CONSTRAINT fk_de_turno FOREIGN KEY (turno_id) REFERENCES public.turnos_catalogo(turno_id)
);
CREATE TABLE public.dueno (
  due_id integer NOT NULL,
  CONSTRAINT dueno_pkey PRIMARY KEY (due_id),
  CONSTRAINT fk_dueno_usuario FOREIGN KEY (due_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.empleados_estacionamiento (
  play_id integer NOT NULL,
  est_id integer NOT NULL,
  fecha_asignacion timestamp with time zone DEFAULT now(),
  activo boolean DEFAULT true,
  CONSTRAINT empleados_estacionamiento_pkey PRIMARY KEY (play_id, est_id),
  CONSTRAINT fk_ee_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id),
  CONSTRAINT fk_ee_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.est_acepta_metodospago (
  est_id integer NOT NULL,
  mepa_metodo character varying NOT NULL,
  CONSTRAINT est_acepta_metodospago_pkey PRIMARY KEY (est_id, mepa_metodo),
  CONSTRAINT fk_eamp_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_eamp_mepa FOREIGN KEY (mepa_metodo) REFERENCES public.metodos_pagos(mepa_metodo)
);
CREATE TABLE public.estacionamiento_configuraciones (
  id integer NOT NULL DEFAULT nextval('estacionamiento_configuraciones_id_seq'::regclass),
  est_id integer NOT NULL UNIQUE,
  mercadopago_api_key text,
  bank_account_holder text,
  bank_account_cbu text,
  bank_account_alias text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estacionamiento_configuraciones_pkey PRIMARY KEY (id),
  CONSTRAINT estacionamiento_configuraciones_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.estacionamiento_sequence (
  sequence_name text NOT NULL,
  current_value integer NOT NULL DEFAULT 0,
  CONSTRAINT estacionamiento_sequence_pkey PRIMARY KEY (sequence_name)
);
CREATE TABLE public.estacionamientos (
  est_id integer NOT NULL,
  est_prov character varying NOT NULL,
  est_locali character varying NOT NULL,
  est_direc character varying NOT NULL UNIQUE,
  est_nombre character varying NOT NULL,
  est_capacidad integer NOT NULL,
  due_id integer,
  est_cantidad_espacios_disponibles integer NOT NULL,
  est_tolerancia_min integer NOT NULL,
  est_latitud numeric,
  est_longitud numeric,
  est_direccion_completa text,
  est_codigo_postal character varying,
  est_telefono character varying,
  est_email character varying,
  est_descripcion text,
  est_created_at timestamp with time zone DEFAULT now(),
  est_updated_at timestamp with time zone DEFAULT now(),
  est_publicado boolean NOT NULL DEFAULT false,
  est_requiere_llave character varying NOT NULL DEFAULT 'no'::character varying CHECK (est_requiere_llave::text = ANY (ARRAY['no'::character varying, 'opcional'::character varying, 'requerida'::character varying]::text[])),
  CONSTRAINT estacionamientos_pkey PRIMARY KEY (est_id),
  CONSTRAINT fk_est_dueno FOREIGN KEY (due_id) REFERENCES public.dueno(due_id)
);
CREATE TABLE public.horarios_estacionamiento (
  horario_id integer NOT NULL DEFAULT nextval('horarios_estacionamiento_horario_id_seq'::regclass) UNIQUE,
  est_id integer NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_apertura time without time zone NOT NULL,
  hora_cierre time without time zone NOT NULL,
  orden integer NOT NULL DEFAULT 1 CHECK (orden >= 1 AND orden <= 3),
  CONSTRAINT horarios_estacionamiento_pkey PRIMARY KEY (est_id, dia_semana, orden),
  CONSTRAINT fk_horarios_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.metodos_pagos (
  mepa_metodo character varying NOT NULL,
  mepa_descripcion character varying NOT NULL,
  CONSTRAINT metodos_pagos_pkey PRIMARY KEY (mepa_metodo)
);
CREATE TABLE public.ocupacion (
  est_id integer NOT NULL,
  ocu_fh_entrada timestamp without time zone NOT NULL,
  pla_numero integer,
  ocu_fh_salida timestamp without time zone,
  veh_patente text NOT NULL,
  tiptar_nro integer,
  pag_nro integer,
  ocu_id integer NOT NULL DEFAULT nextval('ocupacion_ocu_id_seq'::regclass),
  ocu_duracion_tipo character varying,
  ocu_precio_acordado real,
  ocu_fecha_limite timestamp without time zone,
  CONSTRAINT ocupacion_pkey PRIMARY KEY (ocu_id),
  CONSTRAINT fk_ocu_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_ocu_tipotar FOREIGN KEY (tiptar_nro) REFERENCES public.tipotarifas(tiptar_nro),
  CONSTRAINT fk_ocu_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro),
  CONSTRAINT fk_ocu_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(pla_numero)
);
CREATE TABLE public.pagos (
  pag_nro integer NOT NULL DEFAULT nextval('seq_pagos'::regclass),
  pag_monto real NOT NULL,
  pag_h_fh timestamp without time zone NOT NULL,
  est_id integer NOT NULL,
  mepa_metodo character varying NOT NULL,
  veh_patente text NOT NULL,
  pag_tipo character varying DEFAULT 'ocupacion'::character varying,
  pag_descripcion text,
  pag_estado character varying DEFAULT 'completado'::character varying,
  abo_nro integer,
  pag_datos_tarjeta jsonb,
  CONSTRAINT pagos_pkey PRIMARY KEY (pag_nro),
  CONSTRAINT fk_pagos_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_pagos_metodo FOREIGN KEY (mepa_metodo) REFERENCES public.metodos_pagos(mepa_metodo),
  CONSTRAINT fk_pagos_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente)
);
CREATE TABLE public.password_reset_codes (
  id bigint NOT NULL DEFAULT nextval('password_reset_codes_id_seq'::regclass),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_reset_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.plantilla_caracteristicas (
  plantilla_id integer NOT NULL,
  caracteristica_id integer NOT NULL,
  CONSTRAINT plantilla_caracteristicas_pkey PRIMARY KEY (plantilla_id, caracteristica_id),
  CONSTRAINT fk_pc_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id),
  CONSTRAINT fk_pc_caracteristica FOREIGN KEY (caracteristica_id) REFERENCES public.caracteristicas(caracteristica_id)
);
CREATE TABLE public.plantillas (
  plantilla_id integer NOT NULL DEFAULT nextval('plantillas_plantilla_id_seq'::regclass),
  est_id integer NOT NULL,
  nombre_plantilla character varying NOT NULL,
  catv_segmento character NOT NULL,
  CONSTRAINT plantillas_pkey PRIMARY KEY (plantilla_id),
  CONSTRAINT fk_plantillas_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_plantillas_cat_vehiculo FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento)
);
CREATE TABLE public.playeros (
  play_id integer NOT NULL,
  CONSTRAINT playeros_pkey PRIMARY KEY (play_id),
  CONSTRAINT fk_playeros_usuario FOREIGN KEY (play_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.plaza_presets (
  preset_id integer NOT NULL DEFAULT nextval('plaza_presets_preset_id_seq'::regclass),
  est_id integer NOT NULL,
  preset_nombre character varying NOT NULL,
  reglas jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plaza_presets_pkey PRIMARY KEY (preset_id),
  CONSTRAINT plaza_presets_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.plaza_status_changes (
  psc_id integer NOT NULL DEFAULT nextval('plaza_status_changes_psc_id_seq'::regclass),
  est_id integer NOT NULL,
  pla_numero integer NOT NULL CHECK (pla_numero > 0),
  psc_estado_anterior character varying NOT NULL,
  psc_estado_nuevo character varying NOT NULL,
  psc_fecha_hora timestamp without time zone NOT NULL DEFAULT now(),
  psc_razon text DEFAULT 'Cambio manual'::text,
  usu_id integer,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT plaza_status_changes_pkey PRIMARY KEY (psc_id),
  CONSTRAINT plaza_status_changes_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT plaza_status_changes_usu_id_fkey FOREIGN KEY (usu_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.plazas (
  est_id integer NOT NULL,
  pla_numero integer NOT NULL,
  pla_estado character varying NOT NULL CHECK (pla_estado::text = ANY (ARRAY['Libre'::character varying, 'Ocupada'::character varying, 'Abonado'::character varying]::text[])),
  catv_segmento character NOT NULL,
  pla_zona character varying NOT NULL CHECK (TRIM(BOTH FROM pla_zona) <> ''::text),
  plantilla_id integer,
  zona_id integer,
  pla_local_numero integer,
  CONSTRAINT plazas_pkey PRIMARY KEY (est_id, pla_numero),
  CONSTRAINT fk_plazas_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_plazas_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento),
  CONSTRAINT fk_plazas_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id),
  CONSTRAINT plazas_zona_id_fkey FOREIGN KEY (zona_id) REFERENCES public.zonas(zona_id)
);
CREATE TABLE public.reservas (
  est_id integer NOT NULL,
  pla_numero integer NOT NULL,
  veh_patente text NOT NULL,
  res_fh_ingreso timestamp without time zone NOT NULL,
  con_id integer NOT NULL,
  pag_nro integer,
  res_estado character varying NOT NULL,
  res_monto real,
  CONSTRAINT reservas_pkey PRIMARY KEY (est_id, pla_numero, veh_patente, res_fh_ingreso),
  CONSTRAINT fk_res_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_res_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_res_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_res_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_res_con FOREIGN KEY (con_id) REFERENCES public.conductores(con_id),
  CONSTRAINT fk_res_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro),
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente)
);
CREATE TABLE public.tarifas (
  est_id integer NOT NULL,
  tiptar_nro integer NOT NULL,
  catv_segmento character NOT NULL,
  tar_f_desde timestamp without time zone NOT NULL,
  tar_precio real NOT NULL,
  tar_fraccion real NOT NULL,
  plantilla_id integer NOT NULL,
  CONSTRAINT tarifas_pkey PRIMARY KEY (est_id, plantilla_id, tiptar_nro, tar_f_desde),
  CONSTRAINT fk_tarifas_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_tarifas_tipo FOREIGN KEY (tiptar_nro) REFERENCES public.tipotarifas(tiptar_nro),
  CONSTRAINT fk_tarifas_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento),
  CONSTRAINT fk_tarifas_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id)
);
CREATE TABLE public.tipo_plaza (
  pla_tipo character varying NOT NULL,
  pla_descripcion character varying NOT NULL,
  CONSTRAINT tipo_plaza_pkey PRIMARY KEY (pla_tipo)
);
CREATE TABLE public.tipotarifas (
  tiptar_nro integer NOT NULL,
  tiptar_descrip character varying NOT NULL,
  CONSTRAINT tipotarifas_pkey PRIMARY KEY (tiptar_nro)
);
CREATE TABLE public.turno_asignados (
  est_id integer NOT NULL,
  play_id integer NOT NULL,
  tura_fh_inicio timestamp without time zone NOT NULL,
  tura_fh_fin time without time zone,
  tura_caja_ingrese real,
  tura_caja_cierre real,
  CONSTRAINT turno_asignados_pkey PRIMARY KEY (est_id, play_id, tura_fh_inicio),
  CONSTRAINT fk_ta_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_ta_playa FOREIGN KEY (play_id) REFERENCES public.playeros(play_id)
);
CREATE TABLE public.turnos_catalogo (
  turno_id integer NOT NULL DEFAULT nextval('turnos_catalogo_turno_id_seq'::regclass),
  nombre_turno character varying NOT NULL UNIQUE,
  CONSTRAINT turnos_catalogo_pkey PRIMARY KEY (turno_id)
);
CREATE TABLE public.turnos_empleados (
  tur_id integer NOT NULL DEFAULT nextval('turnos_empleados_tur_id_seq'::regclass),
  play_id integer NOT NULL,
  est_id integer NOT NULL,
  tur_fecha date NOT NULL DEFAULT CURRENT_DATE,
  tur_hora_entrada time without time zone NOT NULL,
  tur_hora_salida time without time zone,
  tur_estado character varying NOT NULL DEFAULT 'activo'::character varying CHECK (tur_estado::text = ANY (ARRAY['activo'::character varying, 'finalizado'::character varying]::text[])),
  tur_observaciones_entrada text,
  tur_observaciones_salida text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  caja_inicio numeric NOT NULL,
  caja_final numeric,
  CONSTRAINT turnos_empleados_pkey PRIMARY KEY (tur_id),
  CONSTRAINT turnos_empleados_play_id_est_id_fkey FOREIGN KEY (play_id) REFERENCES public.empleados_estacionamiento(play_id),
  CONSTRAINT turnos_empleados_play_id_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.empleados_estacionamiento(play_id),
  CONSTRAINT turnos_empleados_play_id_est_id_fkey FOREIGN KEY (play_id) REFERENCES public.empleados_estacionamiento(est_id),
  CONSTRAINT turnos_empleados_play_id_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.empleados_estacionamiento(est_id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  mercadopago_api_key text,
  bank_account_holder text,
  bank_account_cbu text,
  bank_account_alias text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuario (
  usu_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usu_nom character varying NOT NULL,
  usu_ape character varying NOT NULL,
  usu_dni character varying,
  usu_tel character varying,
  usu_email character varying UNIQUE,
  usu_fechareg timestamp without time zone NOT NULL,
  usu_contrasena character varying,
  auth_user_id uuid UNIQUE,
  usu_estado character varying NOT NULL DEFAULT 'Activo'::character varying,
  requiere_cambio_contrasena boolean NOT NULL DEFAULT false,
  selected_vehicle_id text,
  CONSTRAINT usuario_pkey PRIMARY KEY (usu_id),
  CONSTRAINT fk_usuario_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.vehicle_movements (
  mov_id integer NOT NULL DEFAULT nextval('vehicle_movements_mov_id_seq'::regclass),
  est_id integer NOT NULL,
  veh_patente character varying NOT NULL,
  pla_origen integer NOT NULL,
  pla_destino integer NOT NULL,
  mov_fecha_hora timestamp without time zone NOT NULL DEFAULT now(),
  mov_razon text DEFAULT 'Movimiento manual'::text,
  usu_id integer,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_movements_pkey PRIMARY KEY (mov_id),
  CONSTRAINT vehicle_movements_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT vehicle_movements_veh_patente_fkey FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente),
  CONSTRAINT vehicle_movements_usu_id_fkey FOREIGN KEY (usu_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.vehiculos (
  veh_patente text NOT NULL,
  con_id integer,
  catv_segmento character NOT NULL,
  veh_marca character varying,
  veh_modelo character varying,
  veh_color character varying,
  CONSTRAINT vehiculos_pkey PRIMARY KEY (veh_patente),
  CONSTRAINT fk_veh_conductor FOREIGN KEY (con_id) REFERENCES public.conductores(con_id),
  CONSTRAINT fk_veh_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento)
);
CREATE TABLE public.vehiculos_abonados (
  est_id integer NOT NULL,
  abo_nro integer NOT NULL,
  veh_patente text NOT NULL,
  CONSTRAINT vehiculos_abonados_pkey PRIMARY KEY (est_id, abo_nro, veh_patente),
  CONSTRAINT fk_va_abonos FOREIGN KEY (est_id) REFERENCES public.abonos(est_id),
  CONSTRAINT fk_va_abonos FOREIGN KEY (abo_nro) REFERENCES public.abonos(est_id),
  CONSTRAINT fk_va_abonos FOREIGN KEY (est_id) REFERENCES public.abonos(abo_nro),
  CONSTRAINT fk_va_abonos FOREIGN KEY (abo_nro) REFERENCES public.abonos(abo_nro),
  CONSTRAINT fk_va_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente)
);
CREATE TABLE public.zonas (
  zona_id integer NOT NULL DEFAULT nextval('zonas_zona_id_seq'::regclass),
  est_id integer NOT NULL,
  zona_nombre character varying NOT NULL,
  zona_capacidad integer DEFAULT 0,
  zona_created_at timestamp with time zone DEFAULT now(),
  zona_updated_at timestamp with time zone DEFAULT now(),
  grid_rows integer NOT NULL DEFAULT 1,
  grid_cols integer NOT NULL DEFAULT 1,
  grid_numbering character varying NOT NULL DEFAULT 'ROW_MAJOR'::character varying CHECK (grid_numbering::text = ANY (ARRAY['ROW_MAJOR'::character varying, 'COL_MAJOR'::character varying]::text[])),
  CONSTRAINT zonas_pkey PRIMARY KEY (zona_id),
  CONSTRAINT zonas_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);