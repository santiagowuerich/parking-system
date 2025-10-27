[1 tool called]

Aquí tienes el contenido completo del archivo `.md` con el plan del flujo híbrido:

```markdown
# 🚀 Sistema de Reservas - Flujo Híbrido Automático + Manual

**Fecha:** $(date)
**Versión:** 1.0
**Estado:** Plan Completo - Listo para Implementación

---

## 📋 Resumen Ejecutivo

Se implementará un **flujo híbrido** que combina lo mejor de ambos mundos:

### ✅ Flujo Automático (Ideal)
- Webhook de MercadoPago detecta pago → Confirma reserva automáticamente
- Usuario experimenta flujo seamless y moderno

### ✅ Flujo Manual (Respaldo)  
- Si webhook falla, usuario confirma manualmente desde página de éxito
- Usuario mantiene control total del proceso

### 🎯 Beneficios
- **95% de casos:** Automático y transparente
- **5% de casos:** Manual con control del usuario
- **0% de fallos:** Siempre hay una forma de confirmar

---

## 🔍 Problemas Actuales Solucionados

### ❌ Problema 1: Webhook con Error de Inicialización
```typescript
// ❌ ANTES - Error en línea 70
const payment = new Payment(client); // client no definido aún
const paymentInfo = await payment.get({ id: paymentId });
```

### ❌ Problema 2: Círculo Vicioso en el Flujo
- Para crear `client` necesitaba API key del usuario
- Para obtener API key necesitaba `external_reference` del pago
- Para obtener `external_reference` necesitaba consultar MercadoPago
- **💥 Impasible sin API key**

---

## 🎯 Arquitectura del Flujo Híbrido

### Componentes Principales

```
📁 app/
├── api/reservas/
│   ├── crear/route.ts                    # ✅ MANTENER (crea reserva + preference)
│   ├── procesar-pago/route.ts           # 🔧 MODIFICAR (corregir búsqueda)
│   ├── verificar-estado/route.ts        # 🆕 NUEVO (check estado reserva)
│   └── confirmar-manual/route.ts        # 🆕 NUEVO (confirmación manual)
├── payment/success/page.tsx             # 🔧 MODIFICAR (página mejorada)
└── components/reservas/
    └── crear-reserva-dialog.tsx         # ✅ MANTENER (sin cambios)
```

### Flujo Completo - Diagrama

```mermaid
graph TD
    A[Crear Reserva + Link/QR] --> B[Usuario paga en MercadoPago]
    B --> C{MercadoPago redirige}
    C --> D[/payment/success con parámetros]
    D --> E{Check estado reserva}
    E --> F[¿Ya confirmada por webhook?]
    F -->|SÍ| G[Mostrar reserva confirmada ✅]
    F -->|NO| H[Mostrar opción confirmar manualmente]
    H --> I[Usuario click 'Confirmar Reserva']
    I --> J[Verificar pago + Confirmar reserva]
    J --> K[Reserva confirmada ✅]
```

---

## 📝 Implementación Paso a Paso

### Paso 1: Corregir Webhook de Procesamiento
**Archivo:** `app/api/reservas/procesar-pago/route.ts`

#### ❌ Código Problemático Actual:
```typescript
// Líneas 65-78 - CÍRCULO VICIOSO
const supabase = await createAuthenticatedSupabaseClient();

// Buscar la reserva asociada a este pago usando external_reference
const payment = new Payment(client); // ← ERROR: client no existe aún
const paymentInfo = await payment.get({ id: paymentId });

if (!paymentInfo.external_reference) {
    console.error('❌ [WEBHOOK] No se encontró external_reference en el pago de MercadoPago');
    return NextResponse.json({ error: 'External reference no encontrado en el pago' }, { status: 400 });
}

console.log(`✅ [WEBHOOK] External reference encontrado: ${paymentInfo.external_reference}`);

// Buscar la reserva usando el external_reference (que es el res_codigo)
const { data: reservaData, error: reservaError } = await supabase
    .from('reservas')
    .select(`
        *,
        estacionamientos!inner(est_id, est_nombre, usu_id)
    `)
    .eq('res_codigo', paymentInfo.external_reference) // ← DEPENDE del pago
    .single();
