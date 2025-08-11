-- Ajustar longitud de patentes: pasar a TEXT y re-crear FKs relacionados

-- 1) Eliminar FKs que referencian vehiculos(veh_patente)
ALTER TABLE IF EXISTS pagos DROP CONSTRAINT IF EXISTS fk_pagos_vehiculo;
ALTER TABLE IF EXISTS reservas DROP CONSTRAINT IF EXISTS fk_res_vehiculo;
ALTER TABLE IF EXISTS ocupacion DROP CONSTRAINT IF EXISTS fk_ocu_vehiculo;
ALTER TABLE IF EXISTS vehiculos_abonados DROP CONSTRAINT IF EXISTS fk_va_vehiculo;

-- 2) Cambiar tipos de columnas a TEXT
ALTER TABLE vehiculos ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE pagos ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE reservas ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE ocupacion ALTER COLUMN veh_patente TYPE TEXT;
ALTER TABLE vehiculos_abonados ALTER COLUMN veh_patente TYPE TEXT;

-- 3) Re-crear FKs
ALTER TABLE pagos
  ADD CONSTRAINT fk_pagos_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE reservas
  ADD CONSTRAINT fk_res_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE ocupacion
  ADD CONSTRAINT fk_ocu_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);

ALTER TABLE vehiculos_abonados
  ADD CONSTRAINT fk_va_vehiculo FOREIGN KEY (veh_patente)
  REFERENCES vehiculos(veh_patente);




