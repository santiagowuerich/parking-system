# 🎫 ANÁLISIS COMPLETO: FLUJO DE CREACIÓN Y PAGO DE RESERVAS

## 📋 ESTADO DE LA RESERVA

### Estados Posibles (7 Estados):

```
PENDIENTE_PAGO (🟡 Amarillo)
  ↓ Usuario crea reserva pero AÚN NO PAGÓ
  
CONFIRMADA (🔵 Azul)
  ↓ Usuario PAGÓ exitosamente, listo para usar
  
ACTIVA (🟢 Verde)
  ↓ Operador confirmó la llegada, plaza OCUPADA
  
COMPLETADA (⚫ Gris)
  ↓ Fin automático, conductor se fue
  
CANCELADA (🔴 Rojo)
  ↓ Pago fue RECHAZADO
  
EXPIRADA (🟠 Naranja)
  ↓ Confirmada pero no llegó a tiempo
  
NO_SHOW (🔴 Rojo Oscuro)
  ↓ Llegó fuera del tiempo de gracia
```

---

## 🔄 FLUJO PASO A PASO

### FASE 1: CONDUCTOR CREA RESERVA (Frontend)

**Ubicación**: `/conductor` - Mapa con estacionamientos

```
1. Usuario hace clic en "Reservar" para un estacionamiento
2. Dialog "Crear Reserva" se abre
3. Sistema obtiene plazas disponibles automáticamente
4. Usuario selecciona:
   - Plaza (selector dinámico)
   - Hora de Inicio (15, 30, 45 minutos - máx 2h)
   - Duración (1-24 horas)
   - Método de Pago:
     a) Transferencia Bancaria
     b) MercadoPago (Link de Pago)
     c) MercadoPago (QR)
5. Sistema calcula: precio = tarifa_por_hora × duracion_horas
6. Vehículo del usuario se muestra automáticamente
7. Usuario hace clic en "Crear Reserva"
```

---

### FASE 2: CREAR RESERVA (Backend - POST /api/reservas/crear)

**Que recibe**:
```javascript
{
  est_id: 100,
  pla_numero: 4,
  veh_patente: "EEE159",
  fecha_inicio: "2025-10-26T00:30:00Z",
  duracion_horas: 1,
  metodo_pago: "link_pago" | "transferencia" | "qr"
}
```

**Validaciones críticas**:
```
✓ Todos los parámetros requeridos
✓ Tiempo de reserva (15 min - 2h desde ahora)
✓ Solo para el día actual
✓ Duración entre 1-24 horas
✓ Método de pago válido
✓ Usuario autenticado
✓ Conductor existe en BD
✓ Vehículo existe
✓ Plaza existe
✓ Tarifa configurada
✓ Plaza no tiene conflictos de horarios
```

**Cálculos**:
```
- fecha_fin = fecha_inicio + duracion_horas
- precio_total = tarifa × duracion_horas
- tiempo_gracia = 15 minutos (fijo)
```

**Crea registro en tabla 'reservas'**:
```sql
INSERT INTO reservas (
  est_id, 
  pla_numero, 
  veh_patente, 
  res_fh_ingreso, 
  res_fh_fin, 
  con_id, 
  res_estado,         -- ⭐ PENDIENTE_PAGO
  res_monto, 
  res_tiempo_gracia_min, 
  res_created_at, 
  res_codigo          -- Auto-generado: RES-YYYYMMDD-XXXX
) VALUES (...)
```

**⭐ PUNTO CLAVE**: La reserva se crea con `res_estado = 'pendiente_pago'`

---

### FASE 3: PROCESAMIENTO DE PAGO

#### Opción A: TRANSFERENCIA BANCARIA

