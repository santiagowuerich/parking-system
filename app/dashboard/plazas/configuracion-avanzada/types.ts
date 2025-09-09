// Tipos compartidos para la configuración avanzada de plazas

export interface Plaza {
    numero: number;
    estado: string;
    tipo_vehiculo: string;
    plantilla_actual: {
        plantilla_id: number;
        nombre_plantilla: string;
        catv_segmento: string;
    } | null;
    zona_id: number;
    zona_nombre: string;
}

export interface Zona {
    zona_id: number;
    zona_nombre: string;
    grid: {
        rows: number;
        cols: number;
        numbering: string;
    };
}

export interface Plantilla {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: string;
    caracteristicas: { [tipo: string]: string[] };
}


export interface Action {
    tipo: 'APLICAR_PLANTILLA' | 'LIMPIAR_PLANTILLA';
    plantilla_id?: number;
    plazas: number[];
    timestamp: number;
}

export type ModoSeleccion = 'individual' | 'rango' | 'fila' | 'columna';

export type TipoVehiculo = 'AUT' | 'MOT' | 'CAM';

export type EstadoPlaza = 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento';

export type NumeroType = 'ROW_MAJOR' | 'COL_MAJOR';
