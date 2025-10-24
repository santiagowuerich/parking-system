/**
 * Tipos e interfaces para el sistema de horarios de estacionamientos
 */

/**
 * Franja horaria individual de un estacionamiento
 */
export interface HorarioFranja {
    horario_id?: number;
    est_id: number;
    dia_semana: number; // 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    hora_apertura: string; // Formato "HH:MM" (ej: "08:00")
    hora_cierre: string;   // Formato "HH:MM" (ej: "18:00")
    orden: number; // 1, 2 o 3 (número de franja en el día)
}

/**
 * Horarios agrupados por día de la semana
 */
export interface HorariosPorDia {
    [dia: number]: HorarioFranja[]; // Key: 0-6 (día de semana), Value: array de hasta 3 franjas
}

/**
 * Opciones de requerimiento de llave para estacionamiento
 */
export type RequiereLlaveOption = 'no' | 'opcional' | 'requerida';

/**
 * Nombres de días de la semana en español
 */
export const DIAS_SEMANA = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado'
] as const;

/**
 * Labels para opciones de llave
 */
export const LLAVE_OPTIONS = {
    no: 'No requiere llave',
    opcional: 'Llave opcional (acepta con y sin llave)',
    requerida: 'Llave requerida (solo vehículos con llave)'
} as const;

/**
 * Validar formato de hora HH:MM
 */
export function isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(time);
}

/**
 * Comparar dos horas en formato HH:MM
 * @returns true si time1 < time2
 */
export function isTimeBefore(time1: string, time2: string): boolean {
    if (!isValidTimeFormat(time1) || !isValidTimeFormat(time2)) {
        return false;
    }

    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    if (h1 < h2) return true;
    if (h1 > h2) return false;
    return m1 < m2;
}

/**
 * Validar que una franja horaria sea válida
 */
export function validateFranjaHoraria(franja: Partial<HorarioFranja>): { valid: boolean; error?: string } {
    // Validar campos requeridos
    if (!franja.hora_apertura || !franja.hora_cierre) {
        return { valid: false, error: 'Debe especificar hora de apertura y cierre' };
    }

    // Validar formato
    if (!isValidTimeFormat(franja.hora_apertura)) {
        return { valid: false, error: 'Formato de hora de apertura inválido (use HH:MM)' };
    }

    if (!isValidTimeFormat(franja.hora_cierre)) {
        return { valid: false, error: 'Formato de hora de cierre inválido (use HH:MM)' };
    }

    // Validar que cierre > apertura
    if (!isTimeBefore(franja.hora_apertura, franja.hora_cierre)) {
        return { valid: false, error: 'La hora de cierre debe ser posterior a la hora de apertura' };
    }

    // Validar día de semana
    if (franja.dia_semana !== undefined && (franja.dia_semana < 0 || franja.dia_semana > 6)) {
        return { valid: false, error: 'Día de semana inválido (debe ser 0-6)' };
    }

    // Validar orden
    if (franja.orden !== undefined && (franja.orden < 1 || franja.orden > 3)) {
        return { valid: false, error: 'Orden inválido (debe ser 1-3)' };
    }

    return { valid: true };
}

/**
 * Verificar si dos franjas horarias se solapan
 */
export function checkOverlap(franja1: HorarioFranja, franja2: HorarioFranja): boolean {
    // Solo verificar overlap si son del mismo día
    if (franja1.dia_semana !== franja2.dia_semana) {
        return false;
    }

    const start1 = franja1.hora_apertura;
    const end1 = franja1.hora_cierre;
    const start2 = franja2.hora_apertura;
    const end2 = franja2.hora_cierre;

    // Verificar si hay solapamiento
    // F1: [start1 --- end1]
    // F2:      [start2 --- end2]
    // Overlap si: start1 < end2 AND start2 < end1

    return !isTimeBefore(end1, start2) && !isTimeBefore(end2, start1);
}

/**
 * Agrupar franjas horarias por día
 */
export function groupByDay(franjas: HorarioFranja[]): HorariosPorDia {
    const grouped: HorariosPorDia = {};

    franjas.forEach(franja => {
        if (!grouped[franja.dia_semana]) {
            grouped[franja.dia_semana] = [];
        }
        grouped[franja.dia_semana].push(franja);
    });

    // Ordenar franjas dentro de cada día por hora de apertura
    Object.keys(grouped).forEach(dia => {
        grouped[parseInt(dia)].sort((a, b) => {
            if (isTimeBefore(a.hora_apertura, b.hora_apertura)) return -1;
            if (isTimeBefore(b.hora_apertura, a.hora_apertura)) return 1;
            return 0;
        });
    });

    return grouped;
}

/**
 * Verificar si un estacionamiento tiene al menos un horario definido
 */
export function hasHorarios(franjas: HorarioFranja[]): boolean {
    return franjas.length > 0;
}

/**
 * Formatear hora para display (eliminar segundos si existen)
 */
export function formatTimeDisplay(time: string): string {
    if (!time) return '';
    // Si viene en formato HH:MM:SS, tomar solo HH:MM
    return time.substring(0, 5);
}

/**
 * Crear franja horaria vacía para un día específico
 */
export function createEmptyFranja(estId: number, diaSemana: number, orden: number): Partial<HorarioFranja> {
    return {
        est_id: estId,
        dia_semana: diaSemana,
        hora_apertura: '08:00',
        hora_cierre: '18:00',
        orden: orden
    };
}
