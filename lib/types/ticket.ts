// lib/types/ticket.ts
// Tipos para el sistema de tickets de estacionamiento

import { PaymentMethod, PaymentStatus } from './payment';
import { VehicleType } from '../types';

/**
 * Formato del ticket
 * - reduced: Formato reducido para impresión en ticket de 80mm
 * - detailed: Formato detallado con toda la información
 * - digital: Formato optimizado para pantalla/email
 */
export type TicketFormat = 'reduced' | 'detailed' | 'digital';

/**
 * Estado del ticket
 */
export type TicketStatus = 'generated' | 'printed' | 'sent' | 'cancelled';

/**
 * Información de duración formateada
 */
export interface TicketDuration {
  hours: number;
  minutes: number;
  formatted: string; // Ej: "9h 15min"
}

/**
 * Información de pago en el ticket
 */
export interface TicketPaymentInfo {
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string; // ISO string
  currency: string;
  referenceId?: string; // ID de referencia del pago (MercadoPago, etc)
}

/**
 * Información del conductor (opcional)
 */
export interface TicketConductorInfo {
  name: string;
  email: string;
  phone?: string;
}

/**
 * Modelo principal de Ticket de Estacionamiento
 */
export interface ParkingTicket {
  // Identificadores únicos
  ticketId: string; // Formato: TK-YYYYMMDD-NNNNN
  paymentId: string | number;
  occupationId: number;

  // Información del estacionamiento
  parkingId: number;
  parkingName: string;
  parkingAddress: string;
  parkingPhone?: string;
  parkingEmail?: string;
  plazaNumber?: number;
  zone?: string;

  // Información del vehículo
  vehicleLicensePlate: string;
  vehicleType: VehicleType;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;

  // Información temporal
  entryTime: string; // ISO string
  exitTime: string; // ISO string
  duration: TicketDuration;

  // Información de pago
  payment: TicketPaymentInfo;

  // Información adicional (opcional)
  conductor?: TicketConductorInfo;

  // Datos de reserva si aplica
  isReservation?: boolean;
  reservationCode?: string;

  // Datos de abono si aplica
  isSubscription?: boolean;
  subscriptionNumber?: number;

  // Metadatos del ticket
  generatedAt: string; // ISO string
  generatedBy: string; // ID o nombre del usuario/operador
  printedAt?: string; // ISO string - cuando se imprimió
  sentAt?: string; // ISO string - cuando se envió digitalmente
  status: TicketStatus;
  format: TicketFormat;

  // Notas o comentarios adicionales
  notes?: string;
}

/**
 * Datos mínimos requeridos para generar un ticket
 */
export interface GenerateTicketRequest {
  paymentId: string | number;
  occupationId: number;
  format?: TicketFormat;
  generatedBy: string;
  notes?: string;
}

/**
 * Respuesta de generación de ticket
 */
export interface GenerateTicketResponse {
  success: boolean;
  ticket?: ParkingTicket;
  error?: string;
  details?: string;
}

/**
 * Opciones para la generación de tickets
 */
export interface TicketOptions {
  format?: TicketFormat;
  includeCondutorInfo?: boolean;
  autoPrint?: boolean;
  sendEmail?: boolean;
}

/**
 * Registro de ticket en base de datos
 */
export interface TicketDBRecord {
  ticket_id: string;
  payment_id: number | null;
  occupation_id: number;
  est_id: number;
  ticket_data: ParkingTicket;
  created_at: string;
  printed_at: string | null;
  sent_at: string | null;
  format: TicketFormat;
  status: TicketStatus;
  generated_by: string;
}

/**
 * Parámetros de búsqueda de tickets
 */
export interface TicketSearchParams {
  ticketId?: string;
  occupationId?: number;
  paymentId?: number;
  estId?: number;
  vehiclePlate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TicketStatus;
  format?: TicketFormat;
  limit?: number;
  offset?: number;
}

/**
 * Respuesta de búsqueda de tickets
 */
export interface TicketSearchResponse {
  success: boolean;
  tickets?: ParkingTicket[];
  total?: number;
  error?: string;
}

/**
 * Utilidades para formateo de duración
 */
export function formatDuration(milliseconds: number): TicketDuration {
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let formatted = '';
  if (hours > 0) {
    formatted += `${hours}h`;
    if (minutes > 0) {
      formatted += ` ${minutes}min`;
    }
  } else {
    formatted = `${minutes}min`;
  }

  return { hours, minutes, formatted };
}

/**
 * Genera un ID de ticket único
 */
export function generateTicketId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `TK-${dateStr}-${random}`;
}

