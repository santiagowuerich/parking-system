# Plan: Modelo Intermedio para Generación de Tickets de Estacionamiento

## 📋 Resumen Ejecutivo

Este plan describe la implementación de un modelo intermedio que consolida toda la información necesaria para generar tickets de estacionamiento reducidos después de la confirmación de pagos. El sistema creará automáticamente un objeto `ParkingTicket` que puede ser utilizado tanto para impresión como para almacenamiento digital.

## 🎯 Objetivos

- **Consolidar datos**: Unificar información de pago, estacionamiento y vehículo en un solo modelo
- **Generación automática**: Crear el ticket inmediatamente después de la confirmación del pago
- **Flexibilidad**: Soporte para diferentes formatos de salida (impresión, PDF, digital)
- **Auditoría**: Mantener registro completo de todos los tickets generados

## 🏗️ Arquitectura Propuesta

### 1. Modelo de Datos: `ParkingTicket`

```typescript
// lib/types/ticket.ts
export interface ParkingTicket {
  // Identificadores únicos
  ticketId: string
  paymentId: string
  occupationId: number

  // Información del estacionamiento
  parkingName: string
  parkingAddress: string
  plazaNumber?: number
  zone?: string

  // Información del vehículo
  vehicleLicensePlate: string
  vehicleType: 'Auto' | 'Moto' | 'Camioneta'

  // Información temporal
  entryTime: string
  exitTime: string
  duration: {
    hours: number
    minutes: number
    formatted: string
  }

  // Información de pago
  payment: {
    amount: number
    method: PaymentMethod
    status: PaymentStatus
    date: string
    currency: string
  }

  // Información adicional
  conductor?: {
    name: string
    email: string
    phone?: string
  }

  // Metadatos del ticket
  generatedAt: string
  generatedBy: string // usuario/operador
  isSubscription?: boolean
  subscriptionNumber?: number

  // Configuración de formato
  format: 'reduced' | 'detailed' | 'digital'
}
```

### 2. Servicio de Generación de Tickets

```typescript
// lib/services/ticket-service.ts
class TicketService {
  static async generateTicket(
    paymentId: string,
    occupationId: number,
    options?: TicketOptions
  ): Promise<ParkingTicket> {
    // Consolidar datos de múltiples fuentes
    const paymentData = await this.getPaymentData(paymentId)
    const occupationData = await this.getOccupationData(occupationId)
    const parkingData = await this.getParkingData(occupationData.est_id)

    // Crear modelo unificado
    const ticket: ParkingTicket = {
      ticketId: this.generateTicketId(),
      paymentId,
      occupationId,
      // ... consolidar todos los campos
    }

    // Almacenar en BD
    await this.storeTicket(ticket)

    return ticket
  }
}
```

### 3. Endpoint API para Tickets

```
POST /api/tickets/generate
Body: {
  paymentId: string
  occupationId: number
  format?: 'reduced' | 'detailed' | 'digital'
}
Response: ParkingTicket
```

### 4. Componente de Ticket para Impresión

```typescript
// components/ticket/parking-ticket.tsx
interface ParkingTicketProps {
  ticket: ParkingTicket
  format?: 'print' | 'screen'
}

export function ParkingTicket({ ticket, format = 'screen' }: ParkingTicketProps) {
  return (
    <div className={`parking-ticket ${format}`}>
      {/* Layout reducido optimizado para impresión */}
      <TicketHeader ticket={ticket} />
      <TicketBody ticket={ticket} />
      <TicketFooter ticket={ticket} />
    </div>
  )
}
```

## 🔄 Flujo de Implementación

### Fase 1: Definición de Tipos y Modelos
1. Crear `lib/types/ticket.ts` con la interfaz `ParkingTicket`
2. Extender `lib/types.ts` con tipos relacionados
3. Actualizar `lib/types/payment.ts` si es necesario

### Fase 2: Servicio Backend
1. Crear `lib/services/ticket-service.ts`
2. Implementar consultas a BD para consolidar datos:
   - Tabla `pagos` (información de pago)
   - Tabla `ocupacion` (datos de estacionamiento)
   - Tabla `estacionamientos` (información del parking)
   - Tabla `vehiculos` (datos del vehículo)
   - Tabla `conductor` (información del conductor si aplica)

### Fase 3: Endpoint API
1. Crear `app/api/tickets/generate/route.ts`
2. Implementar lógica de consolidación de datos
3. Añadir validaciones y manejo de errores

### Fase 4: Base de Datos
1. Crear tabla `tickets` en Supabase:
   ```sql
   CREATE TABLE tickets (
     ticket_id VARCHAR PRIMARY KEY,
     payment_id VARCHAR REFERENCES pagos(pag_id),
     occupation_id INTEGER REFERENCES ocupacion(ocu_id),
     ticket_data JSONB,
     created_at TIMESTAMP DEFAULT NOW(),
     printed_at TIMESTAMP,
     format VARCHAR DEFAULT 'reduced'
   );
   ```

