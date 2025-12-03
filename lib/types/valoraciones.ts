// ============================================
// TIPOS PARA SISTEMA DE VALORACIONES
// ============================================

/**
 * Estructura de una valoración en la base de datos
 */
export interface Valoracion {
    val_id: number;
    est_id: number;
    usu_id: number;
    val_rating: number; // 1-5
    val_comentario: string | null;
    val_created_at: string;
    val_updated_at: string;
}

/**
 * Valoración con información del usuario (anonimizada)
 */
export interface ValoracionConUsuario extends Valoracion {
    usuario: {
        usu_nom: string;
        usu_ape: string;
    };
}

/**
 * Estadísticas de valoraciones de un estacionamiento
 */
export interface ValoracionStats {
    total_valoraciones: number;
    promedio_rating: number;
    distribucion: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
}

/**
 * Información de paginación
 */
export interface PaginacionInfo {
    pagina_actual: number;
    total_paginas: number;
    total_elementos: number;
    elementos_por_pagina: number;
}

/**
 * Respuesta del GET de valoraciones
 */
export interface ValoracionesResponse {
    success: boolean;
    valoraciones: ValoracionConUsuario[];
    estadisticas: ValoracionStats;
    paginacion: PaginacionInfo;
    mi_valoracion?: Valoracion | null;
}

/**
 * Request body para crear una valoración
 */
export interface CreateValoracionRequest {
    rating: number; // 1-5
    comentario?: string;
}

/**
 * Request body para actualizar una valoración
 */
export interface UpdateValoracionRequest {
    rating: number; // 1-5
    comentario?: string;
}

/**
 * Respuesta de crear/actualizar valoración
 */
export interface ValoracionMutationResponse {
    success: boolean;
    valoracion?: Valoracion;
    error?: string;
}

/**
 * Respuesta de eliminar valoración
 */
export interface DeleteValoracionResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Props para el componente de estrellas
 */
export interface StarRatingProps {
    rating: number;
    onRatingChange?: (rating: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Props para el formulario de valoración
 */
export interface ValoracionFormProps {
    estacionamientoId: number;
    valoracionExistente?: Valoracion | null;
    onSubmit: (data: CreateValoracionRequest) => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
}

/**
 * Props para la lista de valoraciones
 */
export interface ValoracionesListProps {
    estacionamientoId: number;
    onEditarMiValoracion?: () => void;
    onEliminarMiValoracion?: () => void;
}

/**
 * Props para el modal de valoraciones
 */
export interface ValoracionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estacionamiento: {
        est_id: number;
        est_nombre: string;
    };
    readOnly?: boolean; // Si true, solo permite ver valoraciones, no crear/editar la propia
}

/**
 * Props para el botón de valoración
 */
export interface ValoracionButtonProps {
    estacionamiento: {
        est_id: number;
        est_nombre: string;
    };
}