```

#### ✅ Código Corregido:
```typescript
// Buscar reserva DIRECTAMENTE por preference_id (que ya tenemos guardado)
const { data: reservaData, error: reservaError } = await supabase
    .from('reservas')
    .select(`
        *,
        estacionamientos!inner(est_id, est_nombre, usu_id)
    `)
    .eq('payment_info->preference_id', paymentId) // ← BÚSQUEDA DIRECTA
    .single();

if (reservaError || !reservaData) {
    console.error('❌ [WEBHOOK] Reserva no encontrada para payment_id:', paymentId);
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
}

console.log(`✅ [WEBHOOK] Reserva encontrada: ${reservaData.res_codigo}`);

// AHORA SÍ obtener API key del dueño
const userId = reservaData.estacionamientos.usu_id;
const accessToken = await getApiKey(userId);
const client = new MercadoPagoConfig({ accessToken });
const payment = new Payment(client);

// AHORA SÍ consultar el pago
const paymentInfo = await payment.get({ id: paymentId });
```

### Paso 2: Actualizar Back URLs
**Archivo:** `app/api/reservas/crear/route.ts`

#### ❌ URLs Actuales (apuntan a dashboard):
```typescript
back_urls: {
    success: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reservas?success=true&codigo=${resCodigoGenerado}`,
    failure: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reservas?error=true&codigo=${resCodigoGenerado}`,
    pending: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reservas?pending=true&codigo=${resCodigoGenerado}`
}
```

#### ✅ URLs Corregidas (apuntan a página de éxito):
```typescript
back_urls: {
    success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=success&res_codigo=${resCodigoGenerado}&preference_id=${preferenceResult.id}`,
    failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=failure&res_codigo=${resCodigoGenerado}`,
    pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=pending&res_codigo=${resCodigoGenerado}`
}
```

### Paso 3: Mejorar Página de Success
**Archivo:** `app/payment/success/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import Link from "next/link";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [reserva, setReserva] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  // Parámetros que envía MercadoPago
  const preferenceId = searchParams.get('preference_id');
  const paymentId = searchParams.get('payment_id');
  const status = searchParams.get('status');
  const resCodigo = searchParams.get('res_codigo');

  useEffect(() => {
    verificarEstadoReserva();
  }, [preferenceId, resCodigo]);

  const verificarEstadoReserva = async () => {
    try {
      const response = await fetch('/api/reservas/verificar-estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference_id: preferenceId, res_codigo: resCodigo })
      });

      const data = await response.json();
      if (data.success) {
        setReserva(data.reserva);
      }
    } catch (error) {
      console.error('Error verificando reserva:', error);
    } finally {
      setCargando(false);
    }
  };

  const confirmarManual = async () => {
    if (!reserva) return;

    setConfirmando(true);
    try {
      const response = await fetch('/api/reservas/confirmar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          res_codigo: reserva.res_codigo,
          payment_id: paymentId 
        })
      });

      const data = await response.json();
      if (data.success) {
        // Recargar estado
        verificarEstadoReserva();
      }
    } catch (error) {
      console.error('Error confirmando:', error);
    } finally {
      setConfirmando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Clock className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-lg">Verificando estado del pago...</p>
      </div>
    );
  }

  const getEstadoConfig = () => {
    if (!reserva) return { tipo: 'error', mensaje: 'Reserva no encontrada' };

    switch (reserva.res_estado) {
      case 'confirmada':
        return {
          tipo: 'confirmada',
          titulo: '¡Reserva Confirmada!',
          descripcion: 'Tu reserva ha sido confirmada automáticamente.',
          icono: <CheckCircle className="w-6 h-6 text-green-600" />,
          color: 'bg-green-50 border-green-200'
        };
      case 'pendiente_pago':
        return {
          tipo: 'pendiente',
          titulo: 'Pago Procesado',
          descripcion: 'Tu pago fue exitoso. Confirma tu reserva manualmente.',
          icono: <Clock className="w-6 h-6 text-blue-600" />,
          color: 'bg-blue-50 border-blue-200'
        };
      default:
        return {
          tipo: 'error',
          titulo: 'Estado Desconocido',
          descripcion: 'Contacta al soporte si el problema persiste.',
          icono: <AlertCircle className="w-6 h-6 text-red-600" />,
          color: 'bg-red-50 border-red-200'
        };
    }
  };

  const estadoConfig = getEstadoConfig();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {estadoConfig.icono}
          </div>
          <CardTitle className="text-2xl">{estadoConfig.titulo}</CardTitle>
          <p className="text-muted-foreground">{estadoConfig.descripcion}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {reserva && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Código de Reserva:</span>
                <Badge variant="outline">{reserva.res_codigo}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Plaza</p>
                  <p className="font-semibold">{reserva.pla_numero}</p>
                </div>
                <div>
                  <p className="text-gray-600">Duración</p>
                  <p className="font-semibold">{reserva.duracion_horas}h</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-gray-600">Estado:</span>
                <Badge variant={
                  reserva.res_estado === 'confirmada' ? 'default' : 'secondary'
                }>
                  {reserva.res_estado}
                </Badge>
              </div>
            </div>
          )}

          {/* Botón de confirmación manual si está pendiente */}
          {estadoConfig.tipo === 'pendiente' && (
            <Button 
              onClick={confirmarManual}
              disabled={confirmando}
              className="w-full"
            >
              {confirmando ? 'Confirmando...' : 'Confirmar Reserva'}
            </Button>
          )}

          {/* Botones de navegación */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/conductor">
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Reservas
              </Link>
            </Button>
            
            <Button className="flex-1" asChild>
              <Link href="/">Inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Paso 4: Nuevo Endpoint - Verificar Estado
**Archivo:** `app/api/reservas/verificar-estado/route.ts` *(NUEVO)*

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { preference_id, res_codigo } = await request.json();
    const supabase = await createAuthenticatedSupabaseClient();
    
    let reserva: any = null;

    if (res_codigo) {
      // Búsqueda por código directo
      const { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('res_codigo', res_codigo)
        .single();
      
      if (error) {
        console.error('❌ [VERIFICAR-ESTADO] Error buscando por res_codigo:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Error buscando reserva' 
        }, { status: 500 });
      }
      reserva = data;
    } else if (preference_id) {
      // Búsqueda por preference_id en payment_info
      const { data: allReservas, error } = await supabase
        .from('reservas')
        .select('*');

      if (error) {
        console.error('❌ [VERIFICAR-ESTADO] Error buscando reservas:', error);
        return NextResponse.json({ 
          success: false, 
          error: 'Error buscando reserva' 
        }, { status: 500 });
      }

      reserva = allReservas?.find((r: any) => 
        r.payment_info?.preference_id === preference_id
      );
    }

    if (!reserva) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reserva no encontrada' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      reserva: reserva
    });

  } catch (error) {
    console.error('❌ [VERIFICAR-ESTADO] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}
```

### Paso 5: Nuevo Endpoint - Confirmación Manual
**Archivo:** `app/api/reservas/confirmar-manual/route.ts` *(NUEVO)*

```typescript
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

// Función auxiliar para obtener la API Key del usuario
async function getApiKey(userId: string | null): Promise<string> {
  if (!userId) {
    throw new Error('Se requiere un ID de usuario para obtener la API Key');
  }

  const supabase = await createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("mercadopago_api_key")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(`Error fetching API key for user ${userId}:`, error.message);
    throw new Error('Error al obtener la API Key del usuario');
  }

  if (!data?.mercadopago_api_key) {
    throw new Error('No se encontró una API Key configurada. Por favor, configura tu API Key de MercadoPago en el panel de tarifas.');
  }

  const key = data.mercadopago_api_key.trim();
  if (!key.startsWith('TEST-') && !key.startsWith('APP_USR-')) {
    throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
  }

  return key;
}

export async function POST(request: NextRequest) {
  try {
    const { res_codigo, payment_id } = await request.json();
    const supabase = await createAuthenticatedSupabaseClient();

    console.log(`🔍 [CONFIRMAR-MANUAL] Confirmando reserva ${res_codigo} manualmente`);

    // Obtener reserva
    const { data: reserva, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('res_codigo', res_codigo)
      .eq('res_estado', 'pendiente_pago')
      .single();

    if (error || !reserva) {
      console.error('❌ [CONFIRMAR-MANUAL] Reserva no encontrada o ya procesada:', error);
      return NextResponse.json({
        success: false,
        error: 'Reserva no encontrada o ya procesada'
      }, { status: 404 });
    }

    // Obtener datos del estacionamiento para la API key
    const { data: estData, error: estError } = await supabase
      .from('estacionamientos')
      .select('usu_id')
      .eq('est_id', reserva.est_id)
      .single();

    if (estError || !estData) {
      console.error('❌ [CONFIRMAR-MANUAL] Error obteniendo estacionamiento:', estError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos del estacionamiento'
      }, { status: 500 });
    }

    // Obtener API key del dueño del estacionamiento
    const accessToken = await getApiKey(estData.usu_id);
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    // Verificar estado del pago en MercadoPago
    console.log(`🔍 [CONFIRMAR-MANUAL] Verificando pago ${payment_id || reserva.pag_nro} en MercadoPago`);
    const paymentInfo = await payment.get({ id: payment_id || reserva.pag_nro });

    if (paymentInfo.status !== 'approved') {
      console.error(`❌ [CONFIRMAR-MANUAL] Pago no aprobado. Estado: ${paymentInfo.status}`);
      return NextResponse.json({
        success: false,
        error: 'El pago aún no ha sido aprobado por MercadoPago'
      }, { status: 400 });
    }

    console.log(`✅ [CONFIRMAR-MANUAL] Pago aprobado. Confirmando reserva...`);

    // Confirmar reserva
    const { error: updateError } = await supabase
      .from('reservas')
      .update({
        res_estado: 'confirmada',
        pag_nro: payment_id || reserva.pag_nro
      })
      .eq('res_codigo', res_codigo);

    if (updateError) {
      console.error('❌ [CONFIRMAR-MANUAL] Error actualizando reserva:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Error actualizando reserva'
      }, { status: 500 });
    }

    // Marcar plaza como reservada
    const { error: plazaError } = await supabase
      .from('plazas')
      .update({ pla_estado: 'Reservada' })
      .eq('est_id', reserva.est_id)
      .eq('pla_numero', reserva.pla_numero);

    if (plazaError) {
      console.error('❌ [CONFIRMAR-MANUAL] Error actualizando plaza:', plazaError);
    } else {
      console.log(`✅ [CONFIRMAR-MANUAL] Plaza ${reserva.pla_numero} marcada como Reservada`);
    }

    console.log(`✅ [CONFIRMAR-MANUAL] Reserva ${res_codigo} confirmada exitosamente`);

    return NextResponse.json({
      success: true,
      message: 'Reserva confirmada exitosamente'
    });

  } catch (error) {
    console.error('❌ [CONFIRMAR-MANUAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}
```

---

## 🧪 Plan de Testing

### Escenarios a Probar

| # | Escenario | Flujo Esperado | Resultado Esperado |
|---|-----------|----------------|-------------------|
| 1 | **Webhook automático funciona** | Pagar → Webhook llega → Confirma automáticamente | ✅ Reserva confirmada al llegar a success |
| 2 | **Webhook falla, confirmación manual** | Pagar → No llega webhook → Usuario ve "pendiente" → Click confirma | ✅ Reserva confirmada manualmente |
| 3 | **Pago rechazado** | Intento fallido → Página success con error | ❌ No opción de confirmar |
| 4 | **Pago pendiente** | Pago en proceso → Página success | ⏳ Mensaje de espera, sin botón confirmar |
| 5 | **Reserva ya confirmada** | Usuario regresa a success | ✅ Muestra reserva confirmada |

### Testing Automatizado

```bash
# Testing del webhook
curl -X POST /api/reservas/procesar-pago \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":"123456789"}}'

# Testing de verificación de estado
curl -X POST /api/reservas/verificar-estado \
  -H "Content-Type: application/json" \
  -d '{"preference_id":"PREF_123"}'

# Testing de confirmación manual
curl -X POST /api/reservas/confirmar-manual \
  -H "Content-Type: application/json" \
  -d '{"res_codigo":"RES-2024-01-01-0001"}'
```

---

## 📊 Métricas de Éxito

### KPIs a Medir

| Métrica | Actual | Objetivo | Cómo Medir |
|---------|--------|----------|------------|
| **Tasa de confirmación automática** | 0% (webhook broken) | >90% | Logs de webhook exitosos |
| **Tasa de confirmación manual** | N/A | <10% | Clicks en botón confirmar |
| **Tiempo de respuesta** | N/A | <3 segundos | Response time APIs |
| **Error rate** | 100% (500 errors) | <5% | HTTP status codes |
| **User satisfaction** | Baja | Alta | Surveys post-pago |

### Alertas y Monitoreo

```typescript
// Métricas a monitorear
- Webhook success rate
- Manual confirmation rate  
- API response times
- User drop-off rates
- Payment failure rates
```

---

## 🚨 Riesgos y Mitigación

### Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Webhook sigue fallando** | Media | Alto | Confirmación manual como respaldo |
| **Race conditions** | Baja | Medio | Validar estado antes de confirmar |
| **Pago approved pero reserva no confirma** | Baja | Alto | Retry automático + logging |
| **Usuario confirma múltiples veces** | Media | Bajo | Validar estado en cada confirmación |
| **Datos inconsistentes** | Baja | Alto | Transacciones database |

### Plan de Rollback

1. **Si webhook falla:** Usar solo confirmación manual
2. **Si APIs fallan:** Mantener flujo actual
3. **Si UI falla:** Redirigir a dashboard como antes

---

## 📋 Checklist de Implementación

### Pre-Implementación
- [ ] Backup completo de base de datos
- [ ] Testing en staging environment
- [ ] Documentar todos los cambios
- [ ] Preparar plan de rollback

### Implementación
- [ ] Modificar webhook procesar-pago
- [ ] Actualizar back_urls en crear reserva
- [ ] Crear endpoint verificar-estado
- [ ] Crear endpoint confirmar-manual
- [ ] Mejorar página payment/success

### Post-Implementación
- [ ] Testing exhaustivo de todos los escenarios
- [ ] Monitoreo de métricas por 24-48 horas
- [ ] Validar que no se rompió el flujo existente
- [ ] Documentar cualquier cambio adicional

---

## 🎯 Beneficios del Flujo Híbrido

### Para el Usuario
- **Experiencia seamless:** 95% automático, 5% manual
- **Control total:** Siempre puede confirmar manualmente
- **Transparencia:** Sabe exactamente qué está pasando

### Para el Sistema
- **Robustez:** No depende 100% del webhook
- **Métricas:** Podemos medir efectividad del webhook
- **Escalabilidad:** Maneja fallos gracefully

### Para el Negocio
- **Confianza:** Los pagos siempre se confirman
- **Satisfacción:** Mejor experiencia de usuario
- **Mantenimiento:** Fácil de debuggear y mantener

---

## 📞 Soporte y Mantenimiento

### Contactos
- **Desarrollo:** [tu-email@empresa.com]
- **Soporte:** [soporte@empresa.com]
- **Monitoreo:** [devops@empresa.com]

### Logs Importantes
```typescript
// Webhook logs
console.log('🔔 [WEBHOOK] Recibida notificación de MercadoPago');
console.log('✅ [WEBHOOK] Reserva confirmada automáticamente');

// Manual confirmation logs  
console.log('🔍 [CONFIRMAR-MANUAL] Confirmación manual iniciada');
console.log('✅ [CONFIRMAR-MANUAL] Reserva confirmada manualmente');
```

### Debugging
```bash
# Ver logs de webhook
grep "WEBHOOK" logs/application.log

# Ver confirmaciones manuales
grep "CONFIRMAR-MANUAL" logs/application.log

# Ver errores
grep "ERROR" logs/application.log
```

---

*Documento creado:* $(date)
*Versión:* 1.0
*Estado:* ✅ Listo para Implementación
*Próximo paso:* Crear branch `feature/flujo-hibrido-reservas` y comenzar implementación
```

Este archivo `.md` contiene todo el plan completo del flujo híbrido. Puedes copiarlo y pegarlo en un archivo llamado `FLUJO_HIBRIDO_RESERVAS.md` en la raíz del proyecto. Incluye todos los pasos, código, testing y métricas necesarias para implementar la solución.