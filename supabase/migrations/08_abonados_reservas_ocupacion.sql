-- Esquema de Abonados / Reservas / Ocupación (fase 3)
-- Tablas: abonado, abonos, vehiculos_abonados, reservas, ocupacion

-- ========== ABONADOS / RESERVAS / OCUPACION ==========
CREATE TABLE IF NOT EXISTS abonado (
  abon_id        INT PRIMARY KEY,
  con_id         INT,                 -- NULL permitido
  abon_dni       VARCHAR(20) NOT NULL,
  abon_nombre    VARCHAR(60) NOT NULL,
  abon_apellido  VARCHAR(60) NOT NULL,
  CONSTRAINT fk_abonado_conductor FOREIGN KEY (con_id) REFERENCES conductores(con_id)
);

CREATE TABLE IF NOT EXISTS abonos (
  est_id           INT NOT NULL,
  abo_nro          INT NOT NULL,
  abon_id          INT NOT NULL,
  abo_fecha_inicio TIMESTAMP NOT NULL,
  abo_fecha_fin    TIMESTAMP NOT NULL,
  pag_nro          INT,
  abo_tipoabono    VARCHAR(40),
  CONSTRAINT pk_abonos PRIMARY KEY (est_id, abo_nro),
  CONSTRAINT fk_abonos_est     FOREIGN KEY (est_id)   REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_abonos_abonado FOREIGN KEY (abon_id)  REFERENCES abonado(abon_id),
  CONSTRAINT fk_abonos_pago    FOREIGN KEY (pag_nro)  REFERENCES pagos(pag_nro)
);

CREATE TABLE IF NOT EXISTS vehiculos_abonados (
  est_id      INT NOT NULL,
  abo_nro     INT NOT NULL,
  veh_patente VARCHAR(12) NOT NULL,
  CONSTRAINT pk_veh_abonados PRIMARY KEY (est_id, abo_nro, veh_patente),
  CONSTRAINT fk_va_abonos   FOREIGN KEY (est_id, abo_nro) REFERENCES abonos(est_id, abo_nro),
  CONSTRAINT fk_va_vehiculo FOREIGN KEY (veh_patente)     REFERENCES vehiculos(veh_patente)
);

CREATE TABLE IF NOT EXISTS reservas (
  est_id         INT NOT NULL,
  pla_numero     INT NOT NULL,
  veh_patente    VARCHAR(12) NOT NULL,
  res_fh_ingreso TIMESTAMP NOT NULL,
  con_id         INT NOT NULL,
  pag_nro        INT,
  res_estado     VARCHAR(20) NOT NULL,
  res_monto      REAL,
  CONSTRAINT pk_reservas PRIMARY KEY (est_id, pla_numero, veh_patente, res_fh_ingreso),
  CONSTRAINT fk_res_plaza    FOREIGN KEY (est_id, pla_numero) REFERENCES plazas(est_id, pla_numero),
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (veh_patente)        REFERENCES vehiculos(veh_patente),
  CONSTRAINT fk_res_con      FOREIGN KEY (con_id)             REFERENCES conductores(con_id),
  CONSTRAINT fk_res_pago     FOREIGN KEY (pag_nro)            REFERENCES pagos(pag_nro)
);

CREATE TABLE IF NOT EXISTS ocupacion (
  est_id          INT        NOT NULL,
  ocu_fh_entrada  TIMESTAMP  NOT NULL,
  pla_numero      INT        NOT NULL,
  ocu_fh_salida   TIMESTAMP,
  veh_patente     VARCHAR(12) NOT NULL,
  tiptar_nro      INT,
  pag_nro         INT,
  CONSTRAINT pk_ocupacion PRIMARY KEY (est_id, ocu_fh_entrada, pla_numero),
  CONSTRAINT fk_ocu_plaza     FOREIGN KEY (est_id, pla_numero) REFERENCES plazas(est_id, pla_numero),
  CONSTRAINT fk_ocu_est       FOREIGN KEY (est_id)             REFERENCES estacionamientos(est_id),
  CONSTRAINT fk_ocu_vehiculo  FOREIGN KEY (veh_patente)        REFERENCES vehiculos(veh_patente),
  CONSTRAINT fk_ocu_tipotar   FOREIGN KEY (tiptar_nro)         REFERENCES tipotarifas(tiptar_nro),
  CONSTRAINT fk_ocu_pago      FOREIGN KEY (pag_nro)            REFERENCES pagos(pag_nro)
);




