/**
 * Configuración de zona horaria para Argentina (ART - UTC-3)
 * Este archivo centraliza la gestión de zona horaria en toda la aplicación
 */

/**
 * Offset de zona horaria de Argentina (UTC-3)
 * Nota: Argentina no observa horario de verano, por lo que siempre es UTC-3
 */
export const ARGENTINA_TIMEZONE_OFFSET = -3; // UTC-3

/**
 * Obtiene la hora actual en zona horaria de Argentina
 */
export function getNowInArgentina(): Date {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const argentinaTime = new Date(utcTime + (ARGENTINA_TIMEZONE_OFFSET * 60 * 60 * 1000));
    return argentinaTime;
}

/**
 * Convierte una fecha ISO string a la zona horaria de Argentina
 */
export function convertToArgentinaTime(isoString: string): Date {
    const date = new Date(isoString);
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
    const argentinaTime = new Date(utcTime + (ARGENTINA_TIMEZONE_OFFSET * 60 * 60 * 1000));
    return argentinaTime;
}

/**
 * Formatea una fecha a formato de Argentina
 */
export function formatArgentinaDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return date.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        ...options
    });
}

/**
 * Obtiene el día de hoy en Argentina (a las 00:00:00)
 */
export function getTodayInArgentina(): Date {
    const today = getNowInArgentina();
    today.setHours(0, 0, 0, 0);
    return today;
}

/**
 * Verifica si dos fechas son del mismo día (en zona horaria Argentina)
 */
export function isSameDayInArgentina(date1: Date, date2: Date): boolean {
    const day1 = new Date(date1);
    const day2 = new Date(date2);

    day1.setHours(0, 0, 0, 0);
    day2.setHours(0, 0, 0, 0);

    return day1.getTime() === day2.getTime();
}
