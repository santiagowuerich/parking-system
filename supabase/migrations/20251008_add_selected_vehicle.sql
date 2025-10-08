-- Agregar campo para guardar el vehículo seleccionado del conductor
-- Fecha: 2025-10-08
-- Versión: 1.0

-- Agregar columna para almacenar la patente del vehículo seleccionado
ALTER TABLE usuario
ADD COLUMN selected_vehicle_id VARCHAR(50) REFERENCES vehiculos(veh_patente) ON DELETE SET NULL;

-- Crear índice para mejorar performance en consultas frecuentes
CREATE INDEX idx_usuario_selected_vehicle ON usuario(selected_vehicle_id);

-- Agregar comentario explicativo para documentación
COMMENT ON COLUMN usuario.selected_vehicle_id
IS 'Patente del vehículo seleccionado actualmente por el conductor. NULL si no hay selección activa.';

-- Comentario de la migración:
-- Esta migración añade la funcionalidad para que los conductores puedan seleccionar
-- un vehículo como "activo" para búsquedas automáticas de estacionamientos.
-- El campo selected_vehicle_id referencia a veh_patente en la tabla vehiculos
-- con ON DELETE SET NULL para mantener integridad cuando se borra un vehículo.
