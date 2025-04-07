-- Añadir columna para la API Key de MercadoPago a la tabla de administradores
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS mercadopago_api_key TEXT; 