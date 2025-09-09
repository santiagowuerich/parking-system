-- Fix: Función thread-safe para asignación de IDs de estacionamientos
-- Evita conflictos de concurrencia al crear nuevos estacionamientos

-- 1. Crear función para obtener el siguiente ID disponible de manera thread-safe
CREATE OR REPLACE FUNCTION get_next_est_id()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_id INTEGER;
    max_id INTEGER;
BEGIN
    -- Obtener el máximo ID actual
    SELECT COALESCE(MAX(est_id), 0) INTO max_id FROM estacionamientos;

    -- El siguiente ID es max_id + 1
    next_id := max_id + 1;

    -- Verificar que el ID no esté en uso (por si acaso)
    WHILE EXISTS (SELECT 1 FROM estacionamientos WHERE est_id = next_id) LOOP
        next_id := next_id + 1;
    END LOOP;

    RETURN next_id;
END;
$$;

-- 2. Crear tabla de secuencia para estacionamientos (opcional pero recomendado)
CREATE TABLE IF NOT EXISTS estacionamiento_sequence (
    sequence_name TEXT PRIMARY KEY,
    current_value INTEGER NOT NULL DEFAULT 0
);

-- Insertar valor inicial si no existe
INSERT INTO estacionamiento_sequence (sequence_name, current_value)
SELECT 'est_id_seq', COALESCE(MAX(est_id), 0)
FROM estacionamientos
WHERE NOT EXISTS (SELECT 1 FROM estacionamiento_sequence WHERE sequence_name = 'est_id_seq');

-- 3. Función alternativa usando la tabla de secuencia
CREATE OR REPLACE FUNCTION get_next_est_id_v2()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_id INTEGER;
BEGIN
    -- Usar UPSERT para incrementar la secuencia de manera atómica
    INSERT INTO estacionamiento_sequence (sequence_name, current_value)
    VALUES ('est_id_seq', 1)
    ON CONFLICT (sequence_name)
    DO UPDATE SET current_value = estacionamiento_sequence.current_value + 1
    RETURNING current_value INTO next_id;

    RETURN next_id;
END;
$$;

-- 4. Actualizar la secuencia para que coincida con el máximo ID actual
UPDATE estacionamiento_sequence
SET current_value = GREATEST(current_value, (SELECT COALESCE(MAX(est_id), 0) FROM estacionamientos))
WHERE sequence_name = 'est_id_seq';

-- 5. Comentarios explicativos
COMMENT ON FUNCTION get_next_est_id() IS 'Obtiene el siguiente ID disponible para estacionamientos de manera segura';
COMMENT ON FUNCTION get_next_est_id_v2() IS 'Versión alternativa usando tabla de secuencia para mayor robustez';
COMMENT ON TABLE estacionamiento_sequence IS 'Tabla para manejar secuencias de IDs de manera thread-safe';
