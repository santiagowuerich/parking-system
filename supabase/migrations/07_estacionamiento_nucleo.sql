-- Esquema núcleo del sistema de estacionamientos (fase 2)
-- Tablas: estacionamientos, vehiculos, plazas, tipotarifas, est_acepta_metodospago, pagos, turno_asignados, tarifas

-- ========== NÚCLEO ==========
CREATE TABLE IF NOT EXISTS estacionamientos (
  est_id                            INT PRIMARY KEY,
  est_prov                          VARCHAR(50)  NOT NULL,
  est_locali                        VARCHAR(80)  NOT NULL,
  est_direc                         VARCHAR(120) NOT NULL,
  est_nombre                        VARCHAR(80)  NOT NULL,
  est_capacidad                     INT          NOT NULL,
  due_id                            INT          NOT NULL,
  est_cantidad_espacios_disponibles INT          NOT NULL,
  est_horario_funcionamiento        INT          NOT NULL,
  est_tolerancia_min                INT          NOT NULL,
  CONSTRAINT fk_est_dueno FOREIGN KEY (due_id) REFERENCES dueno(due_id)
);

CREATE TABLE IF NOT EXISTS vehiculos (
  veh_patente    VARCHAR(12) PRIMARY KEY,
  con_id         INT     NOT NULL,
  catv_segmento  CHAR(3) NOT NULL,
  CONSTRAINT fk_veh_conductor FOREIGN KEY (con_id)        REFERENCES conductores(con_id),
  CONSTRAINT fk_veh_catv      FOREIGN KEY (catv_segmento)  REFERENCES cat_vehiculo(catv_segmento)
);

CREATE TABLE IF NOT EXISTS plazas (
  est_id         INT          NOT NULL,
  pla_numero     INT          NOT NULL,
  pla_estado     VARCHAR(20)  NOT NULL,
  catv_segmento  CHAR(3)      NOT NULL,
  pla_zona       VARCHAR(40),
  CONSTRAINT pk_plazas PRIMARY KEY (est_id, pla_numero),
  CONSTRAINT fk_plazas_est  FOREIGN KEY (est_id)        REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_plazas_catv FOREIGN KEY (catv_segmento) REFERENCES cat_vehiculo(catv_segmento)
);

CREATE TABLE IF NOT EXISTS tipotarifas (
  tiptar_nro     INT PRIMARY KEY,
  tiptar_descrip VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS est_acepta_metodospago (
  est_id      INT         NOT NULL,
  mepa_metodo VARCHAR(60) NOT NULL,
  CONSTRAINT pk_eamp PRIMARY KEY (est_id, mepa_metodo),
  CONSTRAINT fk_eamp_est  FOREIGN KEY (est_id)      REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_eamp_mepa FOREIGN KEY (mepa_metodo) REFERENCES metodos_pagos(mepa_metodo)
);

CREATE TABLE IF NOT EXISTS pagos (
  pag_nro      INT PRIMARY KEY,
  pag_monto    REAL      NOT NULL,
  pag_h_fh     TIMESTAMP NOT NULL,
  est_id       INT       NOT NULL,
  mepa_metodo  VARCHAR(60) NOT NULL,
  veh_patente  VARCHAR(12) NOT NULL,
  CONSTRAINT fk_pagos_estacionamiento FOREIGN KEY (est_id)      REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_pagos_metodo          FOREIGN KEY (mepa_metodo) REFERENCES metodos_pagos(mepa_metodo),
  CONSTRAINT fk_pagos_vehiculo        FOREIGN KEY (veh_patente) REFERENCES vehiculos(veh_patente)
);

CREATE TABLE IF NOT EXISTS turno_asignados (
  est_id            INT       NOT NULL,
  play_id           INT       NOT NULL,
  tura_fh_inicio    TIMESTAMP NOT NULL,
  tura_fh_fin       TIME,
  tura_caja_ingrese REAL,
  tura_caja_cierre  REAL,
  CONSTRAINT pk_turno_asignados PRIMARY KEY (est_id, play_id, tura_fh_inicio),
  CONSTRAINT fk_ta_est   FOREIGN KEY (est_id)  REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_ta_playa FOREIGN KEY (play_id) REFERENCES playeros(play_id)
);

CREATE TABLE IF NOT EXISTS tarifas (
  est_id         INT         NOT NULL,
  tiptar_nro     INT         NOT NULL,
  catv_segmento  CHAR(3)     NOT NULL,
  tar_f_desde    TIMESTAMP   NOT NULL,
  tar_precio     REAL        NOT NULL,
  tar_fraccion   REAL        NOT NULL,
  pla_tipo       VARCHAR(20) NOT NULL,
  CONSTRAINT pk_tarifas PRIMARY KEY (est_id, tiptar_nro, catv_segmento, tar_f_desde, pla_tipo),
  CONSTRAINT fk_tarifas_est   FOREIGN KEY (est_id)        REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_tarifas_tipo  FOREIGN KEY (tiptar_nro)    REFERENCES tipotarifas(tiptar_nro),
  CONSTRAINT fk_tarifas_catv  FOREIGN KEY (catv_segmento) REFERENCES cat_vehiculo(catv_segmento),
  CONSTRAINT fk_tarifas_tipo_plaza FOREIGN KEY (pla_tipo) REFERENCES tipo_plaza(pla_tipo)
);




