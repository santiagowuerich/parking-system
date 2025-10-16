-- Migración para crear secuencias auto-incremento para abonos
-- Ejecutar esta migración ANTES de usar la funcionalidad de crear abonos

-- Crear secuencia para abonado.abon_id
CREATE SEQUENCE IF NOT EXISTS abonado_abon_id_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE abonado
  ALTER COLUMN abon_id SET DEFAULT nextval('abonado_abon_id_seq'::regclass);

-- Crear secuencia para abonos.abo_nro
CREATE SEQUENCE IF NOT EXISTS abonos_abo_nro_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE abonos
  ALTER COLUMN abo_nro SET DEFAULT nextval('abonos_abo_nro_seq'::regclass);

-- Marcar como completado
COMMENT ON SEQUENCE abonado_abon_id_seq IS 'Secuencia auto-generada para IDs de abonados';
COMMENT ON SEQUENCE abonos_abo_nro_seq IS 'Secuencia auto-generada para números de abonos';
