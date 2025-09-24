-- Tabla para gestión de turnos de empleados (con caja básica)
CREATE TABLE IF NOT EXISTS turnos_empleados (
    tur_id SERIAL PRIMARY KEY,
    play_id INTEGER NOT NULL REFERENCES usuario(usu_id),
    est_id INTEGER NOT NULL REFERENCES estacionamientos(est_id),
    tur_fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tur_hora_entrada TIME NOT NULL,
    tur_hora_salida TIME NULL,
    tur_estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (tur_estado IN ('activo', 'finalizado')),
    tur_observaciones_entrada TEXT NULL,
    tur_observaciones_salida TEXT NULL,

    -- Caja básica integrada en el turno
    caja_inicio DECIMAL(10,2) NOT NULL,
    caja_final DECIMAL(10,2) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Índices para mejorar rendimiento
    INDEX idx_turnos_empleado_estado (play_id, est_id, tur_estado),
    INDEX idx_turnos_fecha (tur_fecha),

    -- Constraint para evitar múltiples turnos activos
    UNIQUE KEY unique_turno_activo (play_id, est_id, tur_estado)
    WHERE tur_estado = 'activo'
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_turnos_empleados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_turnos_empleados_updated_at
    BEFORE UPDATE ON turnos_empleados
    FOR EACH ROW
    EXECUTE FUNCTION update_turnos_empleados_updated_at();

-- Insertar algunos datos de prueba (opcional)
-- INSERT INTO turnos_empleados (play_id, est_id, tur_fecha, tur_hora_entrada, tur_estado, tur_observaciones_entrada)
-- VALUES (1, 85, CURRENT_DATE, '08:00:00', 'activo', 'Turno de prueba');