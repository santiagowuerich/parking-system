// lib/utils/payment-utils.ts
// Utilidades para el manejo de pagos

import { PaymentMethod, PaymentMethodOption, PaymentStatus, PaymentSettings } from '@/lib/types/payment';
import { PAYMENT_METHODS, PAYMENT_METHOD_COLORS, PAYMENT_STATUS_CONFIG, PAYMENT_TIMEOUTS } from '@/lib/constants/payment-methods';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extender dayjs con plugins de zona horaria
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Obtiene los métodos de pago disponibles según la configuración
 */
export function getAvailablePaymentMethods(settings?: PaymentSettings): PaymentMethodOption[] {
  console.log('🔧 getAvailablePaymentMethods llamada con settings:', settings);

  if (!settings) {
    // Si no hay configuración, solo mostrar efectivo
    console.log('⚠️ No hay settings, devolviendo solo efectivo');
    return PAYMENT_METHODS.filter(method => method.id === 'efectivo');
  }

  const result = PAYMENT_METHODS.filter(method => {
    let enabled = false;
    switch (method.id) {
      case 'efectivo':
        enabled = settings.efectivo.enabled;
        console.log(`💵 Efectivo: enabled=${enabled}`);
        return enabled;
      case 'transferencia':
        // Para transferencias, solo verificar si está habilitado en el estacionamiento
        enabled = settings.transfer.enabled;
        console.log(`🏦 Transferencia: enabled=${settings.transfer.enabled}, final=${enabled}`);
        return enabled;
      case 'qr':
        // Para QR, solo verificar si está habilitado en el estacionamiento
        enabled = settings.mercadopago.enabled;
        console.log(`📱 QR: enabled=${settings.mercadopago.enabled}, final=${enabled}`);
        return enabled;
      case 'link_pago':
        // Para Link de Pago, solo verificar si está habilitado en el estacionamiento
        enabled = settings.mercadopago.enabled;
        console.log(`🔗 Link Pago: enabled=${settings.mercadopago.enabled}, final=${enabled}`);
        return enabled;
      default:
        return false;
    }
  });

  console.log('✅ Métodos finales disponibles:', result.map(m => m.id));
  return result;
}

/**
 * Obtiene la configuración de colores para un método de pago
 */
export function getPaymentMethodColors(method: PaymentMethod) {
  return PAYMENT_METHOD_COLORS[method];
}

/**
 * Obtiene la configuración de estado de pago
 */
export function getPaymentStatusConfig(status: PaymentStatus) {
  return PAYMENT_STATUS_CONFIG[status];
}

/**
 * Calcula el tiempo de expiración para un método de pago
 */
export function calculatePaymentExpiry(method: PaymentMethod): Date | null {
  const timeoutMinutes = PAYMENT_TIMEOUTS[method];
  if (timeoutMinutes === 0) return null; // No expira (efectivo)

  return new Date(Date.now() + timeoutMinutes * 60 * 1000);
}

/**
 * Verifica si un pago ha expirado
 */
export function isPaymentExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  // FIX: Usar dayjs.utc() para obtener hora actual correctamente
  const now = dayjs.utc().tz('America/Argentina/Buenos_Aires');
  const expiry = dayjs.utc(expiresAt).tz('America/Argentina/Buenos_Aires');
  return expiry.isBefore(now);
}

/**
 * Formatea el tiempo restante hasta la expiración
 */