### Fase 5: Componente de UI
1. Crear componentes en `components/ticket/`:
   - `parking-ticket.tsx` (componente principal)
   - `ticket-header.tsx`, `ticket-body.tsx`, `ticket-footer.tsx`
2. Implementar estilos optimizados para impresión
3. Añadir funcionalidad de impresión automática

### Fase 6: Integración con Flujo de Pago
1. Modificar `/api/payment/status/route.ts` para llamar al servicio de tickets
2. Actualizar componentes de confirmación de pago
3. Añadir manejo de errores si falla la generación del ticket

## 📊 Estructura de Archivos

```
parking-system/
├── lib/
│   ├── types/
│   │   ├── ticket.ts              # ✅ NUEVO: Tipos de ticket
│   │   └── payment.ts             # 🔄 Actualizar si necesario
│   └── services/
│       └── ticket-service.ts      # ✅ NUEVO: Servicio de tickets
├── app/api/
│   └── tickets/
│       └── generate/
│           └── route.ts           # ✅ NUEVO: Endpoint de generación
├── components/
│   └── ticket/
│       ├── parking-ticket.tsx     # ✅ NUEVO: Componente principal
│       ├── ticket-header.tsx      # ✅ NUEVO: Cabecera del ticket
│       ├── ticket-body.tsx        # ✅ NUEVO: Cuerpo del ticket
│       └── ticket-footer.tsx      # ✅ NUEVO: Pie del ticket
└── supabase/
    └── migrations/
        └── add_tickets_table.sql  # ✅ NUEVO: Tabla de tickets
```

## 🔗 Puntos de Integración

### 1. Confirmación de Pago
- **Archivo**: `app/api/payment/status/route.ts`
- **Modificación**: Llamar a `TicketService.generateTicket()` cuando `status === 'approved'`

### 2. Panel del Operador
- **Archivo**: `components/operator-panel.tsx`
- **Modificación**: Mostrar opción de imprimir ticket después del pago

### 3. Historial de Pagos
- **Archivo**: `components/payment-history.tsx`
- **Modificación**: Añadir botón "Reimprimir ticket" para pagos anteriores

## 🎨 Diseño del Ticket (Formato Reducido)

```
┌─────────────────────────────────────┐
│         TICKET DE ESTACIONAMIENTO    │
│                                     │
│ Estacionamiento: Parking Central    │
│ Dirección: Calle 123, Ciudad        │
│                                     │
│ Vehículo: ABC-123                  │
│ Tipo: Auto                         │
│ Plaza: 15                          │
│                                     │
│ Entrada: 2024-12-01 08:30:00       │
│ Salida:  2024-12-01 17:45:00       │
│ Duración: 9h 15min                 │
│                                     │
│ Total: $1,250.00                   │
│ Método: QR                         │
│                                     │
│ Fecha pago: 2024-12-01 17:50:00    │
│ Ticket: TK-20241201-001            │
│                                     │
│ ¡Gracias por su visita!            │
└─────────────────────────────────────┘
```

## ⚡ Beneficios de la Implementación

1. **Consolidación automática**: Un solo punto para acceder a toda la información
2. **Flexibilidad de formatos**: Soporte para diferentes presentaciones
3. **Auditoría completa**: Registro de todos los tickets generados
4. **Integración sencilla**: Se conecta naturalmente con el flujo existente
5. **Mantenibilidad**: Código modular y bien estructurado

## 🚧 Consideraciones Técnicas

### Rendimiento
- Implementar caché para datos del estacionamiento (cambian poco)
- Usar transacciones de BD para asegurar consistencia
- Optimizar consultas con índices apropiados

### Seguridad
- Validar que el usuario tenga permisos para generar tickets
- Implementar rate limiting para prevenir abuso
- Encriptar datos sensibles si es necesario

### Escalabilidad
- Diseñar para múltiples formatos de ticket
- Considerar generación asíncrona para alto volumen
- Implementar cola de impresión si es necesario

## 📅 Plan de Implementación por Fases

### Semana 1: Fundamentos
- ✅ Crear tipos TypeScript
- ✅ Diseñar estructura de BD
- ✅ Implementar servicio básico

### Semana 2: API y Backend
- ✅ Crear endpoint `/api/tickets/generate`
- ✅ Integrar con flujo de pago
- ✅ Añadir validaciones

### Semana 3: UI y Componentes
- ✅ Crear componentes de ticket
- ✅ Implementar estilos de impresión
- ✅ Añadir funcionalidad de impresión

### Semana 4: Testing y Refinamiento
- ✅ Pruebas de integración
- ✅ Optimizaciones de rendimiento
- ✅ Documentación final

## 🔍 Criterios de Aceptación

- [ ] El ticket se genera automáticamente al confirmar un pago
- [ ] Contiene toda la información necesaria (vehículo, tiempos, pago)
- [ ] Se puede imprimir en formato reducido
- [ ] Se almacena correctamente en la base de datos
- [ ] El operador puede reimprimir tickets antiguos
- [ ] Manejo adecuado de errores y casos edge