```
1. Backend obtiene datos bancarios del estacionamiento:
   - CBU del propietario
   - Alias (ej: "estacionamiento.reservas")
   - Titular de la cuenta

2. Retorna al Frontend:
   {
     success: true,
     data: {
       reserva: { 
         res_codigo: "RES-20251025-0011", 
         res_monto: 1000, 
         ...
       },
       payment_info: {
         transfer_data: {
           cbu: "0072070078000001234567",
           alias: "estacionamiento.reservas",
           account_holder: "Estacionamiento ABC",
           reference: "RES-RES-20251025-0011"
         }
       }
     }
   }

3. Frontend muestra dialog con datos para transferir
   - Monto: $1.000
   - Referencia: RES-20251025-0011
   - CBU: 0072070078000001234567
   - Alias: estacionamiento.reservas
   - Titular: Estacionamiento ABC

⚠️ PROBLEMA ACTUAL:
   - NO HAY CONFIRMACIÓN AUTOMÁTICA
   - Usuario transfiere manualmente
   - res_estado SIGUE siendo "pendiente_pago"
   - Usuario debe esperar o recargar página
   
💡 SOLUCIÓN:
   - Agregar API key bancario (ej: Banco API)
   - O permitir que operador confirme manualmente
```

---

#### Opción B: MERCADOPAGO - LINK DE PAGO

```
1. Backend crea Preference en MercadoPago:
   {
     items: [{
       title: "Reserva Estacionamiento - Plaza 4",
       description: "1 hora(s) para vehículo EEE159",
       quantity: 1,
       unit_price: 1000,
       currency_id: "ARS"
     }],
     external_reference: "RES-20251025-0011",  ← ID único
     metadata: {
       tipo: "reserva",
       res_codigo: "RES-20251025-0011",
       est_id: 100,
       pla_numero: 4,
       con_id: 96,
       veh_patente: "EEE159"
     },
     notification_url: "/api/reservas/procesar-pago",  ← WEBHOOK
     back_urls: {
       success: "/dashboard/reservas?success=true&codigo=...",
       failure: "/dashboard/reservas?error=true&codigo=...",
       pending: "/dashboard/reservas?pending=true&codigo=..."
     },
     auto_return: "approved",
     expiration_date_to: now() + 15 minutos  ← ⭐ EXPIRA EN 15 MIN
   }

2. MercadoPago retorna:
   {
     id: "12345678",
     init_point: "https://www.mercadopago.com.ar/checkout/v1/...",
     sandbox_init_point: "https://sandbox.mercadopago.com/..."
   }

3. Frontend abre link en nueva pestaña:
   window.open(init_point, '_blank')

4. Usuario completa pago en MercadoPago
   ✅ Aprobado → MercadoPago envía WEBHOOK
   ❌ Rechazado → MercadoPago envía WEBHOOK
   ⏳ Pendiente → Sin acción

⭐ res_estado SIGUE siendo "pendiente_pago" HASTA webhook
```

---

#### Opción C: MERCADOPAGO - QR

```
1. Backend crea Preference (similar a Link de Pago)
   Pero TAMBIÉN extrae código QR:
   qr_code = preferenceResult.point_of_interaction?.transaction_data?.qr_code

2. Frontend muestra:
   ┌────────────────────────────────────┐
   │   ESCANEA CÓDIGO QR PARA PAGAR     │
   │                                    │
   │       [  QR CODE IMAGE  ]          │
   │       (código 2D aquí)             │
   │                                    │
   │   Monto: $1.000                    │
   │   Reserva: RES-20251025-0011       │
   └────────────────────────────────────┘

3. Usuario escanea con teléfono
   → Se abre MercadoPago en el celular
   → Realiza pago

4. MercadoPago envía WEBHOOK

⭐ res_estado SIGUE siendo "pendiente_pago" HASTA webhook
```

---

### FASE 4: WEBHOOK DE MERCADOPAGO (POST /api/reservas/procesar-pago)

**MercadoPago envía POST**:
```javascript
{
  topic: "payment",
  id: "12345678",
  data: {
    id: "12345678"
  }
}
```

**Backend procesa**:
```
1. Extrae payment_id: "12345678"
2. Busca reserva por res_codigo (external_reference)
3. Llama MercadoPago API para obtener estado del pago
4. MercadoPago API retorna estado:
   - "approved"    → Pago ACEPTADO ✅
   - "rejected"    → Pago RECHAZADO ❌
   - "cancelled"   → Pago CANCELADO ❌
   - "pending"     → Pago PENDIENTE ⏳
```

