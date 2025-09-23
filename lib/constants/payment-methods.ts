// lib/constants/payment-methods.ts
// Configuración de métodos de pago disponibles

import { PaymentMethodOption } from '@/lib/types/payment';

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'efectivo',
    name: 'Efectivo',
    description: 'Pago en efectivo al operador',
    icon: '💵',
    enabled: true,
    requiresConfig: false
  },
  {
    id: 'transferencia',
    name: 'Transferencia',
    description: 'Transferencia bancaria',
    icon: '🏦',
    enabled: true,
    requiresConfig: true // Necesita CBU, alias configurados
  },
  {
    id: 'link_pago',
    name: 'Link de Pago',
    description: 'Pagar online con MercadoPago',
    icon: '🔗',
    enabled: true,
    requiresConfig: true // Necesita API key de MercadoPago
  },
  {
    id: 'qr',
    name: 'Código QR',
    description: 'Escanear QR con tu celular',
    icon: '📱',
    enabled: true,
    requiresConfig: true // Necesita API key de MercadoPago
  }
];

// Configuración por defecto para desarrolllo/testing
export const DEFAULT_PAYMENT_SETTINGS = {
  mercadopago: {
    publicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '',
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    webhookUrl: process.env.MERCADOPAGO_WEBHOOK_URL || '',
    enabled: false // Se habilitará cuando se configure correctamente
  },
  transfer: {
    cbu: '',
    alias: '',
    accountHolder: '',
    bank: '',
    enabled: false // Se habilitará cuando se configure
  },
  efectivo: {
    enabled: true // Siempre disponible
  },
  paymentTimeout: 30, // 30 minutos para completar pago
  autoConfirmCash: true, // Auto-confirmar efectivo
  requireManualApproval: ['transferencia'] // Transferencias requieren aprobación manual
} as const;

// Mapeo de íconos por método
export const PAYMENT_METHOD_ICONS = {
  efectivo: '💵',
  transferencia: '🏦',
  link_pago: '🔗',
  qr: '📱'
} as const;

// Colores para cada método (para la UI)
export const PAYMENT_METHOD_COLORS = {
  efectivo: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
    button: 'bg-green-600 hover:bg-green-700'
  },
  transferencia: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700'
  },
  link_pago: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
    button: 'bg-purple-500 hover:bg-purple-600'
  },
  qr: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
    button: 'bg-blue-500 hover:bg-blue-600'
  }
} as const;

// Estados de pago con sus colores
export const PAYMENT_STATUS_CONFIG = {
  pendiente: {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⏳'
  },
  aprobado: {
    label: 'Aprobado',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✅'
  },
  rechazado: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '❌'
  },
  expirado: {
    label: 'Expirado',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '⏰'
  },
  cancelado: {
    label: 'Cancelado',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '🚫'
  }
} as const;

// Timeouts por método de pago (en minutos)
export const PAYMENT_TIMEOUTS = {
  efectivo: 0, // Sin timeout - se confirma inmediatamente
  transferencia: 60, // 1 hora para hacer transferencia
  link_pago: 30, // 30 minutos para completar pago online
  qr: 15 // 15 minutos para escanear QR
} as const;

// Instrucciones por defecto para cada método
export const PAYMENT_INSTRUCTIONS = {
  efectivo: 'Realice el pago en efectivo al operador del estacionamiento.',
  transferencia: 'Realice la transferencia a la cuenta indicada y conserve el comprobante.',
  link_pago: 'Será redirigido a MercadoPago para completar el pago de forma segura.',
  qr: 'Escanee el código QR con la app de su banco o MercadoPago para pagar.'
} as const;

// Validaciones
export const PAYMENT_VALIDATIONS = {
  MIN_AMOUNT: 1, // Monto mínimo $1
  MAX_AMOUNT: 999999, // Monto máximo $999,999
  MIN_DURATION_MINUTES: 1, // Mínimo 1 minuto de estacionamiento
  MAX_DURATION_HOURS: 24 * 30 // Máximo 30 días
} as const;