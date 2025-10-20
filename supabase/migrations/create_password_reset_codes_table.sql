-- Tabla para almacenar códigos de verificación para recuperación de contraseña
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_code ON password_reset_codes(code);
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires_at ON password_reset_codes(expires_at);

-- Función para limpiar códigos expirados (ejecutar periódicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_codes
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE password_reset_codes IS 'Almacena códigos de verificación para recuperación de contraseña';
COMMENT ON COLUMN password_reset_codes.email IS 'Email del usuario que solicita el cambio de contraseña';
COMMENT ON COLUMN password_reset_codes.code IS 'Código de verificación de 6 dígitos';
COMMENT ON COLUMN password_reset_codes.expires_at IS 'Fecha y hora de expiración del código';
COMMENT ON COLUMN password_reset_codes.used IS 'Indica si el código ya fue utilizado';
