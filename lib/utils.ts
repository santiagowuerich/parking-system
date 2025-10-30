import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import { formatDateTime, formatDateTimeReadable } from "./utils/date-time"

dayjs.extend(utc)
dayjs.extend(timezone)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatear moneda
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount)
}

// Formatear hora (redirige a función centralizada)
// @deprecated Usar formatTime de lib/utils/date-time.ts directamente
export function formatTime(date: Date): string {
  return formatDateTime(date);
}

// Formatear duración
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours} h ${minutes} min`;
}

// Calcular tarifa
export function calculateFee(hours: number, rate: number): number {
  const effectiveHours = Math.ceil(hours);
  return Math.max(1, effectiveHours) * rate;
}

// Mapear segmento <-> nombre humano
export function segmentToName(segment?: string): "Auto" | "Moto" | "Camioneta" {
  return segment === 'MOT' ? 'Moto' : segment === 'CAM' ? 'Camioneta' : 'Auto'
}

export function nameToSegment(name?: string): 'AUT' | 'MOT' | 'CAM' {
  const n = (name || '').toLowerCase()
  if (n === 'moto') return 'MOT'
  if (n === 'camioneta') return 'CAM'
  return 'AUT'
}

// Formatear fecha/hora argentina con Day.js
// @deprecated Usar formatDateTimeReadable de lib/utils/date-time.ts directamente
export function formatArgentineTimeWithDayjs(dateString: string | Date | null | undefined): string {
  return formatDateTimeReadable(dateString);
}

