-- Migración: Permitir occupation_id NULL en tickets para extensiones de abono
-- Fecha: 2024-12-01
-- Descripción: Modifica la tabla tickets para permitir occupation_id NULL, necesario para tickets de extensión de abono que no tienen ocupación asociada

-- Eliminar la restricción NOT NULL y la foreign key
ALTER TABLE public.tickets 
  DROP CONSTRAINT IF EXISTS tickets_occupation_id_fkey,
  ALTER COLUMN occupation_id DROP NOT NULL;

-- Recrear la foreign key como opcional (ON DELETE SET NULL)
ALTER TABLE public.tickets 
  ADD CONSTRAINT tickets_occupation_id_fkey 
  FOREIGN KEY (occupation_id) 
  REFERENCES public.ocupacion(ocu_id) 
  ON DELETE SET NULL;

-- Actualizar comentario
COMMENT ON COLUMN public.tickets.occupation_id IS 'Referencia a la ocupación del estacionamiento (NULL para tickets de extensión de abono)';