**Actualiza BD según estado**:

```sql
-- SI PAGO APROBADO ✅
UPDATE reservas 
SET res_estado = "confirmada",    ← ⭐ CAMBIO DE ESTADO
    pag_nro = "12345678"          ← Guarda ID del pago
WHERE res_codigo = "RES-20251025-0011"

-- SI PAGO RECHAZADO ❌
UPDATE reservas 
SET res_estado = "cancelada"      ← ⭐ NO SE PUEDE USAR
WHERE res_codigo = "RES-20251025-0011"

-- SI PAGO PENDIENTE ⏳
UPDATE reservas 
SET res_estado = "pendiente_pago"
WHERE res_codigo = "RES-20251025-0011"
```

---

### FASE 5: CONFIRMACIÓN DE LLEGADA (Operador)

**Ubicación**: `/dashboard/operador` - Sección de Reservas

**Operador busca reserva por**:
- Código: "RES-20251025-0011"
- O Patente: "EEE159"

**Backend verifica (POST /api/reservas/confirmar-llegada)**:
```
1. res_estado = "confirmada"        ← DEBE HABER PAGADO
2. Está dentro del tiempo de gracia (15 min después de res_fh_ingreso)
3. Plaza está libre (pla_estado != "Ocupada")
```

**Si TODO correcto ✅**:
```sql
-- Crea ocupación
INSERT INTO ocupacion (
  est_id,
  veh_patente,
  ocu_fh_entrada,
  pla_numero,
  ocu_duracion_tipo: "reserva",  ← Tipo especial
  ocu_precio_acordado: 1000,
  pag_nro: (del pago MercadoPago)
) VALUES (...)

-- Actualiza reserva
UPDATE reservas 
SET res_estado = "activa"         ← ⭐ EN USO
WHERE res_codigo = "RES-20251025-0011"

-- Actualiza plaza
UPDATE plazas 
SET pla_estado = "Ocupada"
WHERE est_id = 100 AND pla_numero = 4
```

**Si NO está en tiempo de gracia ❌**:
```sql
UPDATE reservas 
SET res_estado = "no_show"        ← EXPIRÓ
WHERE res_codigo = "RES-20251025-0011"

-- Error: "La reserva ha expirado. El conductor llegó fuera del tiempo de gracia."
```

---

### FASE 6: EXPIRACIÓN AUTOMÁTICA (Cron Job)

**Endpoint**: GET `/api/reservas/expirar`

**Se ejecuta cada 5 minutos** (via cron job externo):

```sql
-- Busca reservas que pasaron el tiempo de gracia
SELECT * FROM reservas
WHERE res_estado = "confirmada"
  AND res_fh_ingreso + (res_tiempo_gracia_min || ' minutes') < now()
LIMIT 1000

-- Actualiza a "no_show"
UPDATE reservas 
SET res_estado = "no_show"
WHERE [condiciones arriba]
```

**Ejemplo**:
```
- res_fh_ingreso: 2025-10-26 00:30
- res_tiempo_gracia_min: 15 minutos
- Hora actual: 2025-10-26 00:50
- 50 - 30 = 20 minutos > 15 minutos ← EXPIRADA
→ res_estado = "no_show"
```

---

## ✅ ESTADO ACTUAL DEL SISTEMA

### Lo que FUNCIONA ✅

1. **Crear Reserva**
   - Validaciones completas
   - Cálculo de precio correcto
   - Se crea con `res_estado = "pendiente_pago"`
   - Código único generado

2. **MercadoPago - Link de Pago**
   - Crea preference correctamente
   - Abre link en nueva pestaña
   - Webhook espera pago

3. **MercadoPago - QR**
   - Genera código QR
   - Se muestra en dialog
   - Webhook espera pago

4. **Webhook Procesar Pago**
   - Recibe notificación de MercadoPago
   - Actualiza `res_estado` a "confirmada" si aprobado
   - Actualiza `res_estado` a "cancelada" si rechazado

