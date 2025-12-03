/**
 * Utilidades centralizadas para manejo de fechas y horas
 * Todas las funciones garantizan que las fechas se manejen en zona horaria de Argentina
 * (America/Argentina/Buenos_Aires) independientemente de dónde se ejecute el código
 * (local, Vercel, etc.)
 */

import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

// Constante de zona horaria de Argentina
export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires'

/**
 * Obtiene la fecha/hora actual en zona horaria de Argentina
 * Funciona igual en servidor (Vercel) y cliente
 * FIX: Usa dayjs.utc() para obtener siempre UTC primero, así funciona en cualquier timezone
 */
export function nowInArgentina(): dayjs.Dayjs {
  return dayjs.utc().tz(ARGENTINA_TIMEZONE)
}

/**
 * Convierte una fecha (ISO string, Date, o dayjs) a zona horaria de Argentina
 * Las fechas de la BD están en UTC (con Z), se convierten correctamente a ART
 */
export function toArgentinaTime(date: string | Date | dayjs.Dayjs | null | undefined): dayjs.Dayjs {
  if (!date) {
    return nowInArgentina()
  }

  // Si ya es dayjs, convertir directamente
  if (dayjs.isDayjs(date)) {
    return date.tz(ARGENTINA_TIMEZONE)
  }

  // Si es string o Date, interpretar como UTC primero (timestamps se guardan en UTC con Z), luego convertir a ART
  return dayjs.utc(date).tz(ARGENTINA_TIMEZONE)
}

/**
 * Formatea fecha/hora completa en formato argentino
 * Formato: DD/MM/YYYY HH:mm:ss
 */
export function formatDateTime(date: string | Date | dayjs.Dayjs | null | undefined): string {
  if (!date) return "N/A"
  
  try {
    const dateArg = toArgentinaTime(date)
    if (!dateArg.isValid()) {
      return "Fecha inválida"
    }
    return dateArg.format('DD/MM/YYYY HH:mm:ss')
  } catch (error) {
    console.error("Error formateando fecha:", error)
    return "Error"
  }
}

/**
 * Formatea solo la hora en formato argentino
 * Formato: HH:mm (24 horas)
 */
export function formatTime(date: string | Date | dayjs.Dayjs | null | undefined): string {
  if (!date) return "N/A"
  
  try {
    const dateArg = toArgentinaTime(date)
    if (!dateArg.isValid()) {
      return "Fecha inválida"
    }
    return dateArg.format('HH:mm')
  } catch (error) {
    console.error("Error formateando hora:", error)
    return "Error"
  }
}

/**
 * Formatea hora con minutos y segundos
 * Formato: HH:mm:ss
 */
export function formatTimeWithSeconds(date: string | Date | dayjs.Dayjs | null | undefined): string {
  if (!date) return "N/A"
  
  try {
    const dateArg = toArgentinaTime(date)
    if (!dateArg.isValid()) {
      return "Fecha inválida"
    }
    return dateArg.format('HH:mm:ss')
  } catch (error) {
    console.error("Error formateando hora:", error)
    return "Error"
  }
}

/**
 * Formatea solo la fecha en formato argentino
 * Formato: DD/MM/YYYY
 */
export function formatDate(date: string | Date | dayjs.Dayjs | null | undefined): string {
  if (!date) return "N/A"
  
  try {
    const dateArg = toArgentinaTime(date)
    if (!dateArg.isValid()) {
      return "Fecha inválida"
    }
    return dateArg.format('DD/MM/YYYY')
  } catch (error) {
    console.error("Error formateando fecha:", error)
    return "Error"
  }
}

/**
 * Formatea fecha/hora en formato legible con AM/PM
 * Formato: DD/MM/YYYY hh:mm A
 */
export function formatDateTimeReadable(date: string | Date | dayjs.Dayjs | null | undefined): string {
  if (!date) return "N/A"
  
  try {
    const dateArg = toArgentinaTime(date)
    if (!dateArg.isValid()) {
      return "Fecha inválida"
    }
    return dateArg.format('DD/MM/YYYY hh:mm A')
  } catch (error) {
    console.error("Error formateando fecha:", error)
    return "Error"
  }
}

/**
 * Obtiene el inicio del día actual en Argentina (00:00:00)
 */
export function getTodayStartInArgentina(): dayjs.Dayjs {
  return nowInArgentina().startOf('day')
}

/**
 * Obtiene el fin del día actual en Argentina (23:59:59)
 */
export function getTodayEndInArgentina(): dayjs.Dayjs {
  return nowInArgentina().endOf('day')
}

/**
 * Verifica si dos fechas son del mismo día (en zona horaria Argentina)
 */
export function isSameDayInArgentina(
  date1: string | Date | dayjs.Dayjs | null | undefined,
  date2: string | Date | dayjs.Dayjs | null | undefined
): boolean {
  if (!date1 || !date2) return false
  
  try {
    const d1 = toArgentinaTime(date1).startOf('day')
    const d2 = toArgentinaTime(date2).startOf('day')
    return d1.isSame(d2)
  } catch {
    return false
  }
}

/**
 * Convierte una fecha de Argentina a ISO string en UTC para guardar en BD
 * Útil cuando necesitas guardar una fecha que representa un momento en Argentina
 */
export function argentinaTimeToUTC(date: string | Date | dayjs.Dayjs): string {
  const dateArg = dayjs.isDayjs(date) ? date : dayjs(date).tz(ARGENTINA_TIMEZONE)
  return dateArg.utc().toISOString()
}

/**
 * Obtiene una fecha ISO string de la hora actual en Argentina
 * Lista para guardar en BD
 */
export function nowInArgentinaISO(): string {
  return nowInArgentina().utc().toISOString()
}

