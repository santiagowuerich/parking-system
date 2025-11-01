# 🔍 ANÁLISIS COMPLETO DE ERRORES: FLUJO DE CREACIÓN DE RESERVAS

## 📋 RESUMEN EJECUTIVO

He revisado todo el flujo de creación de reservas y identificado **15 puntos críticos de error** distribuidos en 7 fases. La mayoría de los errores están relacionados con validaciones insuficientes, manejo de estados inconsistente y problemas de concurrencia.

## 🎯 ERRORES CRÍTICOS IDENTIFICADOS

### 1. ❌ **ERROR CRÍTICO**: Precio HARDCODEADO (API /crear)

**Archivo**: `app/api/reservas/crear/route.ts:328`

```typescript
// HARDCODEADO: Precio fijo de 10 pesos por hora para testing QR
const precioPorHora = 10; // Hardcodeado para testing
```

**Problema**:
- El precio está hardcodeado en 10 pesos
- NO usa la tarifa real de la plaza obtenida de la BD
- El cálculo usa `tarifaData.tar_precio` pero luego lo ignora

**Impacto**: Todos los pagos calculan precio incorrecto

**Solución**:
```typescript
const precioPorHora = tarifaData.tar_precio; // Usar tarifa real
```

---

### 2. ❌ **ERROR CRÍTICO**: Reserva NO se crea en BD

**Archivo**: `app/api/reservas/crear/route.ts:429`

```typescript
// 10. NO CREAR la reserva en BD, devolver solo datos temporales
console.log('📦 [RESERVA] Preparando datos temporales (NO se crea reserva en BD aún)...');
```

**Problema**:
- La reserva NO se guarda en la tabla `reservas`
- Solo devuelve datos temporales al frontend
- El webhook no puede encontrar la reserva porque no existe

**Impacto**: Webhook falla, pagos no se procesan

**Solución**: Crear la reserva en BD con estado `pendiente_pago`

---

### 3. ❌ **ERROR GRAVE**: Validación de Solapamiento Incorrecta

**Archivo**: `app/api/reservas/crear/route.ts:238-253`

```typescript
// Verificar solapamiento manualmente
const reservasSolapadas = reservasActivas?.filter(reserva => {
    const reservaInicio = dayjs(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires', true).toDate();
    const reservaFin = dayjs(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires', true).toDate();
    // Solapamiento: reserva existente comienza antes de que termine la nueva Y termina después de que comienza la nueva
    return reservaInicio < fechaFinDate && reservaFin > fechaInicioDate;
}) || [];
```

**Problema**:
- La lógica de solapamiento está MAL implementada
- Usa `tz('America/Argentina/Buenos_Aires', true)` que puede causar errores de conversión
- No maneja casos edge como reservas que terminan exactamente cuando comienza la nueva

**Impacto**: Reservas se pueden solapar

**Solución**: Usar la función SQL `validar_disponibilidad_plaza` para todas las validaciones

---

### 4. ❌ **ERROR GRAVE**: Webhook busca reserva que NO existe

**Archivo**: `app/api/reservas/procesar-pago/route.ts:80-88`

```typescript
// Buscar la reserva usando res_codigo directamente
const { data: reservaData, error: searchError } = await supabase
    .from('reservas')
    .select(`
  *,
  estacionamientos!inner(est_id, est_nombre, usu_id)
`)
    .eq('res_codigo', resCodigo)
    .eq('res_estado', 'pendiente_pago')
    .single();
```

**Problema**:
- Busca reserva en BD pero la reserva NO se creó en `/crear`
- El webhook siempre falla con "Reserva no encontrada"

**Impacto**: Todos los pagos de MercadoPago fallan

---

### 5. ❌ **ERROR GRAVE**: Estado Inconsistente de Reservas

**Problema**: El sistema tiene múltiples estados pero no hay transiciones claras:

- `pendiente_pago` (creado pero no pagado)
- `confirmada` (pagado exitosamente)
- `activa` (en uso)
- `completada` (finalizada)
- `expirada` (tiempo de pago expiró)
- `no_show` (llegó tarde)
- `cancelada` (pago rechazado)

**Problema**: No hay máquina de estados clara, transiciones inconsistentes

---

### 6. ❌ **ERROR MEDIO**: Validación de Tiempo Solo Día Actual

**Archivo**: `lib/utils/reservas-utils.ts:30-50`

