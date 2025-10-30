// lib/utils/reservas-utils.ts
// Funciones utilitarias para el sistema de reservas

import { PlazaDisponible, EstadoReserva } from '@/lib/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Obtiene la hora actual en zona horaria de Argentina (ART - UTC-3)
 */
export function obtenerAhoraEnArgentina(): Date {
    return dayjs().tz('America/Argentina/Buenos_Aires').toDate();
}

/**
 * Calcula el precio total de una reserva basado en la tarifa por hora
 */
export function calcularPrecioReserva(precioPorHora: number, duracionHoras: number): number {
    return precioPorHora * duracionHoras;
}

/**
 * Valida si una fecha de inicio está dentro del rango permitido
 * Solo verifica que sea el día actual (reserva inmediata)
 */
export function validarTiempoReserva(fechaInicio: string): { valido: boolean; error?: string } {
    const ahora = dayjs().tz('America/Argentina/Buenos_Aires');
    const inicio = dayjs(fechaInicio).tz('America/Argentina/Buenos_Aires');

    console.log(`🕐 [VALIDACIÓN TIEMPO] Ahora (ART): ${ahora.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`🕐 [VALIDACIÓN TIEMPO] Inicio: ${inicio.format('YYYY-MM-DD HH:mm:ss')}`);

    // Verificar que sea el mismo día (en zona horaria Argentina)
    const hoyArgentina = ahora.startOf('day');
    const diaInicio = inicio.startOf('day');

    console.log(`🕐 [VALIDACIÓN TIEMPO] Hoy (ART): ${hoyArgentina.format('YYYY-MM-DD')}`);
    console.log(`🕐 [VALIDACIÓN TIEMPO] Día inicio: ${diaInicio.format('YYYY-MM-DD')}`);

    if (!diaInicio.isSame(hoyArgentina)) {
        return { valido: false, error: 'Solo se pueden hacer reservas para el día actual' };
    }

    console.log(`✅ [VALIDACIÓN TIEMPO] Validación exitosa`);
    return { valido: true };
}

/**
 * Verifica si una reserva está dentro del tiempo de gracia
 * Permite confirmar desde 30 minutos antes hasta tiempo_gracia después del inicio
 */
export function estaEnTiempoGracia(fechaInicio: string, tiempoGraciaMinutos: number = 15): boolean {
    const ahora = dayjs().tz('America/Argentina/Buenos_Aires');
    const inicio = dayjs(fechaInicio).tz('America/Argentina/Buenos_Aires');
    const limiteGracia = inicio.add(tiempoGraciaMinutos, 'minutes');
    const ventanaAnticipada = inicio.subtract(30, 'minutes');

    // Permitir confirmar desde 30 minutos antes hasta el tiempo de gracia después
    return ahora.isAfter(ventanaAnticipada) && ahora.isBefore(limiteGracia);
}

/**
 * Formatea un código de reserva para display
 */
export function formatearCodigoReserva(codigo: string): string {
    // Formato: RES-20250125-0001 -> RES-2025-01-25-0001
    const match = codigo.match(/^RES-(\d{4})(\d{2})(\d{2})-(\d{4})$/);
    if (match) {
        const [, year, month, day, sequence] = match;
        return `RES-${year}-${month}-${day}-${sequence}`;
    }
    return codigo;
}

/**
 * Obtiene el estado visual y color para una reserva
 */
export function obtenerEstadoReservaVisual(estado: EstadoReserva, fechaInicio?: string, tiempoGracia?: number) {
    const estados = {
        pendiente_pago: {
            label: 'Pendiente de Pago',
            color: 'yellow',
            bgColor: 'bg-yellow-100',
            textColor: 'text-yellow-800'
        },
        pendiente_confirmacion_operador: {
            label: 'Esperando Confirmación',
            color: 'yellow',
            bgColor: 'bg-yellow-100',
            textColor: 'text-yellow-800'
        },
        confirmada: {
            label: 'Confirmada',
            color: 'blue',
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-800'
        },
        activa: {
            label: 'En Uso',
            color: 'green',
            bgColor: 'bg-green-100',
            textColor: 'text-green-800'
        },
        completada: {
            label: 'Completada',
            color: 'gray',
            bgColor: 'bg-gray-100',
            textColor: 'text-gray-800'
        },
        cancelada: {
            label: 'Cancelada',
            color: 'red',
            bgColor: 'bg-red-100',
            textColor: 'text-red-800'
        },
        expirada: {
            label: 'Expirada',
            color: 'orange',
            bgColor: 'bg-orange-100',
            textColor: 'text-orange-800'
        },
        no_show: {
            label: 'No Llegó',
            color: 'red',
            bgColor: 'bg-red-100',
            textColor: 'text-red-800'
        }
    };

    // Si es confirmada, verificar si está expirada
    if (estado === 'confirmada' && fechaInicio && tiempoGracia) {
        if (!estaEnTiempoGracia(fechaInicio, tiempoGracia)) {
            // Nota: No se cambia el estado en la BD aquí, solo en la UI
            // El estado real se actualiza mediante el cron job o endpoint de expiración
            return {
                label: 'Expirada',
                color: 'orange',
                bgColor: 'bg-orange-100',
                textColor: 'text-orange-800'
            };
        }
    }

    return estados[estado] || estados.completada;
}

/**
 * Calcula el tiempo restante hasta el inicio de una reserva
 */
export function calcularTiempoRestante(fechaInicio: string): {
    tiempoRestante: string;
    esUrgente: boolean;
    minutosRestantes: number;
} {
    const ahora = dayjs().tz('America/Argentina/Buenos_Aires');
    const inicio = dayjs(fechaInicio).tz('America/Argentina/Buenos_Aires');
    const diffMs = inicio.diff(ahora);

    if (diffMs <= 0) {
        return {
            tiempoRestante: 'Ya comenzó',
            esUrgente: true,
            minutosRestantes: 0
        };
    }

    const minutosRestantes = Math.floor(diffMs / (1000 * 60));
    const horasRestantes = Math.floor(minutosRestantes / 60);
    const minutosSobrantes = minutosRestantes % 60;

    let tiempoRestante = '';
    if (horasRestantes > 0) {
        tiempoRestante = `${horasRestantes}h ${minutosSobrantes}m`;
    } else {
        tiempoRestante = `${minutosRestantes}m`;
    }

    // Es urgente si quedan menos de 30 minutos
    const esUrgente = minutosRestantes <= 30;

    return {
        tiempoRestante,
        esUrgente,
        minutosRestantes
    };
}

/**
 * Genera las opciones de duración para el selector
 */
export function generarOpcionesDuracion(): Array<{ value: number; label: string }> {
    const opciones = [];
    for (let i = 1; i <= 24; i++) {
        opciones.push({
            value: i,
            label: i === 1 ? '1 hora' : `${i} horas`
        });
    }
    return opciones;
}

/**
 * Genera las opciones de fecha/hora para el selector
 * Solo para reserva inmediata (hora actual)
 */
export function generarOpcionesFechaHora(): Array<{ value: string; label: string }> {
    const ahora = dayjs().tz('America/Argentina/Buenos_Aires');

    console.log(`🕐 [OPCIONES] Generando opción de reserva inmediata: ${ahora.format('YYYY-MM-DD HH:mm:ss')}`);

    // Solo una opción: hora actual
    return [{
        value: ahora.toISOString(),
        label: `Ahora (${ahora.format('HH:mm')})`
    }];
}

/**
 * Valida si una plaza está disponible para reservar
 */
export function validarDisponibilidadPlaza(
    plaza: PlazaDisponible,
    fechaInicio: string,
    fechaFin: string
): { disponible: boolean; razon?: string } {
    // Verificar que la plaza tenga precio definido
    if (!plaza.precio_por_hora || plaza.precio_por_hora <= 0) {
        return { disponible: false, razon: 'Plaza sin tarifa definida' };
    }

    // Verificar que la plaza sea del tipo correcto
    if (!plaza.catv_segmento || !['A', 'M', 'C'].includes(plaza.catv_segmento)) {
        return { disponible: false, razon: 'Tipo de plaza no válido' };
    }

    return { disponible: true };
}

/**
 * Formatea una fecha para mostrar en la UI
 * Usa timezone de Argentina explícitamente
 */
export function formatearFechaReserva(fecha: string): string {
    return dayjs.utc(fecha).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm');
}

/**
 * Formatea la duración para mostrar en la UI
 */
export function formatearDuracion(duracionHoras: number): string {
    if (duracionHoras === 1) {
        return '1 hora';
    }
    return `${duracionHoras} horas`;
}

/**
 * Genera un mensaje de instrucciones para el conductor
 */
export function generarInstruccionesReserva(reserva: any): string {
    // Calcular tiempo de gracia en timezone Argentina
    const fechaIngreso = dayjs.utc(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires');
    const fechaGracia = fechaIngreso.add(reserva.res_tiempo_gracia_min || 15, 'minute');
    
    // Calcular duración en timezone Argentina
    const fechaFin = dayjs.utc(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires');
    const duracionHoras = fechaFin.diff(fechaIngreso, 'hour', true);
    
    const instrucciones = [
        `Tu reserva está confirmada para la plaza ${reserva.pla_numero}`,
        `Debes llegar entre ${formatearFechaReserva(reserva.res_fh_ingreso)} y ${formatearFechaReserva(fechaGracia.utc().toISOString())}`,
        `Si llegas después del tiempo de gracia, tu reserva será cancelada`,
        `Muestra este código al operador: ${formatearCodigoReserva(reserva.res_codigo)}`,
        `La reserva es válida por ${formatearDuracion(Math.round(duracionHoras))}`
    ];

    return instrucciones.join('\n');
}
