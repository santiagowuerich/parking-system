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
  // Asegurarnos de que la fecha sea un objeto Date válido
  const dateObj = new Date(date);
  
  // Ajustar a la zona horaria local
  return dateObj.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Argentina/Buenos_Aires'
  });
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

