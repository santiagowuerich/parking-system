-- ========== BASE ==========
CREATE TABLE Usuario (
  USU_Id         INT PRIMARY KEY,
  USU_Nom        VARCHAR(60) NOT NULL,
  USU_Ape        VARCHAR(60) NOT NULL,
  USU_Dni        VARCHAR(20) NOT NULL,
  USU_Tel        VARCHAR(30),
  USU_Email      VARCHAR(120),
  USU_FechaReg   DATETIME NOT NULL,
  USU_Contrasena VARCHAR(255) NOT NULL,
  CONSTRAINT uq_usuario_email UNIQUE (USU_Email)
);

CREATE TABLE Dueno (
  DUE_Id INT PRIMARY KEY,
  CONSTRAINT fk_dueno_usuario FOREIGN KEY (DUE_Id) REFERENCES Usuario(USU_Id)
);

CREATE TABLE Conductores (
  CON_Id INT PRIMARY KEY,
  CONSTRAINT fk_conductores_usuario FOREIGN KEY (CON_Id) REFERENCES Usuario(USU_Id)
);

CREATE TABLE Playeros (
  PLAY_Id INT PRIMARY KEY,
  CONSTRAINT fk_playeros_usuario FOREIGN KEY (PLAY_Id) REFERENCES Usuario(USU_Id)
);

CREATE TABLE Cat_Vehiculo (
  CATV_Segmento    CHAR(3) NOT NULL,
  CATV_Descripcion VARCHAR(100) NOT NULL,
  CONSTRAINT pk_cat_vehiculo PRIMARY KEY (CATV_Segmento)
);

-- Metodo de pago ahora VARCHAR (clave)
CREATE TABLE Metodos_Pagos (
  MEPA_Metodo      VARCHAR(60) NOT NULL,
  MEPA_Descripcion VARCHAR(60) NOT NULL,
  CONSTRAINT pk_metodos_pagos PRIMARY KEY (MEPA_Metodo)
);

-- Catálogo para PLA_Tipo usado en Tarifas
CREATE TABLE Tipo_Plaza (
  PLA_Tipo        VARCHAR(20) PRIMARY KEY,
  PLA_Descripcion VARCHAR(100) NOT NULL
);

-- ========== NÚCLEO ==========
CREATE TABLE Estacionamientos (
  EST_ID                             INT PRIMARY KEY,
  EST_Prov                           VARCHAR(50)  NOT NULL,
  EST_Locali                         VARCHAR(80)  NOT NULL,
  EST_Direc                          VARCHAR(120) NOT NULL,
  EST_Nombre                         VARCHAR(80)  NOT NULL,
  EST_Capacidad                      INT          NOT NULL,
  DUE_Id                             INT          NOT NULL,
  EST_Cantidad_Espacios_Disponibles  INT          NOT NULL,
  EST_Horario_Funcionamiento         INT          NOT NULL,
  EST_Tolerancia_Min                 INT          NOT NULL,
  CONSTRAINT fk_est_dueno FOREIGN KEY (DUE_Id) REFERENCES Dueno(DUE_Id)
);

CREATE TABLE Vehiculos (
  VEH_Patente    VARCHAR(12) PRIMARY KEY,
  CON_Id         INT     NOT NULL,
  CATV_Segmento  CHAR(3) NOT NULL,
  CONSTRAINT fk_veh_conductor FOREIGN KEY (CON_Id) REFERENCES Conductores(CON_Id),
  CONSTRAINT fk_veh_catv      FOREIGN KEY (CATV_Segmento) REFERENCES Cat_Vehiculo(CATV_Segmento)
);

CREATE TABLE Plazas (
  EST_ID         INT          NOT NULL,
  PLA_Numero     INT          NOT NULL,
  PLA_Estado     VARCHAR(20)  NOT NULL,
  CATV_Segmento  CHAR(3)      NOT NULL,
  PLA_Zona       VARCHAR(40),
  CONSTRAINT pk_plazas PRIMARY KEY (EST_ID, PLA_Numero),
  CONSTRAINT fk_plazas_est  FOREIGN KEY (EST_ID)        REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_plazas_catv FOREIGN KEY (CATV_Segmento) REFERENCES Cat_Vehiculo(CATV_Segmento)
);

