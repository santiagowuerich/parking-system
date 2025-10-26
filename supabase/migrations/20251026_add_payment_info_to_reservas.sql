-- Agregar campos para guardar información de pago en reservas
ALTER TABLE public.reservas
ADD COLUMN IF NOT EXISTS metodo_pago character varying,
ADD COLUMN IF NOT EXISTS payment_info jsonb,
ADD COLUMN IF NOT EXISTS res_codigo character varying UNIQUE,
ADD COLUMN IF NOT EXISTS res_fh_fin timestamp without time zone,
ADD COLUMN IF NOT EXISTS res_tiempo_gracia_min integer DEFAULT 15;

-- Crear índice para búsqueda rápida por código de reserva
CREATE INDEX IF NOT EXISTS idx_reservas_res_codigo ON public.reservas(res_codigo);

-- Crear índice para búsqueda rápida por estado
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas(res_estado);

-- Crear índice para búsqueda rápida por conductor
CREATE INDEX IF NOT EXISTS idx_reservas_conductor ON public.reservas(con_id);

-- Crear índice para búsqueda rápida por estacionamiento
CREATE INDEX IF NOT EXISTS idx_reservas_estacionamiento ON public.reservas(est_id);

-- Agregar comentarios para documentar los nuevos campos
COMMENT ON COLUMN public.reservas.metodo_pago IS 'Método de pago utilizado: transferencia, link_pago, qr';
COMMENT ON COLUMN public.reservas.payment_info IS 'JSON con información del pago generado (preference_id, qr_code, transfer_data, etc)';
COMMENT ON COLUMN public.reservas.res_codigo IS 'Código único de la reserva en formato RES-YYYY-MM-DD-NNNN';
COMMENT ON COLUMN public.reservas.res_fh_fin IS 'Fecha y hora de finalización de la reserva';
COMMENT ON COLUMN public.reservas.res_tiempo_gracia_min IS 'Minutos de gracia antes de liberar la plaza automáticamente';
