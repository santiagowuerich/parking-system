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
    // FIX: Usar dayjs.utc() para obtener hora actual correctamente
    return dayjs.utc().tz('America/Argentina/Buenos_Aires').toDate();
}

/**
 * Calcula el precio total de una reserva basado en la tarifa por hora
 */
export function calcularPrecioReserva(precioPorHora: number, duracionHoras: number): number {
    return precioPorHora * duracionHoras;
}

/**
 * Valida si una fecha de inicio está dentro del rango permitido
 * Solo verifica que no sea en el pasado
 */
export function validarTiempoReserva(fechaInicio: string): { valido: boolean; error?: string } {
    try {
        // FIX: Usar dayjs.utc() para obtener hora actual correctamente
        const ahora = dayjs.utc().tz('America/Argentina/Buenos_Aires');
        // FIX: Si fechaInicio es ISO string (incluye 'T'), interpretar como UTC primero
        // Si es solo hora (HH:mm:ss), es hora Argentina local
        const inicio = fechaInicio.includes('T')
            ? dayjs.utc(fechaInicio).tz('America/Argentina/Buenos_Aires')
            : dayjs(fechaInicio).tz('America/Argentina/Buenos_Aires');

        // Validar que el objeto dayjs sea válido
        if (!inicio.isValid()) {
            console.error(`❌ [VALIDACIÓN TIEMPO] Fecha inválida: ${fechaInicio}`);
            return { valido: false, error: 'Formato de fecha inválido' };
        }

        console.log(`🕐 [VALIDACIÓN TIEMPO] Ahora (ART): ${ahora.format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`🕐 [VALIDACIÓN TIEMPO] Inicio: ${inicio.format('YYYY-MM-DD HH:mm:ss')}`);

        // Permitir margen de 5 minutos para latencia de red y reservas "ahora mismo"
        // Esto evita rechazar reservas legítimas que se procesan en <5min
        const margenToleranciaMins = 5;
        const limiteMinimo = ahora.subtract(margenToleranciaMins, 'minutes');

        if (inicio.isBefore(limiteMinimo)) {
            return { valido: false, error: `No se pueden hacer reservas con más de ${margenToleranciaMins} minutos en el pasado` };
        }

        console.log(`✅ [VALIDACIÓN TIEMPO] Validación exitosa`);
        return { valido: true };
    } catch (error) {
        console.error(`❌ [VALIDACIÓN TIEMPO] Error en validarTiempoReserva:`, error);
        return { valido: false, error: 'Error validando la fecha' };
    }
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
 * @param estado - Estado de la reserva en BD
 * @param fechaInicio - Fecha de inicio de la reserva (para verificar expiración de confirmadas)
 * @param tiempoGracia - Tiempo de gracia en minutos (para verificar expiración de confirmadas)
 * @param fechaFin - Fecha de fin de la reserva (para verificar expiración de activas)
 * @param ocupacion - Datos de ocupación para determinar si vehículo sigue estacionado
 */
export function obtenerEstadoReservaVisual(
    estado: EstadoReserva,
    fechaInicio?: string,
    tiempoGracia?: number,
    fechaFin?: string,
    ocupacion?: { ocu_fh_salida: string | null } | null
) {
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
            label: 'En Estacionamiento',
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

    // NOTA: Para confirmada, NO mostramos "Expirada" aquí
    // Las confirmadas se muestran como "Confirmada" en la UI
    // Solo se marcan como 'expirada' en la BD cuando la auto-expiración ocurre
    // y es eso lo que el usuario verá, no lógica de fecha visual

    // Si es activa, verificar si la ocupación ha terminado
    if (estado === 'activa' && fechaFin) {
        // FIX: Usar dayjs.utc() para obtener hora actual correctamente
        const ahora = dayjs.utc().tz('America/Argentina/Buenos_Aires');
        const fin = fechaFin.includes('T')
            ? dayjs.utc(fechaFin).tz('America/Argentina/Buenos_Aires')
            : dayjs(fechaFin).tz('America/Argentina/Buenos_Aires');

        // Si la fecha de fin ya pasó, la reserva expiró
        if (ahora.isAfter(fin)) {
            return {
                label: 'Expirada',
                color: 'orange',
                bgColor: 'bg-orange-100',
                textColor: 'text-orange-800'
            };
        }
    }

    // NUEVO: Si es completada pero el vehículo todavía está estacionado (sin salida registrada)
    // mostrar como "En Estacionamiento" en lugar de "Completada"
    if (estado === 'completada' && ocupacion && !ocupacion.ocu_fh_salida) {
        return {
            label: 'En Estacionamiento',
            color: 'green',
            bgColor: 'bg-green-100',
            textColor: 'text-green-800'
        };
    }

    return estados[estado] || estados.completada;
}

/**
 * Calcula el tiempo restante hasta el inicio de una reserva
 * Si la reserva ya comenzó, calcula el tiempo hasta el fin
 */
export function calcularTiempoRestante(fechaInicio: string, fechaFin?: string): {
    tiempoRestante: string;
    esUrgente: boolean;
    minutosRestantes: number;
} {
    // FIX: Usar dayjs.utc() para obtener hora actual correctamente
    const ahora = dayjs.utc().tz('America/Argentina/Buenos_Aires');
    const inicio = fechaInicio.includes('T')
        ? dayjs.utc(fechaInicio).tz('America/Argentina/Buenos_Aires')
        : dayjs(fechaInicio).tz('America/Argentina/Buenos_Aires');
    
    // Si la reserva ya comenzó y tenemos fechaFin, calcular tiempo hasta el fin
    if (ahora.isAfter(inicio) && fechaFin) {
        const fin = fechaFin.includes('T')
            ? dayjs.utc(fechaFin).tz('America/Argentina/Buenos_Aires')
            : dayjs(fechaFin).tz('America/Argentina/Buenos_Aires');
        const diffMs = fin.diff(ahora);
        
        if (diffMs <= 0) {
            return {
                tiempoRestante: 'Finalizada',
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
    
    // Si la reserva aún no ha comenzado, calcular tiempo hasta el inicio
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
    // FIX: Usar dayjs.utc() para obtener hora actual como UTC, luego convertir a Argentina
    // Así funciona correctamente tanto en localhost como en Vercel
    const ahora = dayjs.utc().tz('America/Argentina/Buenos_Aires');

    console.log(`🕐 [OPCIONES] Generando opción de reserva inmediata: ${ahora.format('YYYY-MM-DD HH:mm:ss')}`);

    // Solo una opción: hora actual
    return [{
        // FIX: Convertir a UTC antes de toISOString para guardar correctamente en BD
        value: ahora.utc().toISOString(),
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
    // Calcular duración en timezone Argentina
    const fechaIngreso = dayjs.utc(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires');
    const fechaFin = dayjs.utc(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires');
    const duracionHoras = fechaFin.diff(fechaIngreso, 'hour', true);

    const instrucciones = [
        `Tu reserva está confirmada para la plaza ${reserva.pla_numero}`,
        `Debes llegar a partir de ${formatearFechaReserva(reserva.res_fh_ingreso)}`,
        `Tu tiempo de estacionamiento es válido hasta ${formatearFechaReserva(reserva.res_fh_fin)}`,
        `Muestra este código al operador: ${formatearCodigoReserva(reserva.res_codigo)}`,
        `Duración total: ${formatearDuracion(Math.round(duracionHoras))}`
    ];

    return instrucciones.join('\n');
}
