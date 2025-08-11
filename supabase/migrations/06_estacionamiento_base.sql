-- Esquema base para el sistema de estacionamientos (fase 1)
-- Tablas: usuario, dueno, conductores, playeros, cat_vehiculo, metodos_pagos, tipo_plaza

-- Nota: En PostgreSQL los identificadores no entrecomillados se guardan en minúsculas.
-- Se usan columnas ID con identidad autogenerada para claves primarias enteras.

-- ========== BASE ==========
CREATE TABLE IF NOT EXISTS usuario (
  usu_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usu_nom          VARCHAR(60)  NOT NULL,
  usu_ape          VARCHAR(60)  NOT NULL,
  usu_dni          VARCHAR(20)  NOT NULL,
  usu_tel          VARCHAR(30),
  usu_email        VARCHAR(120),
  usu_fechareg     TIMESTAMP    NOT NULL,
  usu_contrasena   VARCHAR(255) NOT NULL,
  CONSTRAINT uq_usuario_email UNIQUE (usu_email)
);

CREATE TABLE IF NOT EXISTS dueno (
  due_id INT PRIMARY KEY,
  CONSTRAINT fk_dueno_usuario FOREIGN KEY (due_id) REFERENCES usuario(usu_id)
);

CREATE TABLE IF NOT EXISTS conductores (
  con_id INT PRIMARY KEY,
  CONSTRAINT fk_conductores_usuario FOREIGN KEY (con_id) REFERENCES usuario(usu_id)
);

CREATE TABLE IF NOT EXISTS playeros (
  play_id INT PRIMARY KEY,
  CONSTRAINT fk_playeros_usuario FOREIGN KEY (play_id) REFERENCES usuario(usu_id)
);

CREATE TABLE IF NOT EXISTS cat_vehiculo (
  catv_segmento    CHAR(3)      NOT NULL,
  catv_descripcion VARCHAR(100) NOT NULL,
  CONSTRAINT pk_cat_vehiculo PRIMARY KEY (catv_segmento)
);

-- Método de pago como clave de texto
CREATE TABLE IF NOT EXISTS metodos_pagos (
  mepa_metodo      VARCHAR(60) NOT NULL,
  mepa_descripcion VARCHAR(60) NOT NULL,
  CONSTRAINT pk_metodos_pagos PRIMARY KEY (mepa_metodo)
);

-- Catálogo para PLA_Tipo usado en Tarifas
CREATE TABLE IF NOT EXISTS tipo_plaza (
  pla_tipo        VARCHAR(20)  PRIMARY KEY,
  pla_descripcion VARCHAR(100) NOT NULL
);




