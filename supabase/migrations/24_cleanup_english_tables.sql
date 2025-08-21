-- Limpiar tablas en inglés que ya no se utilizan
-- Solo mantenemos user_settings que aún se usa en el código actual

BEGIN;

-- 1) Eliminar funciones y triggers relacionados con tablas en inglés
DROP TRIGGER IF EXISTS check_duplicate_vehicles ON parked_vehicles;
DROP TRIGGER IF EXISTS update_parked_vehicles_updated_at ON parked_vehicles;
DROP TRIGGER IF EXISTS update_user_rates_timestamp ON user_rates;

DROP FUNCTION IF EXISTS prevent_duplicate_vehicles();
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS update_user_rates_updated_at();

-- 2) Eliminar vistas basadas en tablas en inglés (ya reemplazadas por vistas en español)
DROP VIEW IF EXISTS vw_parked_vehicles;
DROP VIEW IF EXISTS vw_parking_history;

-- 3) Eliminar tablas de datos principales que ya se migraron al esquema español
-- Estas tablas fueron reemplazadas por ocupacion/vehiculos/pagos
DROP TABLE IF EXISTS parking_history CASCADE;
DROP TABLE IF EXISTS parked_vehicles CASCADE;

-- Eliminar tablas adicionales en inglés que aparecen en la base de datos
DROP TABLE IF EXISTS vehicles CASCADE;     -- reemplazada por 'vehiculos'
DROP TABLE IF EXISTS rates CASCADE;       -- reemplazada por 'tarifas'
DROP TABLE IF EXISTS tariffs CASCADE;     -- reemplazada por 'tarifas'
DROP TABLE IF EXISTS configuration CASCADE; -- tabla de configuración genérica no usada

-- 4) Eliminar tabla user_rates (solo se usa como fallback, pero ya no es necesaria)
-- Las tarifas ahora están en la tabla 'tarifas' del esquema español
DROP TABLE IF EXISTS user_rates CASCADE;

-- 5) Eliminar tabla user_capacity (ya no se usa, capacidad se maneja por plazas)
-- La capacidad ahora se calcula dinámicamente desde la tabla 'plazas'
DROP TABLE IF EXISTS user_capacity CASCADE;

-- 6) Limpiar índices huérfanos si existen
DROP INDEX IF EXISTS idx_parked_vehicles_license_plate;
DROP INDEX IF EXISTS idx_parked_vehicles_user_id;
DROP INDEX IF EXISTS idx_parking_history_license_plate;
DROP INDEX IF EXISTS idx_parking_history_user_id;
DROP INDEX IF EXISTS idx_user_rates_user_id;
DROP INDEX IF EXISTS idx_user_capacity_user_id;

-- 7) Limpiar función de ayuda de migración que ya no se necesita
DROP FUNCTION IF EXISTS map_tipo_to_segmento(TEXT);

COMMIT;

-- Comentario: Mantenemos user_settings porque aún se utiliza en:
-- - app/api/user/settings/route.ts
-- - app/api/payment/mercadopago/route.ts
-- Esta tabla se puede migrar al esquema español en una migración futura si es necesario.

-- Nota: El archivo app/api/parking/init-rates/route.ts fue actualizado para usar 
-- la tabla 'tarifas' en lugar de 'tariffs' del esquema español.