```typescript
export function validarTiempoReserva(fechaInicio: string): { valido: boolean; error?: string } {
    // Solo permite reservas para el día actual
    if (!diaInicio.isSame(hoyArgentina)) {
        return { valido: false, error: 'Solo se pueden hacer reservas para el día actual' };
    }
}
```

**Problema**:
- Solo permite reservas para el día actual
- No permite reservas anticipadas
- Limita mucho la usabilidad

**Solución**: Permitir reservas anticipadas hasta cierto límite (ej: 7 días)

---

### 7. ❌ **ERROR MEDIO**: Función SQL `get_tarifa_vigente` NO existe

**Archivo**: `app/api/reservas/crear/route.ts:307-315`

```typescript
const { data: tarifaData, error: tarifaError } = await supabase
    .from('tarifas')
    .select('tar_precio')
    .eq('plantilla_id', plazaData.plantilla_id)
    .eq('catv_segmento', plazaData.catv_segmento)
    .lte('tar_f_desde', fechaInicioDate.toISOString())
    .order('tar_f_desde', { ascending: false })
    .limit(1)
    .single();
```

**Problema**:
- El código menciona `get_tarifa_vigente` pero NO existe
- Usa query manual que puede fallar si hay múltiples tarifas válidas

**Solución**: Crear función SQL `get_tarifa_vigente`

---

### 8. ❌ **ERROR MEDIO**: Manejo de Timezone Inconsistente

**Problemas**:
- `dayjs().tz('America/Argentina/Buenos_Aires')` vs `dayjs().tz('America/Argentina/Buenos_Aires', true)`
- Conversiones de timezone en múltiples lugares
- Riesgo de errores en fechas límite

---

### 9. ❌ **ERROR MEDIO**: Falta Validación de Concurrencia

**Problema**: No hay protección contra race conditions cuando:
- Múltiples usuarios intentan reservar la misma plaza al mismo tiempo
- Un usuario reserva mientras otro está pagando

**Impacto**: Doble reserva de la misma plaza

**Solución**: Usar transacciones SQL o locks

---

### 10. ❌ **ERROR MEDIO**: API Key de MercadoPago por Usuario

**Archivo**: `app/api/reservas/crear/route.ts:36-96`

```typescript
// Obtener API key del PROPIETARIO del estacionamiento
const { data: usuarioData, error: usuarioError } = await supabase
    .from("usuario")
    .select("auth_user_id")
    .eq("usu_id", estData.due_id)  // due_id = propietario
    .single();
```

**Problema**:
- Cada propietario debe configurar su propia API Key
- Si no tiene API Key, falla todo el proceso
- No hay fallback a API Key global

**Impacto**: Propietarios sin API Key no pueden recibir pagos

---

### 11. ❌ **ERROR MEDIO**: Falta Validación de Datos del Vehículo

**Archivo**: `app/api/reservas/crear/route.ts:198-213`

```typescript
const { data: vehiculo, error: vehiculoError } = await supabase
    .from('vehiculos')
    .select('veh_patente, catv_segmento')
    .eq('veh_patente', veh_patente)
    .eq('con_id', conductor.con_id)
    .single();
```

**Problema**:
- Solo valida que el vehículo exista y pertenezca al conductor
- NO valida que el vehículo esté activo o habilitado
- NO valida que el tipo de vehículo sea compatible con la plaza

---

### 12. ❌ **ERROR MEDIO**: Error en Generación de Código de Reserva

**Archivo**: `app/api/reservas/crear/route.ts:13-33`

```typescript
// Obtener el último código del día
const { data: ultimasReservas, error } = await supabase
    .from('reservas')
    .select('res_codigo')
    .like('res_codigo', `RES-${fecha}-%`)
    .order('res_codigo', { ascending: false })
    .limit(1);
```

**Problema**:
- Busca códigos en tabla `reservas` pero la reserva aún no existe
- Puede generar códigos duplicados si hay concurrencia

**Solución**: Usar la función SQL `generar_codigo_reserva()` que ya existe

---

### 13. ❌ **ERROR MEDIO**: Falta Validación de Estado de Plaza

**Problema**: Solo usa `validar_disponibilidad_plaza` para reservas, pero no valida:
- Si la plaza está en mantenimiento
- Si la plaza está reservada para otro tipo de vehículo
- Estado físico de la plaza

---

### 14. ❌ **ERROR MEDIO**: Manejo de Errores en Webhook

**Archivo**: `app/api/reservas/procesar-pago/route.ts:42-50`

