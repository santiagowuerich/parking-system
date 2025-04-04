import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

// Formatear hora
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

// Formatear duración
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} h ${minutes} min`
}

// Calcular tarifa
export function calculateFee(hours: number, hourlyRate: number): number {
  // Asegurar que se cobre como mínimo 1 hora
  const billableHours = Math.max(hours, 1)
  return billableHours * hourlyRate
}

