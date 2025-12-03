// lib/empleados-utils.ts
// Utilidades para la gestión de empleados

export interface Empleado {
    usu_id: number;
    nombre: string;
    apellido: string;
    dni: string;
    email: string | null;
    estado: string;
    requiere_cambio_contrasena: boolean;
    disponibilidad: Disponibilidad[];
    estacionamiento: {
        est_id: number;
        est_nombre: string;
        est_locali: string;
    };
    fecha_asignacion: string;
    activo: boolean;
    contrasena?: string; // Campo opcional para formularios
}

export interface Disponibilidad {
    dia_semana: number;
    turno: string;
    turno_id: number;
}

export interface Turno {
    turno_id: number;
    nombre_turno: string;
}

export interface Estacionamiento {
    est_id: number;
    est_nombre: string;
    est_direc: string;
    est_locali: string;
}

// Mapeo de días de la semana
export const DIAS_SEMANA = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo'
} as const;

// Función para obtener el nombre del día
export function getNombreDia(diaSemana: number): string {
    return DIAS_SEMANA[diaSemana as keyof typeof DIAS_SEMANA] || 'Desconocido';
}

// Función para formatear la disponibilidad de un empleado
export function formatearDisponibilidad(disponibilidad: Disponibilidad[]): string {
    if (!disponibilidad || disponibilidad.length === 0) {
        return 'Sin disponibilidad configurada';
    }

    const diasPorTurno = disponibilidad.reduce((acc, disp) => {
        if (!acc[disp.turno]) {
            acc[disp.turno] = [];
        }
        acc[disp.turno].push(getNombreDia(disp.dia_semana));
        return acc;
    }, {} as Record<string, string[]>);

    return Object.entries(diasPorTurno)
        .map(([turno, dias]) => `${turno}: ${dias.join(', ')}`)
        .join(' | ');
}

// Función para validar datos de empleado
export function validarEmpleado(empleado: Partial<Empleado>): string[] {
    const errores: string[] = [];

    if (!empleado.nombre?.trim()) {
        errores.push('El nombre es requerido');
    }

    if (!empleado.apellido?.trim()) {
        errores.push('El apellido es requerido');
    }

    if (!empleado.dni?.trim()) {
        errores.push('El DNI es requerido');
    } else {
        // Validar DNI: solo números, entre 7 y 9 dígitos
        if (!/^\d{7,9}$/.test(empleado.dni)) {
            errores.push('El DNI debe contener solo números y tener entre 7 y 9 dígitos');
        }
    }

    if (!empleado.email?.trim()) {
        errores.push('El email es requerido');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empleado.email)) {
        errores.push('El email no tiene un formato válido');
    }

    return errores;
}

// Función para crear empleado en el backend
export async function crearEmpleado(empleadoData: {
    nombre: string;
    apellido: string;
    dni: string;
    email: string;
    contrasena: string;
    estado?: string;
    est_id: number;
    disponibilidad?: Disponibilidad[];
}): Promise<{ success: boolean; data?: Empleado; error?: string }> {
    try {
        console.log('🌐 Enviando petición POST a /api/empleados');
        console.log('📦 Body enviado:', JSON.stringify(empleadoData, null, 2));

        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(empleadoData),
        });

        console.log('📊 Respuesta HTTP:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        const result = await response.json();
        console.log('📋 Resultado JSON:', result);

        if (!response.ok) {
            console.log('❌ Error en respuesta del servidor');
            return { success: false, error: result.error || 'Error al crear empleado' };
        }

        console.log('✅ Empleado creado exitosamente');
        return { success: true, data: result.empleado };
    } catch (error) {
        return { success: false, error: 'Error de conexión' };
    }
}

// Función para obtener empleados
export async function obtenerEmpleados(estId?: number): Promise<{ success: boolean; data?: Empleado[]; error?: string }> {
    try {
        const url = estId ? `/api/empleados?est_id=${estId}` : '/api/empleados';
        console.log('🔍 obtenerEmpleados - URL:', url);

        const response = await fetch(url);
        console.log('📡 obtenerEmpleados - Respuesta HTTP:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        const result = await response.json();
        console.log('📋 obtenerEmpleados - Resultado JSON:', result);

        if (!response.ok) {
            console.log('❌ obtenerEmpleados - Error en respuesta');
            return { success: false, error: result.error || 'Error al obtener empleados' };
        }

        console.log('✅ obtenerEmpleados - Éxito, empleados encontrados:', result.empleados?.length || 0);
        return { success: true, data: result.empleados };
    } catch (error) {
        console.log('❌ obtenerEmpleados - Error de conexión:', error);
        return { success: false, error: 'Error de conexión' };
    }
}

// Función para actualizar empleado
export async function actualizarEmpleado(empleadoData: Partial<Empleado>): Promise<{ success: boolean; data?: Empleado; error?: string }> {
    try {
        const response = await fetch('/api/empleados', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(empleadoData),
        });

        const result = await response.json();

        if (!response.ok) {
            return { success: false, error: result.error || 'Error al actualizar empleado' };
        }

        return { success: true, data: result.empleado };
    } catch (error) {
        return { success: false, error: 'Error de conexión' };
    }
}

// Función para eliminar empleado
export async function eliminarEmpleado(usuId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch('/api/empleados', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ usu_id: usuId }),
        });

        if (!response.ok) {
            const result = await response.json();
            return { success: false, error: result.error || 'Error al eliminar empleado' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: 'Error de conexión' };
    }
}

// Función para obtener turnos disponibles
export async function obtenerTurnos(): Promise<{ success: boolean; data?: Turno[]; error?: string }> {
    try {
        const response = await fetch('/api/empleados/turnos');
        const result = await response.json();

        if (!response.ok) {
            return { success: false, error: result.error || 'Error al obtener turnos' };
        }

        return { success: true, data: result.turnos };
    } catch (error) {
        return { success: false, error: 'Error de conexión' };
    }
}

// Función para obtener estacionamientos del usuario
export async function obtenerEstacionamientosUsuario(): Promise<{ success: boolean; data?: Estacionamiento[]; error?: string }> {
    try {
        const response = await fetch('/api/empleados/estacionamientos');
        const result = await response.json();

        if (!response.ok) {
            return { success: false, error: result.error || 'Error al obtener estacionamientos' };
        }

        return { success: true, data: result.estacionamientos };
    } catch (error) {
        return { success: false, error: 'Error de conexión' };
    }
}
