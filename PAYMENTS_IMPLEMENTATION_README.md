# Implementación de Sistema de Pagos - Parking System

## 📋 Estado Actual

El sistema de pagos ha sido **temporalmente removido** del componente principal `parking-app.tsx` para simplificar la arquitectura y permitir una implementación más robusta en el futuro.

## 🗑️ Funcionalidades Removidas

### Estados Eliminados:
- `showPaymentDialog` - Control del diálogo de métodos de pago
- `showQRDialog` - Control del diálogo de QR de MercadoPago
- `qrData` - Datos del código QR generado
- `paymentMethodDialogOpen` - Estado del diálogo de selección de método
- `exitingVehicle` - Vehículo que está saliendo (relacionado con pago)
- `paymentConfirmationOpen` - Diálogo de confirmación de pago
- `lastCalculatedFee` - Última tarifa calculada
- `paymentDetails` - Detalles del método de pago seleccionado
- `showTransferInfoDialog` - Diálogo de información de transferencia

### Funciones Eliminadas:
- `handleExit()` - Procesamiento de salida con cálculo de tarifa
- `handlePaymentMethod()` - Manejo de selección de método de pago
- `handlePaymentConfirmation()` - Confirmación final del pago
- `handleTransferConfirmation()` - Confirmación de pago por transferencia

### Componentes Eliminados:
- `PaymentMethodDialog` - Diálogo para seleccionar método de pago
- `QRDialog` - Diálogo que muestra código QR de MercadoPago
- `PaymentConfirmationDialog` - Diálogo de confirmación final
- `TransferInfoDialog` - Diálogo con información bancaria

### Imports Eliminados:
```typescript
// Removidos del parking-app.tsx
import { PaymentMethodDialog } from "./payment-method-dialog";
import { QRDialog } from "./qr-dialog";
import { PaymentConfirmationDialog } from "./payment-confirmation-dialog";
import { TransferInfoDialog } from "./ui/transfer-info-dialog";
```

## 💰 Funcionalidades de Pago que se Implementarán

### 1. **Cálculo de Tarifas**
- Cálculo automático basado en tiempo de estacionamiento
- Soporte para diferentes modalidades (hora, día, semana, mes)
- Diferentes tipos de plaza (Normal, VIP, Reservada)
- Descuentos y promociones

### 2. **Métodos de Pago Soportados**
- **Efectivo** - Pago directo al salir
- **Transferencia Bancaria** - Información bancaria del estacionamiento
- **MercadoPago QR** - Código QR para pago móvil
- **MercadoPago Web** - Redirección a página de pago

### 3. **Flujo de Pago Completo**
```
Usuario presiona "Salida"
    ↓
Cálculo automático de tarifa
    ↓
Selección de método de pago
    ↓
Procesamiento según método elegido
    ↓
Confirmación y registro de salida
```

## 🔧 Implementación Futura

### Paso 1: Crear Componentes de Pago
```bash
# Crear los componentes necesarios
components/
├── payment-method-dialog.tsx     # Selección de método
├── qr-dialog.tsx                 # QR de MercadoPago
├── payment-confirmation-dialog.tsx # Confirmación final
└── transfer-info-dialog.tsx      # Info bancaria
```

### Paso 2: Agregar Estados al parking-app.tsx
```typescript
// Agregar estos estados de vuelta
const [showPaymentDialog, setShowPaymentDialog] = useState(false);
const [showQRDialog, setShowQRDialog] = useState(false);
const [qrData, setQrData] = useState<QRData | null>(null);
const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
const [exitingVehicle, setExitingVehicle] = useState<Vehicle | null>(null);
const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
const [lastCalculatedFee, setLastCalculatedFee] = useState(0);
const [paymentDetails, setPaymentDetails] = useState<any>(null);
const [showTransferInfoDialog, setShowTransferInfoDialog] = useState(false);
```

### Paso 3: Implementar Funciones de Pago

#### handleExit - Procesar Salida con Tarifa
```typescript
const handleExit = async (licensePlate: string) => {
  // 1. Buscar vehículo estacionado
  // 2. Calcular tarifa usando API de pricing
  // 3. Abrir diálogo de métodos de pago
  // 4. Configurar estado para proceso de pago
};
```

#### handlePaymentMethod - Procesar Método Seleccionado
```typescript
const handlePaymentMethod = async (method: string) => {
  switch (method) {
    case 'qr':
    case 'mercadopago':
      // Generar pago con MercadoPago API
      break;
    case 'transferencia':
      // Mostrar información bancaria
      break;
    default:
      // Pago en efectivo - registrar salida directamente
      break;
  }
};
```

### Paso 4: Integrar APIs de Pago

#### MercadoPago Integration
```typescript
// API endpoints necesarios
/api/payment/mercadopago     # Crear preferencia de pago
/api/payment/methods         # Obtener métodos disponibles
/api/user/settings           # Verificar API key configurada
```

#### TransferInfoDialog
- Mostrar CBU/CVU del estacionamiento
- Alias de transferencia
- Instrucciones de pago

### Paso 5: Manejo de Estados de Pago

#### Estados de Pago:
- `Pendiente` - Pago iniciado
- `Aprobado` - Pago confirmado
- `Rechazado` - Pago fallido
- `Expirado` - Pago no completado a tiempo

#### Confirmación de Pago:
- Webhooks de MercadoPago para confirmación automática
- Verificación manual para transferencias
- Actualización del historial solo después de pago confirmado

## 🔄 Flujo de Implementación Recomendado

### Fase 1: Infraestructura Básica
1. Crear componentes de diálogo de pago
2. Implementar estado básico de pagos
3. Conectar APIs de pricing existentes

### Fase 2: MercadoPago Integration
1. Configurar credenciales de MercadoPago
2. Implementar generación de QR
3. Agregar webhooks para confirmación

### Fase 3: Métodos Adicionales
1. Implementar pago por transferencia
2. Agregar validaciones de seguridad
3. Testing exhaustivo

### Fase 4: Testing y Optimización
1. Tests unitarios para lógica de pagos
2. Tests de integración con MercadoPago
3. Optimización de UX

## 📊 Métricas a Monitorear

- **Tasa de Conversión de Pagos**: % de pagos exitosos
- **Tiempo Promedio de Pago**: Desde selección hasta confirmación
- **Errores de Pago**: Tasa de fallos por método
- **Satisfacción del Usuario**: Feedback sobre proceso de pago

## 🛡️ Consideraciones de Seguridad

- **Validación de Montos**: Verificar que no se puedan alterar tarifas
- **Timeouts de Sesión**: Limpiar estados de pago expirados
- **Logs de Seguridad**: Registrar intentos de manipulación
- **Rate Limiting**: Prevenir abuso de APIs de pago

## 🎯 Próximos Pasos

1. **Crear los componentes de pago** mencionados arriba
2. **Implementar la lógica básica** de cálculo de tarifas
3. **Agregar un método de pago simple** (efectivo) primero
4. **Gradualmente agregar** métodos más complejos (QR, transferencias)
5. **Testing exhaustivo** antes de producción

---

**Nota**: Esta documentación mantiene la funcionalidad de pagos separada para permitir una implementación más cuidadosa y robusta en el futuro