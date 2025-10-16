// lib/types/payment.ts
// Modelos para el sistema de pagos del estacionamiento

export type PaymentMethod = 'efectivo' | 'transferencia' | 'link_pago' | 'qr';

export type PaymentStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'cancelado';

export interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  requiresConfig?: boolean; // Para métodos que necesitan configuración (MP, transferencia)
}

// Información específica de cada método de pago
export interface PaymentMethodDetails {
  efectivo: {
    // No requiere detalles adicionales
    instructions?: string;
  };
  transferencia: {
    cbu: string;
    alias: string;
    accountHolder: string; // Titular de la cuenta
    bank: string;
    instructions: string;
  };
  link_pago: {
    preferenceId: string; // ID de preferencia de MercadoPago
    initPoint: string; // URL para redirección web
  };
  qr: {
    preferenceId: string; // ID de preferencia de MercadoPago
    qrCode: string; // Código QR como string
    qrCodeImage: string; // URL o base64 de la imagen QR
  };
}

// Datos del pago a procesar
export interface PaymentData {
  vehicleLicensePlate: string;
  amount: number;
  calculatedFee: number; // Tarifa calculada automáticamente
  agreedFee?: number; // Precio acordado manualmente (si aplica)
  entryTime: string; // ISO string
  exitTime: string; // ISO string
  duration: number; // Duración en milisegundos
  method: PaymentMethod;
  estId: number;
  plazaNumber?: number;
  zone?: string;
  tariffType?: string; // Tipo de tarifa seleccionado al ingreso (hora/día/semana/mes)
  paymentId?: string; // ID del pago (generado después de crear el pago)
  preferenceId?: string; // ID de preferencia de MercadoPago
  expiresAt?: string; // Fecha de expiración del pago
  precioBase?: number; // Precio base de la tarifa por unidad de tiempo
  durationUnits?: number; // Unidades de tiempo cobradas
}

// Respuesta al crear un pago
export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  details: PaymentMethodDetails[PaymentMethod];
  expiresAt?: string; // Para pagos que expiran (QR, link)
  error?: string;
}

// Estado del pago para seguimiento
export interface PaymentTracking {
  paymentId: string;
  vehicleLicensePlate: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  mercadopagoId?: string; // ID del pago en MercadoPago
  details?: any; // Detalles específicos del método
}

// Configuración de MercadoPago
export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  webhookUrl?: string;
  enabled: boolean;
}

// Configuración de transferencia bancaria
export interface TransferConfig {
  cbu: string;
  alias: string;
  accountHolder: string;
  bank: string;
  enabled: boolean;
}

// Configuración general de pagos del estacionamiento
export interface PaymentSettings {
  mercadopago: MercadoPagoConfig;
  transfer: TransferConfig;
  efectivo: {
    enabled: boolean;
  };
  // Configuraciones adicionales
  paymentTimeout: number; // Tiempo límite para completar pago (minutos)
  autoConfirmCash: boolean; // Auto-confirmar pagos en efectivo
  requireManualApproval: PaymentMethod[]; // Métodos que requieren aprobación manual
}

// Para el webhook de MercadoPago
export interface MercadoPagoWebhook {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string; // ID del pago en MercadoPago
  };
}

// Respuesta del webhook procesado
export interface WebhookProcessingResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  message: string;
  vehicleProcessed?: boolean; // Si se procesó la salida del vehículo
}

// Información para mostrar en la UI de confirmación
export interface PaymentConfirmation {
  vehicleLicensePlate: string;
  amount: number;
  method: PaymentMethod;
  methodName: string;
  duration: string; // Formato legible "2h 30m"
  entryTime: string; // Formato legible
  exitTime: string; // Formato legible
  paymentId: string;
  status: PaymentStatus;
  canRetry: boolean;
  nextSteps?: string; // Instrucciones para el usuario
}

// Para el histórico de pagos
export interface PaymentHistoryItem {
  id: string;
  vehicleLicensePlate: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  completedAt?: string;
  estacionamientoNombre: string;
  zona?: string;
  plaza?: number;
  error?: string;
}