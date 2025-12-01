-- Migración: Crear tabla de tickets de estacionamiento
-- Fecha: 2024-12-01
-- Descripción: Tabla para almacenar tickets generados después de la confirmación de pagos

-- Crear tabla de tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  ticket_id VARCHAR(20) PRIMARY KEY,
  payment_id INTEGER REFERENCES public.pagos(pag_nro),
  occupation_id INTEGER NOT NULL REFERENCES public.ocupacion(ocu_id),
  est_id INTEGER NOT NULL REFERENCES public.estacionamientos(est_id),
  ticket_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  printed_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  format VARCHAR(20) DEFAULT 'reduced' CHECK (format IN ('reduced', 'detailed', 'digital')),
  status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'printed', 'sent', 'cancelled')),
  generated_by VARCHAR(100) NOT NULL
);

-- Crear índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_tickets_occupation_id ON public.tickets(occupation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_payment_id ON public.tickets(payment_id);
CREATE INDEX IF NOT EXISTS idx_tickets_est_id ON public.tickets(est_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

-- Índice GIN para búsquedas en el JSONB (datos del ticket)
CREATE INDEX IF NOT EXISTS idx_tickets_data_gin ON public.tickets USING GIN (ticket_data);

-- Comentarios para documentación
COMMENT ON TABLE public.tickets IS 'Tickets de estacionamiento generados después de la confirmación de pagos';
COMMENT ON COLUMN public.tickets.ticket_id IS 'ID único del ticket en formato TK-YYYYMMDD-NNNNN';
COMMENT ON COLUMN public.tickets.payment_id IS 'Referencia al pago asociado (puede ser null si es entrada sin pago)';
COMMENT ON COLUMN public.tickets.occupation_id IS 'Referencia a la ocupación del estacionamiento';
COMMENT ON COLUMN public.tickets.est_id IS 'Referencia al estacionamiento';
COMMENT ON COLUMN public.tickets.ticket_data IS 'Datos completos del ticket en formato JSON';
COMMENT ON COLUMN public.tickets.created_at IS 'Fecha y hora de generación del ticket';
COMMENT ON COLUMN public.tickets.printed_at IS 'Fecha y hora en que se imprimió el ticket';
COMMENT ON COLUMN public.tickets.sent_at IS 'Fecha y hora en que se envió digitalmente';
COMMENT ON COLUMN public.tickets.format IS 'Formato del ticket: reduced, detailed, digital';
COMMENT ON COLUMN public.tickets.status IS 'Estado del ticket: generated, printed, sent, cancelled';
COMMENT ON COLUMN public.tickets.generated_by IS 'Usuario/operador que generó el ticket';

-- Función para buscar tickets por patente del vehículo
CREATE OR REPLACE FUNCTION public.search_tickets_by_plate(plate TEXT)
RETURNS SETOF public.tickets AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM public.tickets t
  WHERE t.ticket_data->>'vehicleLicensePlate' ILIKE '%' || plate || '%'
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener el próximo número de ticket del día
CREATE OR REPLACE FUNCTION public.get_next_ticket_number(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  count_today INTEGER;
  next_number TEXT;
BEGIN
  date_str := TO_CHAR(target_date, 'YYYYMMDD');
  
  SELECT COUNT(*) INTO count_today
  FROM public.tickets
  WHERE ticket_id LIKE 'TK-' || date_str || '-%';
  
  next_number := LPAD((count_today + 1)::TEXT, 5, '0');
  
  RETURN 'TK-' || date_str || '-' || next_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar el campo status cuando se imprima o envíe
CREATE OR REPLACE FUNCTION public.update_ticket_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.printed_at IS NOT NULL AND OLD.printed_at IS NULL THEN
    NEW.status := 'printed';
  END IF;
  
  IF NEW.sent_at IS NOT NULL AND OLD.sent_at IS NULL THEN
    NEW.status := 'sent';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_status
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_status();

