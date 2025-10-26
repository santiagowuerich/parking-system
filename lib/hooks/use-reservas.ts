// lib/hooks/use-reservas.ts
// Custom hooks para gestión de reservas

import { useState, useEffect } from 'react';
import {
    ReservaConDetalles,
    CrearReservaRequest,
    CrearReservaResponse,
    DisponibilidadResponse,
    MisReservasResponse,
    BuscarReservaResponse,
    ConfirmarLlegadaRequest,
    ConfirmarLlegadaResponse,
    ReservasOperadorResponse,
    PlazaDisponible
} from '@/lib/types';

/**
 * Hook para obtener las reservas del conductor autenticado
 */
export function useReservasConductor() {
    const [data, setData] = useState<MisReservasResponse['data'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReservas = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/reservas/mis-reservas');
            const result: MisReservasResponse = await response.json();

            if (result.success) {
                setData(result.data || null);
            } else {
                setError(result.error || 'Error obteniendo reservas');
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error fetching reservas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReservas();
    }, []);

    return {
        data,
        loading,
        error,
        refetch: fetchReservas
    };
}

/**
 * Hook para crear una nueva reserva
 */
export function useCrearReserva() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const crearReserva = async (request: CrearReservaRequest): Promise<CrearReservaResponse | null> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/reservas/crear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            const result: CrearReservaResponse = await response.json();

            if (result.success) {
                return result;
            } else {
                setError(result.error || 'Error creando reserva');
                return null;
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error creating reserva:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        crearReserva,
        loading,
        error
    };
}

/**
 * Hook para consultar disponibilidad de plazas
 */
export function useDisponibilidadPlazas() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const consultarDisponibilidad = async (
        estId: number,
        fechaInicio: string,
        duracionHoras: number
    ): Promise<PlazaDisponible[] | null> => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                est_id: estId.toString(),
                fecha_inicio: fechaInicio,
                duracion_horas: duracionHoras.toString()
            });

            const response = await fetch(`/api/reservas/disponibilidad?${params}`);
            const result: DisponibilidadResponse = await response.json();

            if (result.success && result.data) {
                return result.data.plazas;
            } else {
                setError(result.error || 'Error consultando disponibilidad');
                return null;
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error fetching disponibilidad:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        consultarDisponibilidad,
        loading,
        error
    };
}

/**
 * Hook para buscar reservas (operador)
 */
export function useBuscarReserva() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buscarReserva = async (
        codigo?: string,
        patente?: string,
        estId?: number
    ): Promise<ReservaConDetalles | null> => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (codigo) params.append('codigo', codigo);
            if (patente) params.append('patente', patente);
            if (estId) params.append('est_id', estId.toString());

            const response = await fetch(`/api/reservas/buscar?${params}`);
            const result: BuscarReservaResponse = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                setError(result.error || 'Reserva no encontrada');
                return null;
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error searching reserva:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        buscarReserva,
        loading,
        error
    };
}

/**
 * Hook para confirmar llegada de una reserva (operador)
 */
export function useConfirmarLlegada() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const confirmarLlegada = async (
        request: ConfirmarLlegadaRequest
    ): Promise<ConfirmarLlegadaResponse | null> => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/reservas/confirmar-llegada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            const result: ConfirmarLlegadaResponse = await response.json();

            if (result.success) {
                return result;
            } else {
                setError(result.error || 'Error confirmando llegada');
                return null;
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error confirming llegada:', err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        confirmarLlegada,
        loading,
        error
    };
}

/**
 * Hook para obtener reservas del operador
 */
export function useReservasOperador() {
    const [data, setData] = useState<ReservasOperadorResponse['data'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReservasOperador = async (
        estId: number,
        fecha?: string,
        estado?: string
    ) => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                est_id: estId.toString()
            });

            if (fecha) params.append('fecha', fecha);
            if (estado) params.append('estado', estado);

            const response = await fetch(`/api/reservas/operador?${params}`);
            const result: ReservasOperadorResponse = await response.json();

            if (result.success) {
                setData(result.data || null);
            } else {
                setError(result.error || 'Error obteniendo reservas');
            }
        } catch (err) {
            setError('Error de conexión');
            console.error('Error fetching reservas operador:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // No hacer fetch automático, debe ser llamado explícitamente
    }, []);

    return {
        data,
        loading,
        error,
        fetchReservasOperador
    };
}

/**
 * Hook para procesar pagos de reservas
 */
export function useProcesarPagoReserva() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const procesarPago = async (
        metodoPago: 'transferencia' | 'link_pago' | 'qr',
        paymentData: any
    ): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

            // Aquí se implementaría la lógica específica según el método de pago
            // Por ahora simulamos el proceso

            if (metodoPago === 'transferencia') {
                // Mostrar datos bancarios y esperar confirmación manual
                console.log('Procesando transferencia:', paymentData);
                return true;
            } else if (metodoPago === 'link_pago' || metodoPago === 'qr') {
                // Redirigir a MercadoPago
                if (paymentData.preference_id) {
                    // window.location.href = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${paymentData.preference_id}`;
                    console.log('Redirigiendo a MercadoPago:', paymentData.preference_id);
                    return true;
                }
            }

            return false;
        } catch (err) {
            setError('Error procesando pago');
            console.error('Error processing payment:', err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        procesarPago,
        loading,
        error
    };
}