export function formatTimeUntilExpiry(expiresAt: string): string {
  // FIX: Usar dayjs.utc() para obtener hora actual correctamente
  const now = dayjs.utc().tz('America/Argentina/Buenos_Aires');
  const expiry = dayjs.utc(expiresAt).tz('America/Argentina/Buenos_Aires');
  const diffMs = expiry.diff(now);

  if (diffMs <= 0) return 'Expirado';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Genera un ID único para el pago
 */
export function generatePaymentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pay_${timestamp}_${random}`;
}

/**
 * Valida los datos de un pago
 */
export function validatePaymentData(data: {
  amount: number;
  vehicleLicensePlate: string;
  method: PaymentMethod;
  duration: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar monto
  if (!data.amount || data.amount <= 0) {
    errors.push('El monto debe ser mayor a $0');
  }
  if (data.amount > 999999) {
    errors.push('El monto no puede superar $999,999');
  }

  // Validar patente
  if (!data.vehicleLicensePlate?.trim()) {
    errors.push('La patente del vehículo es requerida');
  }

  // Validar método de pago
  const validMethods: PaymentMethod[] = ['efectivo', 'transferencia', 'link_pago', 'qr'];
  if (!validMethods.includes(data.method)) {
    errors.push('Método de pago no válido');
  }

  // Validar duración
  const durationMinutes = data.duration / (1000 * 60);
  if (durationMinutes < 1) {
    errors.push('La duración mínima es 1 minuto');
  }
  if (durationMinutes > 24 * 60 * 30) { // 30 días
    errors.push('La duración máxima es 30 días');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Formatea un monto para mostrar en la UI
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Obtiene el nombre amigable de un método de pago
 */
export function getPaymentMethodName(method: PaymentMethod): string {
  const methodConfig = PAYMENT_METHODS.find(m => m.id === method);
  return methodConfig?.name || method;
}

/**
 * Obtiene el ícono de un método de pago
 */
export function getPaymentMethodIcon(method: PaymentMethod): string {
  const methodConfig = PAYMENT_METHODS.find(m => m.id === method);
  return methodConfig?.icon || '💳';
}

/**
 * Determina si un método requiere configuración
 */
export function requiresConfiguration(method: PaymentMethod): boolean {
  const methodConfig = PAYMENT_METHODS.find(m => m.id === method);
  return methodConfig?.requiresConfig || false;
}

/**
 * Obtiene las instrucciones específicas para un método de pago
 */
export function getPaymentInstructions(method: PaymentMethod, details?: any): string {
  switch (method) {
    case 'efectivo':
      return 'Realice el pago en efectivo al operador del estacionamiento.';
    case 'transferencia':
      if (details?.alias) {
        return `Transfiera a la cuenta ${details.alias} y conserve el comprobante.`;
      }
      return 'Realice la transferencia a la cuenta indicada y conserve el comprobante.';
    case 'link_pago':
      return 'Será redirigido a MercadoPago para completar el pago de forma segura.';
    case 'qr':
      return 'Escanee el código QR con la app de su banco o MercadoPago para pagar.';
    default:
      return 'Complete el pago según las instrucciones.';
  }
}

/**
 * Determina si un pago puede ser reintentado
 */
export function canRetryPayment(status: PaymentStatus, method: PaymentMethod): boolean {
  if (status === 'aprobado') return false;
  if (status === 'expirado' && method !== 'efectivo') return true;
  if (status === 'rechazado') return true;
  if (status === 'cancelado') return true;
  return false;
}

/**
 * Obtiene los siguientes pasos para el usuario según el estado del pago
 */
export function getNextSteps(status: PaymentStatus, method: PaymentMethod): string {
  switch (status) {
    case 'pendiente':
      if (method === 'qr') return 'Escanee el código QR para completar el pago';
      if (method === 'link_pago') return 'Complete el pago en la página que se abrirá';
      if (method === 'transferencia') return 'Realice la transferencia y espere la confirmación';
      return 'Complete el pago según las instrucciones';
    case 'aprobado':
      return 'Pago confirmado. Puede retirar su vehículo.';
    case 'rechazado':
      return 'El pago fue rechazado. Puede intentar con otro método.';
    case 'expirado':
      return 'El pago expiró. Puede generar uno nuevo.';
    case 'cancelado':
      return 'El pago fue cancelado. Puede intentar nuevamente.';
    default:
      return '';
  }
}