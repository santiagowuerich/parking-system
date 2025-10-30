/**
 * Configuración de zona horaria para Argentina (ART - UTC-3)
 * Este archivo centraliza la gestión de zona horaria en toda la aplicación
 * 
 * NOTA: Este archivo mantiene compatibilidad con código existente.
 * Para nuevas funciones, usar lib/utils/date-time.ts que usa dayjs correctamente.
 */

import { 
  nowInArgentina, 
  toArgentinaTime, 
  formatDateTime, 
  formatDate,
  getTodayStartInArgentina,
  getTodayEndInArgentina,
  isSameDayInArgentina as isSameDayArg,
  ARGENTINA_TIMEZONE
} from "@/lib/utils/date-time"
import dayjs from "dayjs"

/**
 * Offset de zona horaria de Argentina (UTC-3)
 * Nota: Argentina no observa horario de verano, por lo que siempre es UTC-3
 * @deprecated Usar ARGENTINA_TIMEZONE de lib/utils/date-time.ts en su lugar
 */
export const ARGENTINA_TIMEZONE_OFFSET = -3; // UTC-3

/**
 * Obtiene la hora actual en zona horaria de Argentina
 * @deprecated Usar nowInArgentina() de lib/utils/date-time.ts en su lugar
 */
export function getNowInArgentina(): Date {
    return nowInArgentina().toDate();
}

/**
 * Convierte una fecha ISO string a la zona horaria de Argentina
 * @deprecated Usar toArgentinaTime() de lib/utils/date-time.ts en su lugar
 */
export function convertToArgentinaTime(isoString: string): Date {
    return toArgentinaTime(isoString).toDate();
}

/**
 * Formatea una fecha a formato de Argentina
 * Usa Intl.DateTimeFormat con timezone explícito para garantizar consistencia
 */
export function formatArgentinaDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return date.toLocaleString('es-AR', {
        timeZone: ARGENTINA_TIMEZONE,
        ...options
    });
}

/**
 * Obtiene el día de hoy en Argentina (a las 00:00:00)
 * @deprecated Usar getTodayStartInArgentina() de lib/utils/date-time.ts en su lugar
 */
export function getTodayInArgentina(): Date {
    return getTodayStartInArgentina().toDate();
}

/**
 * Verifica si dos fechas son del mismo día (en zona horaria Argentina)
 * @deprecated Usar isSameDayInArgentina() de lib/utils/date-time.ts en su lugar
 */
export function isSameDayInArgentina(date1: Date, date2: Date): boolean {
    return isSameDayArg(date1, date2);
}
