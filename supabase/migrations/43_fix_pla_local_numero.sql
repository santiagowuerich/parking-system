-- Migración para asignar pla_local_numero a plazas existentes
-- Esta migración corrige el problema de solapamiento de números en zonas

BEGIN;

-- Actualizar plazas que no tienen pla_local_numero asignado
-- Para plazas sin zona (pla_zona IS NULL), usar el mismo número que pla_numero
UPDATE plazas
SET pla_local_numero = pla_numero
WHERE pla_local_numero IS NULL;

-- Para plazas con zona, asignar números locales consecutivos por zona
-- Usar una función para recalcular números locales por zona
CREATE OR REPLACE FUNCTION update_pla_local_numero_by_zone()
RETURNS void AS $$
DECLARE
    zona_record RECORD;
    plaza_record RECORD;
    local_counter INTEGER;
BEGIN
    -- Para cada zona, recalcular los números locales
    FOR zona_record IN
        SELECT DISTINCT zona_id, est_id
        FROM plazas
        WHERE zona_id IS NOT NULL
        ORDER BY zona_id
    LOOP
        local_counter := 1;

        -- Para cada plaza en esta zona, ordenada por pla_numero
        FOR plaza_record IN
            SELECT pla_numero
            FROM plazas
            WHERE zona_id = zona_record.zona_id
            AND est_id = zona_record.est_id
            ORDER BY pla_numero
        LOOP
            UPDATE plazas
            SET pla_local_numero = local_counter
            WHERE est_id = zona_record.est_id
            AND pla_numero = plaza_record.pla_numero;

            local_counter := local_counter + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función para actualizar números locales
SELECT update_pla_local_numero_by_zone();

-- Limpiar la función temporal
DROP FUNCTION update_pla_local_numero_by_zone();

COMMIT;




