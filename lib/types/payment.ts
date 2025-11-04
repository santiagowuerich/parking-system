export type PaymentMethod = 'efectivo' | 'transferencia' | 'link_pago' | 'qr';

export type PaymentStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'cancelado';

export interface PaymentMethodOption {
  id: PaymentMethod;
  name: string;
  description: string;
  icon: string;
  enabled?: boolean;
  requiresConfig?: boolean;
}

export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  webhookUrl?: string;
  enabled: boolean;
}

export interface TransferConfig {
  cbu: string;
  alias: string;
  accountHolder: string;
  bank: string;
  enabled: boolean;
}

export interface PaymentSettings {
  mercadopago: MercadoPagoConfig;
  transfer: TransferConfig;
  efectivo: {
    enabled: boolean;
  };
  paymentTimeout: number;
  autoConfirmCash: boolean;
  requireManualApproval: PaymentMethod[];
}

export interface PaymentData {
  vehicleLicensePlate: string;
  amount: number;
  calculatedFee: number;
  agreedFee?: number;
  entryTime: string;
  exitTime: string;
  duration: number;
  method: PaymentMethod;
  estId: number;
  plazaNumber?: number;
  zone?: string;
  tariffType?: string;
  paymentId?: string;
  preferenceId?: string;
  expiresAt?: string;
  precioBase?: number;
  durationUnits?: number;
  isSubscription?: boolean;
  subscriptionNumber?: number;
  // Datos de reserva si aplica
  hasReservation?: boolean;
  reservationCode?: string;
  reservationPaidAmount?: number;
  reservationEndTime?: string;
  reservationHours?: number;
  excessDuration?: number;
}

export interface PaymentMethodDetails {
  efectivo?: Record<string, unknown>;
  transferencia?: {
    cbu: string;
    alias: string;
    accountHolder: string;
    bank: string;
  };
  link_pago?: {
    preferenceId: string;
  };
  qr?: {
    qrCode: string;
    qrCodeImage?: string;
  };
}
