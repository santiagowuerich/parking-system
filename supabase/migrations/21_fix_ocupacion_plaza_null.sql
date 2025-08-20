-- Migración para permitir NULL en pla_numero de la tabla ocupacion
-- Esto permite que los vehículos no tengan plaza asignada sin usar plaza "0"

BEGIN;

-- 1. Eliminar la foreign key constraint que incluye pla_numero
ALTER TABLE ocupacion DROP CONSTRAINT IF EXISTS fk_ocu_plaza;

-- 2. Eliminar la primary key constraint actual
ALTER TABLE ocupacion DROP CONSTRAINT IF EXISTS pk_ocupacion;

-- 3. Agregar una columna ID autoincremental para la nueva primary key
ALTER TABLE ocupacion ADD COLUMN IF NOT EXISTS ocu_id SERIAL;

-- 4. Crear nueva primary key usando solo ocu_id
ALTER TABLE ocupacion ADD CONSTRAINT pk_ocupacion PRIMARY KEY (ocu_id);

-- 5. Permitir NULL en pla_numero
ALTER TABLE ocupacion ALTER COLUMN pla_numero DROP NOT NULL;

-- 6. Recrear la foreign key constraint para plazas pero permitiendo NULL
ALTER TABLE ocupacion ADD CONSTRAINT fk_ocu_plaza 
    FOREIGN KEY (est_id, pla_numero) 
    REFERENCES plazas(est_id, pla_numero) 
    ON DELETE SET NULL;

-- 7. Crear índices únicos para mantener integridad de datos
-- Un vehículo no puede estar en múltiples ocupaciones activas al mismo tiempo
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocupacion_vehiculo_activo 
    ON ocupacion (veh_patente) 
    WHERE ocu_fh_salida IS NULL;

-- 8. Índice para consultas frecuentes por estacionamiento y fecha
CREATE INDEX IF NOT EXISTS idx_ocupacion_est_fecha 
    ON ocupacion (est_id, ocu_fh_entrada);

-- 9. Actualizar registros existentes: cambiar plaza 0 a NULL
UPDATE ocupacion SET pla_numero = NULL WHERE pla_numero = 0;

-- 10. Eliminar la plaza "0" ficticia que ya no necesitamos
DELETE FROM plazas WHERE pla_numero = 0;

COMMIT;