CREATE TABLE TipoTarifas (
  TIPTAR_Nro     INT PRIMARY KEY,
  TIPTAR_Descrip VARCHAR(100) NOT NULL
);

-- ahora puente con metodo VARCHAR
CREATE TABLE Est_Acepta_MetodosPago (
  EST_ID      INT         NOT NULL,
  MEPA_Metodo VARCHAR(60) NOT NULL,
  CONSTRAINT pk_eamp PRIMARY KEY (EST_ID, MEPA_Metodo),
  CONSTRAINT fk_eamp_est  FOREIGN KEY (EST_ID)      REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_eamp_mepa FOREIGN KEY (MEPA_Metodo) REFERENCES Metodos_Pagos(MEPA_Metodo)
);

CREATE TABLE Pagos (
  PAG_Nro      INT PRIMARY KEY,
  PAG_Monto    REAL      NOT NULL,
  PAG_H_FH     DATETIME  NOT NULL,
  EST_ID       INT       NOT NULL,
  MEPA_Metodo  VARCHAR(60) NOT NULL,
  VEH_Patente  VARCHAR(12) NOT NULL,
  CONSTRAINT fk_pagos_estacionamiento FOREIGN KEY (EST_ID)      REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_pagos_metodo          FOREIGN KEY (MEPA_Metodo) REFERENCES Metodos_Pagos(MEPA_Metodo),
  CONSTRAINT fk_pagos_vehiculo        FOREIGN KEY (VEH_Patente) REFERENCES Vehiculos(VEH_Patente)
);

CREATE TABLE Turno_Asignados (
  EST_ID            INT       NOT NULL,
  PLAY_Id           INT       NOT NULL,
  TURA_FH_Inicio    DATETIME  NOT NULL,
  TURA_FH_Fin       TIME,
  TURA_Caja_Ingrese REAL,
  TURA_Caja_Cierre  REAL,
  CONSTRAINT pk_turno_asignados PRIMARY KEY (EST_ID, PLAY_Id, TURA_FH_Inicio),
  CONSTRAINT fk_ta_est   FOREIGN KEY (EST_ID)  REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_ta_playa FOREIGN KEY (PLAY_Id) REFERENCES Playeros(PLAY_Id)
);

CREATE TABLE Tarifas (
  EST_ID         INT         NOT NULL,
  TIPTAR_Nro     INT         NOT NULL,
  CATV_Segmento  CHAR(3)     NOT NULL,
  TAR_F_Desde    DATETIME    NOT NULL,
  TAR_Precio     REAL        NOT NULL,
  TAR_Fraccion   REAL        NOT NULL,
  PLA_Tipo       VARCHAR(20) NOT NULL,
  CONSTRAINT pk_tarifas PRIMARY KEY (EST_ID, TIPTAR_Nro, CATV_Segmento, TAR_F_Desde, PLA_Tipo),
  CONSTRAINT fk_tarifas_est   FOREIGN KEY (EST_ID)        REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_tarifas_tipo  FOREIGN KEY (TIPTAR_Nro)    REFERENCES TipoTarifas(TIPTAR_Nro),
  CONSTRAINT fk_tarifas_catv  FOREIGN KEY (CATV_Segmento) REFERENCES Cat_Vehiculo(CATV_Segmento),
  CONSTRAINT fk_tarifas_tipo_plaza FOREIGN KEY (PLA_Tipo) REFERENCES Tipo_Plaza(PLA_Tipo)
);

-- ========== ABONADOS / RESERVAS / OCUPACION ==========
CREATE TABLE Abonado (
  ABON_Id        INT PRIMARY KEY,
  CON_Id         INT,                 -- NULL permitido
  ABON_DNI       VARCHAR(20) NOT NULL,
  ABON_Nombre    VARCHAR(60) NOT NULL,
  ABON_Apellido  VARCHAR(60) NOT NULL,
  CONSTRAINT fk_abonado_conductor FOREIGN KEY (CON_Id) REFERENCES Conductores(CON_Id)
);

