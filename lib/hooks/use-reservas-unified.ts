"use client";

import { useState, useEffect, useCallback } from 'react';
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
 * Hook unificado para gestión completa de reservas
 */
export function useReservas(estId?: number) {
    // Estados para diferentes operaciones
    const [misReservas, setMisReservas] = useState<ReservaConDetalles[]>([]);
    const [reservasOperador, setReservasOperador] = useState<ReservaConDetalles[]>([]);
    const [plazasDisponibles, setPlazasDisponibles] = useState<PlazaDisponible[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Obtener mis reservas (conductor)
    const obtenerMisReservas = useCallback(async (): Promise<MisReservasResponse> => {
        setLoading(true);
        setError(null);
        try {
            console.log('📋 Obteniendo mis reservas...');
            const response = await fetch('/api/reservas/mis-reservas');
            const data = await response.json();

            if (data.success && data.data) {
                console.log(`✅ Reservas obtenidas: ${Array.isArray(data.data) ? data.data.length : 'formato incorrecto'}`);
                // data.data es un array de ReservaConDetalles
                const reservas = Array.isArray(data.data) ? data.data : [];

                // Para reservas confirmadas o completadas, verificar si están ocupadas
                // Sin necesidad de migración en BD, simplemente consultamos ocupacion
                const reservasConEstadoActualizado = await Promise.all(
                    reservas.map(async (reserva) => {
                        if ((reserva.res_estado === 'confirmada' || reserva.res_estado === 'completada') && reserva.res_codigo) {
                            try {
                                // Buscar si hay una ocupación sin salida para esta reserva
                                const ocupacionResponse = await fetch(
                                    `/api/ocupacion/check?res_codigo=${reserva.res_codigo}`
                                );
                                const ocupacionData = await ocupacionResponse.json();

                                if (ocupacionData.ocupada) {
                                    // Si hay ocupación activa (sin salida), crear objeto ocupacion temporal
                                    return {
                                        ...reserva,
                                        ocupacion: {
                                            ocu_fh_salida: null
                                        }
                                    };
                                }
                            } catch (err) {
                                console.error('Error verificando ocupación:', err);
                                // Si hay error, devolver la reserva sin cambios
                            }
                        }
                        return reserva;
                    })
                );

                setMisReservas(reservasConEstadoActualizado);
            } else {
                console.error('❌ Error en respuesta:', data.error);
                setError(data.error || 'Error obteniendo reservas');
                setMisReservas([]);
            }

            return data;
        } catch (error) {
            console.error('❌ Error obteniendo mis reservas:', error);
            const errorMsg = error instanceof Error ? error.message : 'Error al obtener las reservas';
            setError(errorMsg);
            setMisReservas([]);
            return {
                success: false,
                error: errorMsg,
                data: []
            };
        } finally {
            setLoading(false);
        }
    }, []);

    // Crear nueva reserva
    const crearReserva = useCallback(async (request: CrearReservaRequest): Promise<CrearReservaResponse> => {
        try {
            const response = await fetch('/api/reservas/crear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creando reserva:', error);
            return {
                success: false,
                message: 'Error al crear la reserva',
                data: null
            };
        }
    }, []);

    // Consultar disponibilidad de plazas
    const consultarDisponibilidad = useCallback(async (
        estId: number,
        fechaInicio: string,
        duracionHoras: number
    ): Promise<DisponibilidadResponse> => {
        try {
            const params = new URLSearchParams({
                est_id: estId.toString(),
                fecha_inicio: fechaInicio,
                duracion_horas: duracionHoras.toString()
            });

            const response = await fetch(`/api/reservas/disponibilidad?${params}`);
            const data = await response.json();

            if (data.success && data.data) {
                setPlazasDisponibles(data.data.plazas || []);
            }

            return data;
        } catch (error) {
            console.error('Error consultando disponibilidad:', error);
            return {
                success: false,
                message: 'Error al consultar disponibilidad',
                data: null
            };
        }
    }, []);

    // Buscar reserva (operador)
    const buscarReserva = useCallback(async (
        busqueda: string,
        tipo: 'codigo' | 'patente' = 'codigo'
    ): Promise<BuscarReservaResponse> => {
        try {
            const params = new URLSearchParams();
            if (tipo === 'codigo') {
                params.append('codigo', busqueda);
            } else {
                params.append('patente', busqueda);
            }
            if (estId) params.append('est_id', estId.toString());

            const response = await fetch(`/api/reservas/buscar?${params}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error buscando reserva:', error);
            return {
                success: false,
                message: 'Error al buscar la reserva',
                data: null
            };
        }
    }, [estId]);

    // Confirmar llegada (operador)
    const confirmarLlegada = useCallback(async (codigoReserva: string): Promise<ConfirmarLlegadaResponse> => {
        try {
            const response = await fetch('/api/reservas/confirmar-llegada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    res_codigo: codigoReserva,
                    est_id: estId
                }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error confirmando llegada:', error);
            return {
                success: false,
                message: 'Error al confirmar la llegada',
                data: null
            };
        }
    }, [estId]);

    // Obtener reservas del operador
    const obtenerReservasOperador = useCallback(async (fecha?: string): Promise<ReservasOperadorResponse> => {
        try {
            const params = new URLSearchParams();
            if (estId) params.append('est_id', estId.toString());
            if (fecha) params.append('fecha', fecha);

            const response = await fetch(`/api/reservas/operador?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                setReservasOperador(data.data.reservas || []);
            }

            return data;
        } catch (error) {
            console.error('Error obteniendo reservas del operador:', error);
            return {
                success: false,
                message: 'Error al obtener las reservas',
                data: null
            };
        }
    }, [estId]);

    // Procesar pago de reserva
    const procesarPagoReserva = useCallback(async (
        metodoPago: 'transferencia' | 'link_pago' | 'qr',
        paymentData: any
    ): Promise<boolean> => {
        try {
            setLoading(true);
            setError(null);

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
    }, []);

    return {
        // Estados
        misReservas,
        reservasOperador,
        plazasDisponibles,
        loading,
        error,

        // Funciones
        obtenerMisReservas,
        crearReserva,
        consultarDisponibilidad,
        buscarReserva,
        confirmarLlegada,
        obtenerReservasOperador,
        procesarPagoReserva,

        // Funciones de conveniencia
        refetchMisReservas: obtenerMisReservas,
        refetchReservasOperador: obtenerReservasOperador,
    };
}