5. **Confirmación de Llegada**
   - Verifica tiempo de gracia
   - Crea ocupación
   - Cambia `res_estado` a "activa"

6. **Expiración Automática**
   - API implementada
   - Solo necesita cron job

---

### Lo que NECESITA MEJORAR 🔴

1. **Transferencia Bancaria**
   - ❌ NO HAY CONFIRMACIÓN AUTOMÁTICA
   - Usuario transfiere manualmente
   - Sistema no sabe si el usuario pagó
   - res_estado se queda en "pendiente_pago"
   
   **Soluciones posibles**:
   - Agregar integración con banco (webhooks)
   - O: Permitir que operador confirme manualmente el pago
   - O: Crear API para que usuario confirme que transfirió

2. **Cron Job para Expiración**
   - ❌ Endpoint existe pero NO se ejecuta automáticamente
   - Necesita: Ej. GitHub Actions, Vercel Cron, o servicio externo
   
   **Soluciones**:
   - Vercel Cron Functions (si usas Vercel)
   - GitHub Actions schedulado
   - Render Background Jobs
   - Heroku Scheduler

3. **Validaciones en Confirmación de Llegada**
   - ✓ Verifica tiempo de gracia
   - ✓ Verifica plaza libre
   - ✓ Verifica res_estado = "confirmada"
   
   **Falta considerar**:
   - ¿Qué si se vence una reserva mientras el usuario está pagando?
   - ¿Penalty si no llega?

---

## 🎯 FLUJO RESUMIDO

```
1️⃣ CREAR RESERVA
   Conductor: /conductor → Clic "Reservar"
   Backend: POST /api/reservas/crear
   BD: res_estado = "pendiente_pago" ← Estado inicial
   ↓

2️⃣ PAGAR
   A) Transferencia: Usuario transfiere manual (SIN confirmación)
   B) MercadoPago: Webhook confirma estado
   ↓

3️⃣ CONFIRMAR PAGO (solo MercadoPago)
   MercadoPago: Envía webhook
   Backend: POST /api/reservas/procesar-pago
   BD: res_estado = "confirmada" ← SI pago aprobado
   ↓

4️⃣ LLEGAR AL ESTACIONAMIENTO
   Operador: Busca reserva en /dashboard/operador
   Backend: POST /api/reservas/confirmar-llegada
   BD: res_estado = "activa" ← EN USO
   ↓

5️⃣ USAR PLAZA
   Sistema: Crea ocupación
   ↓

6️⃣ SALIR
   Fin automático
   BD: res_estado = "completada"
```

---

## ⚙️ CONFIGURACIONES NECESARIAS

### Para MercadoPago:

```
1. En .env.local:
   NEXT_PUBLIC_MP_PUBLIC_KEY=... (de Credenciales de prueba)
   MP_ACCESS_TOKEN=... (de Credenciales de prueba)

2. En estacionamiento_configuraciones:
   mp_access_token = (del propietario del estacionamiento)

3. Webhook URL debe ser accesible:
   https://tuapp.com/api/reservas/procesar-pago
```

### Para Expiración Automática:

```
1. Opción A - Vercel Cron (si usas Vercel):
   - Convertir route a route handler con cron
   
2. Opción B - GitHub Actions:
   - Crear workflow que llame /api/reservas/expirar cada 5 min
   
3. Opción C - Servicio externo:
   - Ej: node-schedule en un worker
```

---

## 💡 RECOMENDACIONES

1. **Transferencia Bancaria**: Implementar API para que usuario confirme manualmente
   ```javascript
   POST /api/reservas/confirmar-pago-transferencia
   {
     res_codigo: "RES-20251025-0011",
     confirmado: true
   }
   // Esto cambiaría a "confirmada" pero sin verificación real
   ```

2. **Expiración**: Configurar cron job en tu plataforma de hosting

3. **Testing**: Usar sandbox de MercadoPago antes de producción

4. **Monitoreo**: Logs en todas las transiciones de estado