CREATE TABLE Abonos (
  EST_ID           INT NOT NULL,
  ABO_Nro          INT NOT NULL,
  ABON_Id          INT NOT NULL,
  ABO_Fecha_Inicio DATETIME NOT NULL,
  ABO_Fecha_Fin    DATETIME NOT NULL,
  PAG_Nro          INT,
  ABO_TipoAbono    VARCHAR(40),
  CONSTRAINT pk_abonos PRIMARY KEY (EST_ID, ABO_Nro),
  CONSTRAINT fk_abonos_est     FOREIGN KEY (EST_ID)   REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_abonos_abonado FOREIGN KEY (ABON_Id)  REFERENCES Abonado(ABON_Id),
  CONSTRAINT fk_abonos_pago    FOREIGN KEY (PAG_Nro)  REFERENCES Pagos(PAG_Nro)
);

CREATE TABLE Vehiculos_Abonados (
  EST_ID      INT NOT NULL,
  ABO_Nro     INT NOT NULL,
  VEH_Patente VARCHAR(12) NOT NULL,
  CONSTRAINT pk_veh_abonados PRIMARY KEY (EST_ID, ABO_Nro, VEH_Patente),
  CONSTRAINT fk_va_abonos   FOREIGN KEY (EST_ID, ABO_Nro) REFERENCES Abonos(EST_ID, ABO_Nro),
  CONSTRAINT fk_va_vehiculo FOREIGN KEY (VEH_Patente)     REFERENCES Vehiculos(VEH_Patente)
);

CREATE TABLE Reservas (
  EST_ID         INT NOT NULL,
  PLA_Numero     INT NOT NULL,
  VEH_Patente    VARCHAR(12) NOT NULL,
  RES_FH_Ingreso DATETIME NOT NULL,
  CON_Id         INT NOT NULL,
  PAG_Nro        INT,
  RES_Estado     VARCHAR(20) NOT NULL,
  RES_Monto      REAL,
  CONSTRAINT pk_reservas PRIMARY KEY (EST_ID, PLA_Numero, VEH_Patente, RES_FH_Ingreso),
  CONSTRAINT fk_res_plaza    FOREIGN KEY (EST_ID, PLA_Numero) REFERENCES Plazas(EST_ID, PLA_Numero),
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (VEH_Patente)        REFERENCES Vehiculos(VEH_Patente),
  CONSTRAINT fk_res_con      FOREIGN KEY (CON_Id)             REFERENCES Conductores(CON_Id),
  CONSTRAINT fk_res_pago     FOREIGN KEY (PAG_Nro)            REFERENCES Pagos(PAG_Nro)
);

CREATE TABLE Ocupacion (
  EST_ID          INT        NOT NULL,
  OCU_FH_Entrada  DATETIME   NOT NULL,
  PLA_Numero      INT        NOT NULL,
  OCU_FH_Salida   DATETIME,
  VEH_Patente     VARCHAR(12) NOT NULL,
  TIPTAR_Nro      INT,
  PAG_Nro         INT,
  CONSTRAINT pk_ocupacion PRIMARY KEY (EST_ID, OCU_FH_Entrada, PLA_Numero),
  CONSTRAINT fk_ocu_plaza     FOREIGN KEY (EST_ID, PLA_Numero) REFERENCES Plazas(EST_ID, PLA_Numero),
  CONSTRAINT fk_ocu_est       FOREIGN KEY (EST_ID)             REFERENCES Estacionamientos(EST_ID),
  CONSTRAINT fk_ocu_vehiculo  FOREIGN KEY (VEH_Patente)        REFERENCES Vehiculos(VEH_Patente),
  CONSTRAINT fk_ocu_tipotar   FOREIGN KEY (TIPTAR_Nro)         REFERENCES TipoTarifas(TIPTAR_Nro),
  CONSTRAINT fk_ocu_pago      FOREIGN KEY (PAG_Nro)            REFERENCES Pagos(PAG_Nro)
);