```typescript
// Validar firma del webhook (opcional)
if (!validateWebhookSignature(request)) {
    console.error('❌ [WEBHOOK] Firma inválida');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
}
```

**Problema**:
- La validación de firma está desactivada (`return true`)
- No hay reintentos automáticos
- No hay logging detallado de errores de MercadoPago

---

### 15. ❌ **ERROR MEDIO**: Falta Sistema de Expiración Automática

**Problema**:
- Hay API `/api/reservas/expirar` pero NO se ejecuta automáticamente
- Reservas `pendiente_pago` quedan colgadas
- No hay cron job configurado

**Solución**: Configurar cron job o usar Vercel Cron

---

## 🔧 SOLUCIONES PROPUESTAS

### **1. Solución Inmediata para el Error Crítico**

Crear nueva versión de `/api/reservas/crear` que:

1. **Use tarifa real** (no hardcodeada)
2. **Cree reserva en BD** con estado `pendiente_pago`
3. **Use función SQL** para validar disponibilidad
4. **Use `generar_codigo_reserva()`** para códigos únicos

### **2. Arquitectura Mejorada**

```
Frontend → API Crear → Crear Reserva (BD) → MercadoPago → Webhook → Actualizar Estado
     ↓         ↓             ↓               ↓              ↓            ↓
 Validar   Validar       Estado:        Crear         Procesar      Estado:
 Datos     Disponibilidad pendiente_pago  Preference     Pago        confirmada
```

### **3. Sistema de Estados Robusto**

Implementar máquina de estados con transiciones controladas:

```typescript
enum EstadoReserva {
    PENDIENTE_PAGO = 'pendiente_pago',
    CONFIRMADA = 'confirmada',
    ACTIVA = 'activa',
    COMPLETADA = 'completada',
    CANCELADA = 'cancelada',
    EXPIRADA = 'expirada',
    NO_SHOW = 'no_show'
}

function puedeTransitar(estadoActual: EstadoReserva, estadoNuevo: EstadoReserva): boolean {
    // Lógica de transiciones válidas
}
```

### **4. Manejo de Concurrencia**

```sql
-- Usar SELECT FOR UPDATE para evitar race conditions
SELECT * FROM plazas
WHERE est_id = ? AND pla_numero = ?
FOR UPDATE;

-- Crear reserva solo si plaza sigue disponible
```

### **5. Sistema de Expiración Automático**

- **Vercel Cron**: Configurar función que se ejecute cada 5 minutos
- **GitHub Actions**: Workflow schedulado
- **Base de datos**: Trigger que expire automáticamente

---

## ⚠️ IMPACTO DE LOS ERRORES

### **Errores Críticos** (1-4):
- ❌ Sistema completamente roto
- ❌ No se pueden crear reservas que funcionen
- ❌ Pagos fallan sistemáticamente

### **Errores Graves** (5-7):
- ⚠️ Sistema funcional pero con bugs importantes
- ⚠️ Experiencia de usuario degradada
- ⚠️ Posibles pérdidas económicas

### **Errores Medios** (8-15):
- ℹ️ Sistema funciona pero puede mejorar
- ℹ️ Riesgos de edge cases
- ℹ️ Problemas de escalabilidad

---

## 🎯 PLAN DE ACCIÓN

### **Fase 1: Soluciones Críticas** (1-2 semanas)
1. ✅ Crear función `get_tarifa_vigente`
2. ✅ Modificar `/api/reservas/crear` para crear reservas en BD
3. ✅ Corregir cálculo de precio (usar tarifa real)
4. ✅ Configurar cron job para expiración automática

### **Fase 2: Mejoras de Robustez** (2-3 semanas)
1. Implementar máquina de estados
2. Agregar validaciones de concurrencia
3. Mejorar manejo de errores en webhook
4. Sistema de reintentos para webhooks fallidos

### **Fase 3: Optimizaciones** (1-2 semanas)
1. Permitir reservas anticipadas
2. Mejorar validaciones de vehículos
3. Sistema de notificaciones
4. Dashboard de monitoreo

---

## 📊 MÉTRICAS DE ÉXITO

- ✅ 100% de reservas creadas llegan a MercadoPago
- ✅ 95%+ de webhooks procesados exitosamente
- ✅ 0% de reservas solapadas
- ✅ 99%+ de transiciones de estado correctas
- ✅ < 5 min de tiempo de respuesta en APIs críticas
