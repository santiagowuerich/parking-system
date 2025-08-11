-- Semillas de catálogos básicos

-- cat_vehiculo (códigos de 3 letras por ser CHAR(3))
INSERT INTO cat_vehiculo (catv_segmento, catv_descripcion) VALUES
  ('AUT', 'Auto'),
  ('MOT', 'Moto'),
  ('CAM', 'Camioneta')
ON CONFLICT (catv_segmento) DO NOTHING;

-- tipo_plaza
INSERT INTO tipo_plaza (pla_tipo, pla_descripcion) VALUES
  ('Normal', 'Plaza estándar'),
  ('VIP', 'Plaza preferencial'),
  ('Reservada', 'Plaza reservada')
ON CONFLICT (pla_tipo) DO NOTHING;

-- metodos_pagos
INSERT INTO metodos_pagos (mepa_metodo, mepa_descripcion) VALUES
  ('Efectivo', 'Pago en efectivo'),
  ('Transferencia', 'Transferencia bancaria'),
  ('MercadoPago', 'Pago vía MercadoPago')
ON CONFLICT (mepa_metodo) DO NOTHING;

-- tipotarifas
INSERT INTO tipotarifas (tiptar_nro, tiptar_descrip) VALUES
  (1, 'Hora'),
  (2, 'Diaria'),
  (3, 'Mensual')
ON CONFLICT (tiptar_nro) DO NOTHING;




