"use client";

import { useEffect, useState, useRef } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import OperatorPanel from "@/components/operator-panel";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { createBrowserClient } from "@supabase/ssr";
import type { Parking, Vehicle, VehicleType, ParkingHistory, VehicleEntryData, PaymentMethod, PaymentData } from "@/lib/types";
import type { PaymentStatus } from "@/lib/types/payment";
import { calculateFee, formatDuration } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import { useRouter } from "next/navigation";
import PaymentMethodSelector from "@/components/payment-method-selector";
import TransferInfoDialog from "@/components/transfer-info-dialog";
import QRPaymentDialog from "@/components/qr-payment-dialog";
import { generatePaymentId, formatCurrency } from "@/lib/utils/payment-utils";
import { calculateParkingFee } from "@/lib/tariff-calculator";
import { useTurnos } from "@/lib/hooks/use-turnos";
import { TurnoGuard } from "@/components/turno-guard";


type ExitInfo = {
    vehicle: Vehicle;
    fee: number;
    exitTime: Date;
    duration: string;
    agreedPrice?: number;
    calculatedFee?: number;
};

export default function OperadorSimplePage() {
    const { user, estId, parkedVehicles, parkingCapacity, refreshParkedVehicles, refreshParkingHistory, refreshCapacity, fetchUserData } = useAuth();
    const { canOperateParking, loading: roleLoading, role } = useUserRole();
    const { puedeOperar, isEmployee } = useTurnos();
    const router = useRouter();

    // Verificar que el usuario pueda operar el estacionamiento
    useEffect(() => {
        if (!roleLoading && !canOperateParking) {
            const timeoutId = setTimeout(() => {
                router.push('/dashboard');
            }, 2000); // Debounce extendido de 2 segundos

            return () => clearTimeout(timeoutId);
        }
    }, [canOperateParking, roleLoading, router]);

    // Cargar datos del usuario y estacionamiento cuando estén disponibles
    useEffect(() => {
        if (user?.id && estId && !roleLoading) {
            fetchUserData();
        }
    }, [user?.id, estId, roleLoading, fetchUserData]);

    const [parking, setParking] = useState<Parking | null>(null);
    const [loading, setLoading] = useState(true);
    const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
    const [plazasData, setPlazasData] = useState<any>(null);
    const [loadingPlazas, setLoadingPlazas] = useState(true);

    // Datos completos para visualización rica
    const [plazasCompletas, setPlazasCompletas] = useState<any[]>([]);
    const [loadingPlazasCompletas, setLoadingPlazasCompletas] = useState(true);

    // Estados para el sistema de pagos
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [showQRDialog, setShowQRDialog] = useState(false);
    const [showLinkPagoConfirm, setShowLinkPagoConfirm] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [qrPaymentStatus, setQRPaymentStatus] = useState<PaymentStatus>('pendiente');
    const [qrData, setQrData] = useState<{ qrCode: string, qrCodeImage: string, preferenceId: string } | null>(null);
    const [paymentSettings, setPaymentSettings] = useState<any>(null);

    // Estados para confirmación de reserva
    const [showReservationConfirm, setShowReservationConfirm] = useState(false);
    const [reservationData, setReservationData] = useState<any>(null);
    const reservationExitDataRef = useRef<any>(null);


    // Inicializar datos del parking
    useEffect(() => {
        if (parkedVehicles !== null && parkingCapacity && estId) {
            setParking({
                capacity: parkingCapacity,
                parkedVehicles: parkedVehicles,
                rates: {},
                history: [] // Se puede cargar después si es necesario
            });
        }
    }, [parkedVehicles, parkingCapacity, estId]);

    // Cargar configuración de métodos de pago
    useEffect(() => {
        if (!estId) return;

        const loadPaymentSettings = async () => {
            try {
                console.log('💳 Cargando configuración de pagos...');

                // Cargar métodos habilitados del estacionamiento
                const response = await fetch(`/api/payment/methods?est_id=${estId}`);
                let methodsData: { methods?: Array<{ method: string; enabled: boolean }> } = { methods: [] };

                if (response.ok) {
                    methodsData = await response.json();
                    console.log('✅ Métodos de pago cargados:', methodsData.methods);
                }

                // Cargar configuración del estacionamiento (API keys, datos bancarios)
                const userResponse = await fetch(`/api/estacionamiento/configuraciones?est_id=${estId}`);
                let userSettings: {
                    mercadopagoApiKey?: string;
                    bankAccountCbu?: string;
                    bankAccountAlias?: string;
                } = {};

                if (userResponse.ok) {
                    userSettings = await userResponse.json();
                    console.log('✅ Configuración del estacionamiento cargada:', {
                        hasMercadoPago: !!userSettings.mercadopagoApiKey,
                        hasBankData: !!(userSettings.bankAccountCbu && userSettings.bankAccountAlias),
                        rawUserSettings: userSettings // Debug completo
                    });
                }

                // Convertir el formato del endpoint al formato esperado por getAvailablePaymentMethods
                const efectivoEnabled = methodsData.methods?.find((m: any) => m.method === 'Efectivo')?.enabled ?? false;
                const transferenciaEnabled = methodsData.methods?.find((m: any) => m.method === 'Transferencia')?.enabled ?? false;
                // MercadoPago en BD se mapea tanto a QR como Link de Pago en el frontend
                // Buscar cualquiera de los métodos de MercadoPago
                const qrEnabled = methodsData.methods?.find((m: any) => m.method === 'QR')?.enabled ?? false;
                const linkPagoEnabled = methodsData.methods?.find((m: any) => m.method === 'Link de Pago')?.enabled ?? false;
                const mercadopagoEnabled = qrEnabled || linkPagoEnabled;

                const settings: any = {
                    efectivo: { enabled: efectivoEnabled },
                    transfer: {
                        enabled: transferenciaEnabled,
                        cbu: userSettings.bankAccountCbu || '',
                        alias: userSettings.bankAccountAlias || ''
                    },
                    mercadopago: {
                        enabled: mercadopagoEnabled,
                        accessToken: userSettings.mercadopagoApiKey || '',
                        // Para QR solo necesitamos accessToken, para link_pago necesitaríamos publicKey
                        // Por ahora usamos el mismo accessToken como publicKey para que funcionen ambos
                        publicKey: userSettings.mercadopagoApiKey || ''
                    }
                };

                console.log('🔧 Configuración final de pagos:', {
                    efectivo: settings.efectivo.enabled,
                    transferencia: settings.transfer.enabled && !!(settings.transfer.cbu && settings.transfer.alias),
                    'qr/link_pago': settings.mercadopago.enabled && !!settings.mercadopago.accessToken,
                    'settings_completos': settings // Debug completo
                });

                // Debug adicional para QR específicamente
                console.log('🔍 Debug QR:', {
                    mercadopagoEnabled,
                    hasAccessToken: !!settings.mercadopago.accessToken,
                    hasPublicKey: !!settings.mercadopago.publicKey,
                    accessToken: settings.mercadopago.accessToken,
                    publicKey: settings.mercadopago.publicKey
                });

                setPaymentSettings(settings);
            } catch (error) {
                console.error('❌ Error al cargar configuración de pagos:', error);
                // Configuración por defecto (solo efectivo habilitado)
                setPaymentSettings({
                    efectivo: { enabled: true },
                    transfer: { enabled: false, cbu: '', alias: '' },
                    mercadopago: { enabled: false, accessToken: '', publicKey: '' }
                });
            }
        };

        loadPaymentSettings();
    }, [estId]);

    // AbortController para cancelar requests previos
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cargar todos los datos consolidados (reemplaza fetchPlazasStatus + fetchPlazasCompletas)
    const fetchDashboardData = async (source = 'unknown') => {
        if (!estId) return;

        // Cancelar request anterior si existe
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Crear nuevo AbortController
        abortControllerRef.current = new AbortController();

        try {
            setLoadingPlazas(true);
            setLoadingPlazasCompletas(true);

            console.log(`🚀 [${source}] Cargando datos consolidados del dashboard...`);
            const response = await fetch(`/api/plazas/dashboard?est_id=${estId}`, {
                signal: abortControllerRef.current.signal
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ [${source}] Datos consolidados recibidos:`, {
                    plazas: data.estadisticas?.total_plazas || 0,
                    vehiculos: data.vehiculosEstacionados?.length || 0
                });

                // Actualizar estado de plazas (reemplaza fetchPlazasStatus)
                setPlazasData(data.status);

                // Actualizar datos completos (reemplaza fetchPlazasCompletas)
                setPlazasCompletas(data.plazasCompletas || []);
            } else {
                console.error(`❌ [${source}] Error al cargar datos del dashboard`);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log(`🚫 [${source}] Request cancelado (abortado)`);
                return; // No es un error real, solo se canceló
            }
            console.error(`❌ [${source}] Error al cargar datos del dashboard:`, error);
        } finally {
            setLoadingPlazas(false);
            setLoadingPlazasCompletas(false);
        }
    };

    // Cargar estado inicial con debounce
    useEffect(() => {
        if (!estId) {
            setLoading(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            const initializeData = async () => {
                setLoading(true);
                await fetchDashboardData('initial-load'); // Una sola consulta consolidada
                setLoading(false);
            };

            initializeData();
        }, 400); // Debounce de 400ms

        return () => clearTimeout(timeoutId);
    }, [estId]);

    // Suscripciones de realtime optimizadas
    useEffect(() => {
        if (!estId) return;

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        let updateTimeout: NodeJS.Timeout | null = null;
        let lastUpdateTime = 0;

        // Función de actualización debounced agresiva para evitar múltiples llamadas simultaneas
        const debouncedUpdate = (eventType: string) => {
            const now = Date.now();

            // Si la última actualización fue hace menos de 2 segundos, ignorar
            if (now - lastUpdateTime < 2000) {
                console.log(`🚫 [${eventType}] Actualización ignorada (muy reciente: ${now - lastUpdateTime}ms)`);
                return;
            }

            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }

            updateTimeout = setTimeout(async () => {
                try {
                    lastUpdateTime = Date.now();
                    console.log(`🔄 [${eventType}] Ejecutando actualización realtime...`);

                    // Una sola consulta consolidada + refresh básico
                    await fetchDashboardData(`realtime-${eventType}`);
                    await refreshParkedVehicles();

                    console.log(`✅ [${eventType}] Actualización realtime completada`);
                } catch (error) {
                    console.error(`❌ [${eventType}] Error en actualización realtime:`, error);
                }
            }, 2000); // Debounce aumentado a 2 segundos
        };

        const channel = supabase.channel(`parking-operator-updates-${estId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'vehicle_movements',
                filter: `est_id=eq.${estId}`
            }, (payload) => {
                console.log('🚗 Vehicle movement detected:', payload);
                debouncedUpdate('vehicle-movement');
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'plaza_status_changes',
                filter: `est_id=eq.${estId}`
            }, (payload) => {
                console.log('🅿️ Plaza status change detected:', payload);
                debouncedUpdate('plaza-status');
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'ocupacion',
                filter: `est_id=eq.${estId}`
            }, (payload) => {
                console.log('📍 Occupation change detected:', payload);
                debouncedUpdate('ocupacion');
            })
            .subscribe();

        return () => {
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            supabase.removeChannel(channel);
        };
    }, [estId]);

    // Calcular espacios disponibles
    const getAvailableSpaces = () => {
        if (!parkingCapacity || !parkedVehicles) {
            return {
                Auto: 0,
                Moto: 0,
                Camioneta: 0,
                total: { capacity: 0, occupied: 0 }
            };
        }

        const occupied = {
            Auto: parkedVehicles.filter(v => v.type === 'Auto').length,
            Moto: parkedVehicles.filter(v => v.type === 'Moto').length,
            Camioneta: parkedVehicles.filter(v => v.type === 'Camioneta').length
        };

        return {
            Auto: parkingCapacity.Auto - occupied.Auto,
            Moto: parkingCapacity.Moto - occupied.Moto,
            Camioneta: parkingCapacity.Camioneta - occupied.Camioneta,
            total: {
                capacity: parkingCapacity.Auto + parkingCapacity.Moto + parkingCapacity.Camioneta,
                occupied: parkedVehicles.length
            }
        };
    };

    // Registrar entrada de vehículo
    const registerEntry = async (vehicleData: VehicleEntryData) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar entrada sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const payload: VehicleEntryData = {
                ...vehicleData,
                license_plate: vehicleData.license_plate.toUpperCase(),
            };

            const plazaSeleccionada = payload.pla_numero != null
                ? plazasCompletas.find(plaza => plaza.pla_numero === payload.pla_numero) || null
                : null;

            const abonoInfo = plazaSeleccionada?.abono || null;
            const reservaInfo = plazaSeleccionada?.reserva || null;
            const patentesAbono = (abonoInfo?.vehiculos || [])
                .map(v => v.veh_patente?.toUpperCase())
                .filter((patente): patente is string => Boolean(patente));

            const esAbono = Boolean(payload.isAbono || abonoInfo);
            const esReserva = payload.modality === 'Reserva' && reservaInfo;

            if (esAbono) {
                if (!abonoInfo) {
                    toast({
                        variant: "destructive",
                        title: "Abono no encontrado",
                        description: "La plaza seleccionada no tiene un abono activo."
                    });
                    return;
                }

                if (!patentesAbono.includes(payload.license_plate)) {
                    toast({
                        variant: "destructive",
                        title: "Vehículo no autorizado",
                        description: `La patente ${payload.license_plate} no pertenece al abono asignado a esta plaza.`
                    });
                    return;
                }

                payload.isAbono = true;
                payload.abono_nro = abonoInfo.abo_nro;
                payload.duracion_tipo = 'abono';
                payload.precio_acordado = 0;
            } else if (esReserva) {
                // VALIDACIÓN DE RESERVA
                if (!reservaInfo) {
                    toast({
                        variant: "destructive",
                        title: "Reserva no encontrada",
                        description: "La plaza seleccionada no tiene una reserva activa."
                    });
                    return;
                }

                if (reservaInfo.veh_patente?.toUpperCase() !== payload.license_plate) {
                    toast({
                        variant: "destructive",
                        title: "Vehículo no autorizado",
                        description: `La patente ${payload.license_plate} no coincide con la reserva de esta plaza.`
                    });
                    return;
                }

                // Asignar datos de reserva
                payload.isAbono = false;
                payload.abono_nro = undefined;
                payload.duracion_tipo = 'reserva';
                payload.res_codigo = reservaInfo.res_codigo;
                payload.precio_acordado = reservaInfo.res_monto;
            } else {
                payload.isAbono = false;
                payload.abono_nro = undefined;
            }

            // Mapeo de tipos de vehículo del frontend a códigos de BD
            const vehicleTypeMapping = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            let dbVehicleType = vehicleTypeMapping[payload.type as keyof typeof vehicleTypeMapping] || 'AUT';

            if (payload.isAbono && abonoInfo?.vehiculos) {
                const vehiculoAsociado = abonoInfo.vehiculos.find(
                    v => v.veh_patente?.toUpperCase() === payload.license_plate
                );

                if (vehiculoAsociado?.catv_segmento) {
                    dbVehicleType = vehiculoAsociado.catv_segmento;
                    payload.type = vehiculoAsociado.catv_segmento === 'MOT'
                        ? 'Moto'
                        : vehiculoAsociado.catv_segmento === 'CAM'
                            ? 'Camioneta'
                            : 'Auto';
                }
            }

            // Verificar si el vehículo ya existe, si no, crearlo
            const { data: existingVehicle, error: vehicleCheckError } = await supabase
                .from('vehiculos')
                .select('veh_patente')
                .eq('veh_patente', payload.license_plate)
                .single();

            if (vehicleCheckError && vehicleCheckError.code !== 'PGRST116') { // PGRST116 es "not found"
                throw vehicleCheckError;
            }

            // Si el vehículo no existe, crearlo
            if (!existingVehicle) {
                const { error: createVehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: payload.license_plate,
                        catv_segmento: dbVehicleType
                    });

                if (createVehicleError) throw createVehicleError;
            }

            // Calcular fecha límite basada en duración seleccionada (en timezone Argentina)
            let fechaLimite: Date | null = null;
            if (payload.duracion_tipo && payload.duracion_tipo !== 'hora' && payload.duracion_tipo !== 'abono') {
                const nowArgentina = dayjs().tz('America/Argentina/Buenos_Aires');
                let fechaLimiteArgentina: dayjs.Dayjs;
                switch (payload.duracion_tipo) {
                    case 'dia':
                        fechaLimiteArgentina = nowArgentina.add(1, 'day'); // +1 día
                        break;
                    case 'semana':
                        fechaLimiteArgentina = nowArgentina.add(7, 'day'); // +7 días
                        break;
                    case 'mes':
                        fechaLimiteArgentina = nowArgentina.add(30, 'day'); // +30 días (aproximado)
                        break;
                    default:
                        fechaLimiteArgentina = nowArgentina;
                }
                fechaLimite = fechaLimiteArgentina.toDate();
            }

            // 🎫 VERIFICAR SI HAY UNA RESERVA ACTIVA PARA ESTA PATENTE Y PLAZA
            console.log('🔍 Verificando si hay reserva activa para:', {
                license_plate: payload.license_plate,
                pla_numero: payload.pla_numero,
                est_id: estId
            });

            let reservaActiva = null;
            if (payload.pla_numero) {
                // PASO 1: Buscar reserva por patente EXACTA
                const { data: reservas, error: reservasError } = await supabase
                    .from('reservas')
                    .select('*')
                    .eq('est_id', estId)
                    .eq('pla_numero', payload.pla_numero)
                    .eq('veh_patente', payload.license_plate.toUpperCase())
                    .in('res_estado', ['confirmada', 'activa'])
                    .order('res_fh_ingreso', { ascending: false })
                    .limit(1);

                if (!reservasError && reservas && reservas.length > 0) {
                    reservaActiva = reservas[0];
                    console.log('✅ 🎫 RESERVA ACTIVA ENCONTRADA (patente exacta):', {
                        res_codigo: reservaActiva.res_codigo,
                        veh_patente: reservaActiva.veh_patente,
                        res_estado: reservaActiva.res_estado,
                        res_monto: reservaActiva.res_monto,
                        pag_nro: reservaActiva.pag_nro,
                        res_fh_fin: reservaActiva.res_fh_fin
                    });
                } else {
                    // PASO 2: Si no encontró por patente exacta, buscar por CONDUCTOR
                    console.log('ℹ️ No se encontró reserva por patente exacta, buscando por conductor...');

                    // Obtener conductor del vehículo actual
                    const { data: vehiculoData, error: vehiculoError } = await supabase
                        .from('vehiculos')
                        .select('con_id')
                        .eq('veh_patente', payload.license_plate.toUpperCase())
                        .single();

                    if (!vehiculoError && vehiculoData?.con_id) {
                        console.log(`🔍 Conductor del vehículo ${payload.license_plate}: ${vehiculoData.con_id}`);

                        // Buscar reservas del conductor en la misma plaza
                        const { data: reservasPorConductor, error: reservasConductorError } = await supabase
                            .from('reservas')
                            .select('*')
                            .eq('est_id', estId)
                            .eq('pla_numero', payload.pla_numero)
                            .eq('con_id', vehiculoData.con_id)
                            .in('res_estado', ['confirmada', 'activa'])
                            .order('res_fh_ingreso', { ascending: false })
                            .limit(1);

                        if (!reservasConductorError && reservasPorConductor && reservasPorConductor.length > 0) {
                            reservaActiva = reservasPorConductor[0];
                            console.log('✅ 🎫 RESERVA ACTIVA ENCONTRADA (por conductor - vehículo diferente):', {
                                res_codigo: reservaActiva.res_codigo,
                                veh_patente_reserva: reservaActiva.veh_patente,
                                veh_patente_actual: payload.license_plate,
                                con_id: vehiculoData.con_id,
                                res_estado: reservaActiva.res_estado,
                                res_monto: reservaActiva.res_monto,
                                res_fh_fin: reservaActiva.res_fh_fin
                            });
                        } else {
                            console.log('ℹ️ No se encontró reserva activa para este conductor en esta plaza');
                        }
                    } else {
                        console.log('⚠️ No se pudo obtener conductor del vehículo');
                    }
                }
            }

            // Registrar la ocupación
            // FIX: Usar formato sin Z para BD timestamp without time zone (Argentina)
            const entryTime = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss');

            // Si es reserva seleccionada desde el modal, usar los datos del payload
            const datosReserva = esReserva && payload.res_codigo ? {
                res_codigo: payload.res_codigo,
                res_monto: payload.precio_acordado,
                res_fh_fin: null // Se obtendría de la BD si es necesario
            } : reservaActiva;

            const ocupacionData = {
                est_id: estId,
                veh_patente: payload.license_plate,
                ocu_fh_entrada: entryTime, // Siempre la hora ACTUAL del ingreso, no la creación de la reserva
                pla_numero: payload.pla_numero || null, // Asegurar null explícito si no hay plaza
                ocu_duracion_tipo: datosReserva ? 'reserva' : (payload.duracion_tipo || 'hora'),
                ocu_precio_acordado: datosReserva ? datosReserva.res_monto : (payload.precio_acordado || 0),
                ocu_fecha_limite: datosReserva && reservaActiva ? reservaActiva.res_fh_fin : (fechaLimite ? fechaLimite.toISOString() : null),
                res_codigo: datosReserva ? datosReserva.res_codigo : null,
                pag_nro: reservaActiva ? reservaActiva.pag_nro : null
            };

            console.log('📝 Registrando ocupación con datos:', ocupacionData);
            console.log('📝 Tipo de pla_numero:', typeof payload.pla_numero, 'Valor:', payload.pla_numero);
            if (reservaActiva) {
                console.log('🎫 Ocupación asociada con reserva:', {
                    res_codigo: reservaActiva.res_codigo,
                    monto_pagado: reservaActiva.res_monto,
                    es_reserva: true
                });
            }

            const { error: ocupacionError } = await supabase
                .from('ocupacion')
                .insert(ocupacionData);

            if (ocupacionError) {
                console.error('❌ Error completo al registrar ocupación:', {
                    error: ocupacionError,
                    message: ocupacionError.message,
                    details: ocupacionError.details,
                    hint: ocupacionError.hint,
                    code: ocupacionError.code
                });

                const errorMessage = ocupacionError.message ||
                    ocupacionError.details ||
                    ocupacionError.hint ||
                    `Código de error: ${ocupacionError.code}` ||
                    JSON.stringify(ocupacionError);

                throw new Error(`Error al registrar ocupación: ${errorMessage}`);
            }

            // 🎫 Si había una reserva activa, actualizar su estado a 'completada' ya que el vehículo ya ingresó
            // La reserva cumplió su propósito (garantizar el lugar) y ya no debe seguir existiendo como activa
            if (reservaActiva && reservaActiva.res_estado === 'confirmada') {
                console.log('🔄 Actualizando estado de reserva de "confirmada" a "completada":', {
                    res_codigo: reservaActiva.res_codigo
                });

                const { error: updateReservaError } = await supabase
                    .from('reservas')
                    .update({ res_estado: 'completada' })
                    .eq('res_codigo', reservaActiva.res_codigo)
                    .eq('est_id', estId);

                if (updateReservaError) {
                    console.warn('⚠️ Error al actualizar estado de reserva:', updateReservaError);
                } else {
                    console.log('✅ Estado de reserva actualizado a "completada"');
                }
            }

            // Si se asignó una plaza específica, actualizarla
            if (payload.pla_numero) {
                const nuevoEstadoPlaza = payload.isAbono ? 'Abonado' : 'Ocupada';
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: nuevoEstadoPlaza })
                    .eq('pla_numero', payload.pla_numero)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error actualizando estado de plaza:', plazaUpdateError);
                    // No lanzar error aquí porque la ocupación ya se registró exitosamente
                }
            }

            await refreshParkedVehicles();
            await fetchDashboardData('register-entry'); // Una sola consulta consolidada

            toast({
                title: "Entrada registrada",
                description: payload.isAbono
                    ? `${payload.license_plate} ingresó como vehículo abonado`
                    : `${payload.license_plate} ha sido registrado exitosamente`
            });
        } catch (error) {
            console.error("Error al registrar entrada:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo registrar la entrada del vehículo"
            });
        }
    };

    // Iniciar proceso de salida (calcular tarifa y mostrar selector de pago)
    const handleExit = async (licensePlate: string) => {
        // Validar turno activo para empleados
        if (isEmployee && !puedeOperar()) {
            toast({
                variant: "destructive",
                title: "Turno no iniciado",
                description: "Debes abrir tu turno antes de registrar egresos"
            });
            return;
        }

        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar salida sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // Buscar la ocupación activa del vehículo
            const { data: ocupacion, error: ocupacionError } = await supabase
                .from('vw_ocupacion_actual')
                .select('*')
                .eq('license_plate', licensePlate)
                .eq('est_id', estId)
                .single();

            if (ocupacionError || !ocupacion) {
                throw new Error("Vehículo no encontrado o ya ha salido");
            }

            console.log('🔍 Datos de ocupación obtenidos:', {
                res_codigo: ocupacion.res_codigo,
                ocu_fecha_limite: ocupacion.ocu_fecha_limite,
                ocu_precio_acordado: ocupacion.ocu_precio_acordado,
                ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
                entry_time: ocupacion.entry_time
            });

            const plazaInfo = plazasCompletas.find(p => p.pla_numero === ocupacion.plaza_number);
            const esVehiculoAbonado = plazaInfo?.abono?.vehiculos?.some(
                v => v.veh_patente?.toUpperCase() === licensePlate.toUpperCase()
            ) ?? false;

            if (esVehiculoAbonado) {
                await finalizeSubscriptionExit({
                    licensePlate,
                    entryTime: ocupacion.entry_time,
                    plazaNumber: ocupacion.plaza_number,
                    resCode: ocupacion.res_codigo
                });

                const salidaMomento = dayjs().tz('America/Argentina/Buenos_Aires');
                const ingresoMomento = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires');
                const duracionMs = salidaMomento.diff(ingresoMomento);

                setExitInfo({
                    vehicle: {
                        license_plate: licensePlate,
                        type: 'Auto', // TODO: obtener el tipo real del vehículo
                        entry_time: ocupacion.entry_time,
                        plaza_number: ocupacion.plaza_number
                    },
                    fee: 0,
                    exitTime: salidaMomento.toDate(),
                    duration: formatDuration(duracionMs),
                    agreedPrice: 0,
                    calculatedFee: 0
                });

                toast({
                    title: "Egreso abonado",
                    description: `Vehículo ${licensePlate} egresó sin cargo`
                });

                await refreshParkedVehicles();
                await refreshParkingHistory();
                await fetchDashboardData('subscription-exit');
                return;
            }

            // NUEVO: Verificar si tiene reserva
            console.log('🔍 VERIFICANDO RESERVA EN EGRESO:', {
                tiene_res_codigo: !!ocupacion.res_codigo,
                res_codigo: ocupacion.res_codigo,
                ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
                ocu_precio_acordado: ocupacion.ocu_precio_acordado,
                ocu_fecha_limite: ocupacion.ocu_fecha_limite,
                tiene_fecha_limite: !!ocupacion.ocu_fecha_limite,
                es_reserva: ocupacion.ocu_duracion_tipo === 'reserva',
                condicion_cumplida: !!(ocupacion.res_codigo && ocupacion.ocu_fecha_limite),
                condicion_alternativa: !!(ocupacion.res_codigo && ocupacion.ocu_duracion_tipo === 'reserva')
            });

            let feeData;
            let hasReservation = false;
            let reservationHours = 0;
            let montoReserva = 0;

            // FIX: Detectar reserva SOLO si tiene código de reserva o es tipo 'reserva'
            // Si existe res_codigo, definitivamente ES una reserva (foreign key válida)
            // No requerimos ocu_fecha_limite porque algunos registros podrían no tenerlo
            const tieneReserva = !!(
                ocupacion.res_codigo ||
                ocupacion.ocu_duracion_tipo === 'reserva'
            );

            console.log('🎯 Evaluación de condición de reserva (mejorada):', {
                tiene_res_codigo: !!ocupacion.res_codigo,
                tiene_fecha_limite: !!ocupacion.ocu_fecha_limite,
                es_tipo_reserva: ocupacion.ocu_duracion_tipo === 'reserva',
                tiene_precio_acordado: !!ocupacion.ocu_precio_acordado && ocupacion.ocu_precio_acordado > 0,
                condicion_resultado: tieneReserva,
                datos_ocupacion: {
                    res_codigo: ocupacion.res_codigo,
                    ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
                    ocu_precio_acordado: ocupacion.ocu_precio_acordado
                }
            });
            
            if (tieneReserva) {
                console.log('✅ 🎫 RESERVA DETECTADA EN EGRESO - MOSTRANDO CONFIRMACIÓN:', {
                    res_codigo: ocupacion.res_codigo,
                    ocu_fecha_limite: ocupacion.ocu_fecha_limite,
                    ocu_precio_acordado: ocupacion.ocu_precio_acordado,
                    ocu_duracion_tipo: ocupacion.ocu_duracion_tipo
                });

                const salidaReal = dayjs().tz('America/Argentina/Buenos_Aires');
                // FIX: Parsear directamente en Argentina timezone (no como UTC que causaba -3h error)
                const finReserva = dayjs.tz(ocupacion.ocu_fecha_limite, 'America/Argentina/Buenos_Aires');
                const inicioReserva = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires');

                // Guardar datos para procesar después de confirmación
                reservationExitDataRef.current = {
                    licensePlate,
                    ocupacion,
                    salidaReal,
                    finReserva,
                    inicioReserva
                };

                // Mostrar modal de confirmación de reserva
                console.log('📋 DEBUGGING HORARIOS RESERVA:', {
                    ocu_fecha_limite_raw: ocupacion.ocu_fecha_limite,
                    finReserva_parsed: finReserva.format('YYYY-MM-DD HH:mm:ss Z'),
                    salidaReal: salidaReal.format('YYYY-MM-DD HH:mm:ss Z'),
                    salioAntes: salidaReal.isBefore(finReserva),
                    diferencia_minutos: finReserva.diff(salidaReal, 'minutes')
                });

                const salioAntes = salidaReal.isBefore(finReserva);

                // CASO 2: Si salió después de la reserva, calcular cargo y mostrar selector de pago directamente
                if (!salioAntes) {
                    console.log('💳 CASO 2 DETECTADO: Egreso después de fin de reserva - Mostrando selector de pago directamente');
                    // Llamar confirmReservationExit directamente sin mostrar modal informacional
                    // El ref ya está configurado con los datos necesarios
                    await confirmReservationExit();
                    return;
                }

                // CASO 1: Si salió antes de la reserva, mostrar modal informacional
                console.log('✅ CASO 1 DETECTADO: Egreso antes de fin de reserva - Mostrando confirmación');
                setReservationData({
                    res_codigo: ocupacion.res_codigo,
                    ocu_fecha_limite: ocupacion.ocu_fecha_limite,
                    ocu_precio_acordado: ocupacion.ocu_precio_acordado,
                    licensePlate: licensePlate,
                    exitDate: salidaReal.format('DD/MM/YYYY'),
                    exitTime: salidaReal.format('HH:mm:ss'),
                    endDate: finReserva.format('DD/MM/YYYY'),
                    endTime: finReserva.format('HH:mm:ss'),
                    salioAntes: salioAntes
                });
                setShowReservationConfirm(true);
                return;
            } else {
                // Lógica normal sin reserva
                console.log('ℹ️ NO se detectó reserva, usando lógica normal de egreso');
                
                // Aún así, si tiene res_codigo y ocu_precio_acordado, deberíamos descontar el pago previo
                if (ocupacion.res_codigo && ocupacion.ocu_precio_acordado && ocupacion.ocu_precio_acordado > 0) {
                    console.log('⚠️ ADVERTENCIA: Tiene res_codigo y ocu_precio_acordado pero no se detectó como reserva');
                    console.log('🔍 Detalles:', {
                        res_codigo: ocupacion.res_codigo,
                        ocu_precio_acordado: ocupacion.ocu_precio_acordado,
                        ocu_duracion_tipo: ocupacion.ocu_duracion_tipo,
                        ocu_fecha_limite: ocupacion.ocu_fecha_limite
                    });
                    
                    // Intentar calcular con descuento de reserva de todas formas
                    try {
                        const totalFeeData = await calculateParkingFee(
                            {
                                entry_time: ocupacion.entry_time,
                                plaza_number: ocupacion.plaza_number,
                                ocu_duracion_tipo: ocupacion.ocu_duracion_tipo || 'hora',
                                ocu_precio_acordado: 0
                            },
                            estId
                        );

                        montoReserva = ocupacion.ocu_precio_acordado;
                        const cargoConDescuento = Math.max(0, totalFeeData.fee - montoReserva);

                        console.log('💰 Aplicando descuento de reserva (modo fallback):', {
                            total_original: totalFeeData.fee,
                            monto_pagado_reserva: montoReserva,
                            cargo_con_descuento: cargoConDescuento
                        });

                        hasReservation = true;
                        reservationHours = 0; // No sabemos las horas exactas

                        feeData = {
                            ...totalFeeData,
                            fee: cargoConDescuento,
                            calculatedFee: cargoConDescuento
                        };
                    } catch (calcError) {
                        console.warn('⚠️ Error en fallback de reserva, usando tarifa base:', calcError);

                        // FALLBACK del fallback: calcular manualmente
                        const entryTime = dayjs.utc(ocupacion.entry_time);
                        const exitTime = dayjs();
                        const durationMs = exitTime.diff(entryTime);
                        const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

                        const TARIFA_BASE = 200;
                        montoReserva = ocupacion.ocu_precio_acordado || 0;
                        const totalCalculado = TARIFA_BASE * durationHours;
                        const cargoConDescuento = Math.max(0, totalCalculado - montoReserva);

                        hasReservation = true;
                        reservationHours = durationHours;

                        feeData = {
                            fee: cargoConDescuento,
                            calculatedFee: cargoConDescuento,
                            agreedPrice: 0,
                            durationMs,
                            durationUnits: durationHours,
                            plantillaId: null,
                            plantillaNombre: 'Tarifa Base (Fallback)',
                            tariffType: 'hora',
                            precioBase: TARIFA_BASE
                        };
                    }
                } else {
                    feeData = await calculateParkingFee(
                        {
                            entry_time: ocupacion.entry_time,
                            plaza_number: ocupacion.plaza_number,
                            ocu_duracion_tipo: ocupacion.ocu_duracion_tipo || 'hora',
                            ocu_precio_acordado: ocupacion.ocu_precio_acordado || 0
                        },
                        estId
                    );
                }
            }

            const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');

            // Preparar datos para el sistema de pagos
            const paymentInfo: PaymentData = {
                vehicleLicensePlate: licensePlate,
                amount: feeData.fee,
                calculatedFee: feeData.calculatedFee,
                agreedFee: feeData.agreedPrice > 0 ? feeData.agreedPrice : undefined,
                entryTime: hasReservation ? ocupacion.ocu_fecha_limite : ocupacion.entry_time,
                exitTime: exitTime.format('YYYY-MM-DD HH:mm:ss'),
                duration: feeData.durationMs,
                method: 'efectivo',
                estId: estId,
                plazaNumber: ocupacion.plaza_number,
                zone: ocupacion.plaza_number ?
                    plazasCompletas.find(p => p.pla_numero === ocupacion.plaza_number)?.pla_zona :
                    undefined,
                tariffType: feeData.tariffType, // Tipo de tarifa seleccionado al ingreso
                precioBase: feeData.precioBase, // Precio base de la tarifa
                durationUnits: feeData.durationUnits, // Unidades de tiempo cobradas
                isSubscription: false,
                subscriptionNumber: plazaInfo?.abono?.abo_nro,
                // Información de reserva si aplica
                hasReservation: hasReservation,
                reservationCode: hasReservation ? ocupacion.res_codigo : undefined,
                reservationPaidAmount: hasReservation ? montoReserva : undefined,
                reservationEndTime: hasReservation ? ocupacion.ocu_fecha_limite : undefined,
                reservationHours: hasReservation ? reservationHours : undefined,
                excessDuration: hasReservation ? feeData.durationMs : undefined
            };

            console.log('📋 RESUMEN FINAL ANTES DE MOSTRAR MODAL:', {
                hasReservation,
                reservationCode: hasReservation ? ocupacion.res_codigo : undefined,
                reservationPaidAmount: hasReservation ? montoReserva : undefined,
                amount: feeData.fee,
                calculatedFee: feeData.calculatedFee,
                paymentInfo: {
                    hasReservation: paymentInfo.hasReservation,
                    reservationCode: paymentInfo.reservationCode,
                    reservationPaidAmount: paymentInfo.reservationPaidAmount
                }
            });

            // FIX: Si es una reserva prepagada sin cargo adicional, no mostrar modal de pago
            if (hasReservation && feeData.fee === 0) {
                console.log('✅ RESERVA PREPAGADA - SIN CARGO ADICIONAL - Egreso directo sin pago');

                // Procesar egreso sin pago
                await finalizeSubscriptionExit({
                    licensePlate,
                    entryTime: ocupacion.entry_time,
                    plazaNumber: ocupacion.plaza_number,
                    resCode: ocupacion.res_codigo
                });

                const salidaMomento = dayjs().tz('America/Argentina/Buenos_Aires');
                const ingresoMomento = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires');
                const duracionMs = salidaMomento.diff(ingresoMomento);

                toast({
                    title: "✅ Egreso completado",
                    description: `Reserva prepagada (${ocupacion.res_codigo}). Sin cargo adicional.`
                });

                await refreshParkedVehicles();
                await refreshParkingHistory();
                await fetchDashboardData('exit');
                return;
            }

            setPaymentData(paymentInfo);
            setShowPaymentSelector(true);

            console.log('💰 Iniciando proceso de pago:', {
                vehicle: licensePlate,
                plaza: ocupacion.plaza_number,
                plantilla: feeData.plantillaNombre,
                tipo: feeData.tariffType,
                unidades: feeData.durationUnits,
                amount: formatCurrency(feeData.fee),
                duration: formatDuration(feeData.durationMs),
                hasReservation,
                reservationPaidAmount: montoReserva
            });

        } catch (error) {
            console.error("Error al calcular tarifa:", error);
            toast({
                variant: "destructive",
                title: "Error al calcular tarifa",
                description: error instanceof Error ? error.message : "No se pudo calcular la tarifa del vehículo"
            });
        }
    };

    // Manejar selección de método de pago
    const handlePaymentMethodSelect = async (method: PaymentMethod) => {
        console.log('🎯 handlePaymentMethodSelect llamado con método:', method);
        console.log('📦 paymentData actual:', paymentData);

        if (!paymentData) {
            console.error('❌ No hay paymentData disponible');
            return;
        }

        setSelectedPaymentMethod(method);
        setPaymentLoading(true);

        try {
            // Actualizar método en los datos de pago
            const updatedPaymentData = { ...paymentData, method };
            setPaymentData(updatedPaymentData);

            console.log(`💳 Método seleccionado: ${method}, procesando...`);

            // Procesar según el método seleccionado
            switch (method) {
                case 'efectivo':
                    console.log('➡️ Llamando a processEffectivoPago');
                    await processEffectivoPago(updatedPaymentData);
                    break;
                case 'transferencia':
                    await processTransferenciaPago(updatedPaymentData);
                    break;
                case 'qr':
                    await processQRPago(updatedPaymentData);
                    break;
                case 'link_pago':
                    await processLinkPago(updatedPaymentData);
                    break;
                default:
                    throw new Error(`Método de pago no implementado: ${method}`);
            }
        } catch (error) {
            console.error(`Error procesando pago ${method}:`, error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo procesar el método de pago seleccionado"
            });
        } finally {
            setPaymentLoading(false);
        }
    };

    // Procesar pago en efectivo (inmediato)
    const processEffectivoPago = async (data: PaymentData) => {
        console.log('💵 processEffectivoPago llamado con:', data);
        await finalizeVehicleExit(data);
        setShowPaymentSelector(false);

        toast({
            title: "Pago en efectivo",
            description: `Cobrar ${formatCurrency(data.amount)} al cliente`
        });
    };

    // Procesar pago por transferencia
    const processTransferenciaPago = async (data: PaymentData) => {
        setShowPaymentSelector(false);
        setShowTransferDialog(true);

        // TODO: Aquí iría la lógica para obtener la configuración bancaria del estacionamiento
        console.log('📄 Mostrando información de transferencia');
    };

    // Procesar pago con QR
    const processQRPago = async (data: PaymentData) => {
        try {
            console.log('📱 Generando código QR para pago...');

            // Llamar al endpoint principal de MercadoPago con paymentType: 'qr'
            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo', // o determinar del contexto
                    paymentType: 'qr',
                    userId: user?.id,
                    est_id: estId // ID del estacionamiento para obtener la API Key del dueño
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error de Mercado Pago:", errorData);
                throw new Error(errorData.error || "Error al generar el QR de Mercado Pago");
            }

            const { qr_code, init_point, id: preferenceId } = await response.json();

            if (qr_code || init_point) {
                // Preparar datos para el modal QR
                const qrDialogData = {
                    qrCode: qr_code || init_point,
                    qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_code || init_point)}`,
                    preferenceId: preferenceId
                };

                // Cerrar el selector de pagos y mostrar el modal QR
                setShowPaymentSelector(false);
                setQrData(qrDialogData);
                setShowQRDialog(true);

                // Mostrar mensaje informativo
                toast({
                    title: "Código QR generado",
                    description: "Muestre el código QR al cliente para que realice el pago"
                });
            } else {
                throw new Error("No se pudo generar el código QR");
            }

            console.log('✅ Código QR generado exitosamente:', {
                qr_code: qr_code || init_point,
                preferenceId
            });

        } catch (error) {
            console.error('❌ Error generando código QR:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el código QR. Intenta con otro método de pago."
            });

            // Mantener el selector de métodos abierto para que puedan elegir otro método
            // No cerrar nada, solo mostrar el error
        }
    };

    // Procesar pago con link
    const processLinkPago = async (data: PaymentData) => {
        setShowPaymentSelector(false);

        try {
            console.log('🔗 Generando link de pago...');

            // Llamar al endpoint principal de MercadoPago con paymentType normal (sin restricciones QR)
            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo',
                    paymentType: 'regular', // Sin restricciones para link de pago
                    userId: user?.id,
                    est_id: estId // ID del estacionamiento para obtener la API Key del dueño
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al generar el link de pago");
            }

            const { init_point } = await response.json();
            window.open(init_point, '_blank');

            console.log('✅ Link de pago generado exitosamente');

            // Mostrar diálogo de confirmación manual
            setShowLinkPagoConfirm(true);

            toast({
                title: "Link de pago enviado",
                description: "Espera la confirmación del cliente antes de registrar la salida"
            });

        } catch (error) {
            console.error('❌ Error generando link de pago:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el link de pago. Intenta con otro método."
            });

            // Volver al selector de métodos
            setShowPaymentSelector(true);
        }
    };


    // Función para procesar la salida del vehículo después del pago aprobado
    const processVehicleExitAfterPayment = async (data: PaymentData) => {
        try {
            console.log('🚗 Procesando salida del vehículo después del pago aprobado');

            // Registrar la salida del vehículo usando el endpoint correcto
            const exitResponse = await fetch(`/api/parking/${encodeURIComponent(data.vehicleLicensePlate)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!exitResponse.ok) {
                const errorData = await exitResponse.json();
                throw new Error(errorData.error || 'Error al registrar la salida del vehículo');
            }

            // Actualizar la lista de vehículos
            await refreshParkedVehicles();
            await refreshCapacity();

            console.log('✅ Salida del vehículo registrada exitosamente');

            toast({
                title: "Salida registrada",
                description: `El vehículo ${data.vehicleLicensePlate} puede salir`
            });

        } catch (error) {
            console.error('Error procesando salida del vehículo:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Hubo un problema al registrar la salida del vehículo"
            });
        }
    };

    // Actualizar estado del pago QR
    const refreshQRPaymentStatus = async () => {
        if (!qrData?.preferenceId) return;

        setPaymentLoading(true);
        try {
            const response = await fetch(`/api/payment/mercadopago/create-qr?preferenceId=${qrData.preferenceId}`);
            const result = await response.json();

            if (result.success) {
                setQRPaymentStatus(result.status);

                if (result.status === 'approved' && paymentData) {
                    toast({
                        title: "¡Pago aprobado!",
                        description: "El pago fue procesado exitosamente"
                    });

                    // CRÍTICO: Registrar el egreso del vehículo después del pago aprobado
                    setShowQRDialog(false);
                    await finalizeVehicleExit({
                        ...paymentData,
                        method: 'app' // MercadoPago QR se registra como 'app'
                    });

                    return; // Salir para no seguir verificando el estado
                } else if (result.status === 'rejected') {
                    toast({
                        variant: "destructive",
                        title: "Pago rechazado",
                        description: "Hubo un problema con el pago"
                    });
                } else if (result.status === 'expired') {
                    toast({
                        variant: "destructive",
                        title: "Pago expirado",
                        description: "El tiempo para pagar ha expirado"
                    });
                }
            }
        } catch (error) {
            console.error('Error verificando estado del pago:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo verificar el estado del pago"
            });
        } finally {
            setPaymentLoading(false);
        }
    };

    const finalizeSubscriptionExit = async ({
        licensePlate,
        entryTime,
        plazaNumber,
        resCode
    }: {
        licensePlate: string;
        entryTime: string;
        plazaNumber?: number | null;
        resCode?: string | null;
    }) => {
        if (!estId || !user?.id) return;

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const exitTimestamp = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss');

        // Si la ocupación tiene una reserva, obtener el pag_nro para vincularlo
        let pagNroReserva: number | null = null;
        if (resCode) {
            const { data: reservaData, error: reservaError } = await supabase
                .from('reservas')
                .select('pag_nro')
                .eq('res_codigo', resCode)
                .single();

            if (!reservaError && reservaData?.pag_nro) {
                pagNroReserva = reservaData.pag_nro;
                console.log(`💰 Pag_nro de reserva ${resCode}: ${pagNroReserva}`);
            }
        }

        const { error: updateError } = await supabase
            .from('ocupacion')
            .update({
                ocu_fh_salida: exitTimestamp,
                ...(pagNroReserva && { pag_nro: pagNroReserva })  // Incluir pag_nro si existe
            })
            .eq('est_id', estId)
            .eq('veh_patente', licensePlate)
            .eq('ocu_fh_entrada', entryTime)
            .is('ocu_fh_salida', null);

        if (updateError) {
            throw updateError;
        }

        // Si la ocupación tiene una reserva, marcarla como completada
        if (resCode) {
            console.log(`📌 Actualizando estado de reserva ${resCode} a completada`);
            const { error: resError } = await supabase
                .from('reservas')
                .update({ res_estado: 'completada' })
                .eq('res_codigo', resCode);

            if (resError) {
                console.error(`Error actualizando reserva ${resCode}:`, resError);
            } else {
                console.log(`✅ Reserva ${resCode} marcada como completada`);
            }
        }

        if (plazaNumber) {
            const { error: plazaUpdateError } = await supabase
                .from('plazas')
                .update({ pla_estado: 'Libre' })
                .eq('pla_numero', plazaNumber)
                .eq('est_id', estId);

            if (plazaUpdateError) {
                console.warn('Error liberando plaza:', plazaUpdateError);
            }
        }
    };

    // Procesar salida después de confirmación de reserva
    const confirmReservationExit = async () => {
        if (!reservationExitDataRef.current) return;

        const { licensePlate, ocupacion, salidaReal, finReserva, inicioReserva } = reservationExitDataRef.current;

        try {
            if (salidaReal.isAfter(finReserva)) {
                console.log('⏰ El vehículo salió después del fin de reserva, calculando cargo adicional...');

                // FIX BUG #2: Agregar try-catch para manejar error cuando plaza sin plantilla
                let totalFeeData;
                try {
                    // Calcular el total por TODO el tiempo estacionado (desde ingreso hasta salida)
                    totalFeeData = await calculateParkingFee(
                        {
                            entry_time: ocupacion.entry_time, // Desde el inicio de la reserva
                            plaza_number: ocupacion.plaza_number,
                            ocu_duracion_tipo: 'hora',
                            ocu_precio_acordado: 0
                        },
                        estId
                    );
                } catch (calcError) {
                    console.warn('⚠️ Error calculando con plantilla, usando tarifa base:', calcError);

                    // FALLBACK: Calcular manualmente con tarifa base
                    const entryTime = dayjs.utc(ocupacion.entry_time);
                    const exitTime = dayjs();
                    const durationMs = exitTime.diff(entryTime);
                    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

                    const TARIFA_BASE = 200; // TODO: Cargar desde configuración
                    const totalCalculado = TARIFA_BASE * durationHours;

                    totalFeeData = {
                        fee: totalCalculado,
                        calculatedFee: totalCalculado,
                        agreedPrice: 0,
                        durationMs,
                        durationUnits: durationHours,
                        plantillaId: null,
                        plantillaNombre: 'Tarifa Base (Fallback)',
                        tariffType: 'hora',
                        precioBase: TARIFA_BASE
                    };
                }

                console.log('💰 Total calculado por tiempo completo:', {
                    total: totalFeeData.fee,
                    calculatedFee: totalFeeData.calculatedFee
                });

                // Obtener el monto pagado de la reserva
                const montoReserva = ocupacion.ocu_precio_acordado || 0;

                console.log('🎫 Monto pagado por la reserva:', {
                    monto_reserva: montoReserva,
                    ocu_precio_acordado: ocupacion.ocu_precio_acordado
                });

                // Descontar el monto pagado de la reserva del total
                const cargoAdicional = Math.max(0, totalFeeData.fee - montoReserva);

                console.log('💰 CALCULO DE DESCUENTO DE RESERVA:', {
                    total_original: totalFeeData.fee,
                    monto_pagado_reserva: montoReserva,
                    cargo_adicional: cargoAdicional,
                    descuento_aplicado: montoReserva,
                    resultado: cargoAdicional === 0 ? '✅ Sin cargo adicional (ya pagó todo)' : `✅ Restante a cobrar: $${cargoAdicional}`
                });

                // Preparar datos para el sistema de pagos
                const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');
                const paymentInfo: PaymentData = {
                    vehicleLicensePlate: licensePlate,
                    amount: cargoAdicional,
                    calculatedFee: totalFeeData.fee,
                    agreedFee: totalFeeData.agreedPrice > 0 ? totalFeeData.agreedPrice : undefined,
                    entryTime: ocupacion.entry_time,
                    exitTime: exitTime.format('YYYY-MM-DD HH:mm:ss'),
                    duration: totalFeeData.durationMs,
                    method: 'efectivo',
                    estId: estId,
                    plazaNumber: ocupacion.plaza_number,
                    zone: ocupacion.plaza_number ?
                        plazasCompletas.find(p => p.pla_numero === ocupacion.plaza_number)?.pla_zona :
                        undefined,
                    tariffType: totalFeeData.tariffType,
                    precioBase: totalFeeData.precioBase,
                    durationUnits: totalFeeData.durationUnits,
                    isSubscription: false,
                    subscriptionNumber: undefined,
                    hasReservation: true,
                    reservationCode: ocupacion.res_codigo,
                    reservationPaidAmount: montoReserva,
                    reservationEndTime: ocupacion.ocu_fecha_limite,
                    reservationHours: finReserva.diff(inicioReserva, 'hours', true),
                    excessDuration: totalFeeData.durationMs
                };

                setPaymentData(paymentInfo);
                setShowPaymentSelector(true);

                console.log('💰 Iniciando proceso de pago (reserva con cargo adicional):', {
                    vehicle: licensePlate,
                    plaza: ocupacion.plaza_number,
                    amount: formatCurrency(cargoAdicional),
                    hasReservation: true
                });
            } else {
                // Salió antes: sin cargo adicional
                console.log('✅ Salió antes del fin de reserva, sin cargo adicional');

                // FIX BUG #1: Usar finalizeSubscriptionExit en vez de finalizeVehicleExit
                // No registrar pago para reservas prepagadas
                await finalizeSubscriptionExit({
                    licensePlate,
                    entryTime: ocupacion.entry_time,
                    plazaNumber: ocupacion.plaza_number,
                    resCode: ocupacion.res_codigo
                });

                const salidaMomento = dayjs().tz('America/Argentina/Buenos_Aires');
                const ingresoMomento = dayjs.tz(ocupacion.entry_time, 'America/Argentina/Buenos_Aires');
                const duracionMs = salidaMomento.diff(ingresoMomento);

                setExitInfo({
                    vehicle: {
                        license_plate: licensePlate,
                        type: 'Auto',
                        entry_time: ocupacion.entry_time,
                        plaza_number: ocupacion.plaza_number
                    },
                    fee: 0,
                    exitTime: salidaMomento.toDate(),
                    duration: formatDuration(duracionMs),
                    agreedPrice: 0,
                    calculatedFee: 0
                });

                toast({
                    title: "Egreso completado",
                    description: `Reserva prepagada. Sin cargo adicional.`
                });

                await refreshParkedVehicles();
                await refreshParkingHistory();
                await fetchDashboardData('exit');
            }
        } catch (error) {
            console.error("Error procesando salida de reserva:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo procesar la salida de la reserva"
            });
        }

        // Limpiar ref
        reservationExitDataRef.current = null;
    };

    // Finalizar salida del vehículo (actualizar DB)
    const finalizeVehicleExit = async (data: PaymentData) => {
        if (!estId || !user?.id) return;

        console.log('🚀 finalizeVehicleExit llamado con:', {
            vehicleLicensePlate: data.vehicleLicensePlate,
            method: data.method,
            amount: data.amount,
            estId: estId,
            userId: user?.id
        });

        try {
            if (data.isSubscription) {
                console.log('📦 Es vehículo de abono, procesando salida sin pago');
                await finalizeSubscriptionExit({
                    licensePlate: data.vehicleLicensePlate,
                    entryTime: data.entryTime,
                    plazaNumber: data.plazaNumber,
                    resCode: data.reservationCode
                });
                return;
            }

            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // 1. Registrar el pago en la tabla pagos
            const normalizedMethod = data.method === 'efectivo' ? 'Efectivo' :
                data.method === 'tarjeta' ? 'Tarjeta' :
                    data.method === 'app' ? 'MercadoPago' :
                        data.method === 'transferencia' ? 'Transferencia' : 'Efectivo';

            console.log('💰 Registrando pago:', {
                metodoOriginal: data.method,
                metodoNormalizado: normalizedMethod,
                monto: data.amount,
                vehiculo: data.vehicleLicensePlate
            });

            const { data: payment, error: paymentError } = await supabase
                .from('pagos')
                .insert([{
                    pag_monto: data.amount,
                    pag_h_fh: dayjs().tz('America/Argentina/Buenos_Aires').toISOString(),
                    est_id: estId,
                    mepa_metodo: normalizedMethod,
                    veh_patente: data.vehicleLicensePlate,
                }])
                .select()
                .single();

            if (paymentError) {
                console.error('Error registrando pago:', paymentError);
                throw new Error(`Error al registrar el pago: ${paymentError.message}`);
            }

            console.log('✅ Pago registrado:', payment);

            // 2. Actualizar la ocupación marcando la salida y enlazando el pago
            const { data: updateResult, error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: data.exitTime,
                    pag_nro: payment.pag_nro
                })
                .eq('est_id', estId)
                .eq('veh_patente', data.vehicleLicensePlate)
                .eq('ocu_fh_entrada', data.entryTime)
                .is('ocu_fh_salida', null)
                .select();

            if (updateError) {
                console.error('❌ Error actualizando ocupación:', updateError);
                throw updateError;
            }

            // Validar que se actualizó al menos una fila
            if (!updateResult || updateResult.length === 0) {
                console.error('❌ No se encontró la ocupación para actualizar:', {
                    est_id: estId,
                    veh_patente: data.vehicleLicensePlate,
                    ocu_fh_entrada_buscada: data.entryTime,
                    hasReservation: data.hasReservation
                });
                throw new Error(`No se encontró la ocupación para actualizar. Verificar ocu_fh_entrada: ${data.entryTime}`);
            }

            console.log('✅ Ocupación actualizada - pag_nro vinculado:', payment.pag_nro);
            console.log('✅ Filas actualizadas:', updateResult.length);

            // Si la ocupación tiene una reserva, marcarla como completada
            if (data.reservationCode) {
                console.log(`📌 Actualizando estado de reserva ${data.reservationCode} a completada`);
                const { error: resError } = await supabase
                    .from('reservas')
                    .update({ res_estado: 'completada' })
                    .eq('res_codigo', data.reservationCode);

                if (resError) {
                    console.error(`Error actualizando reserva ${data.reservationCode}:`, resError);
                } else {
                    console.log(`✅ Reserva ${data.reservationCode} marcada como completada`);
                }
            }

            // Si había una plaza asignada, liberarla
            if (data.plazaNumber) {
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Libre' })
                    .eq('pla_numero', data.plazaNumber)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error liberando plaza:', plazaUpdateError);
                }
            }

            // Actualizar datos en la UI
            await refreshParkedVehicles();
            await refreshParkingHistory();
            await fetchDashboardData('register-exit');

            // Mostrar información de salida
            setExitInfo({
                vehicle: {
                    license_plate: data.vehicleLicensePlate,
                    type: 'Auto', // TODO: obtener tipo real del vehículo
                    entry_time: data.entryTime,
                    plaza_number: data.plazaNumber
                },
                fee: data.amount,
                exitTime: new Date(data.exitTime),
                duration: formatDuration(data.duration),
                agreedPrice: data.agreedFee,
                calculatedFee: data.calculatedFee
            });

            console.log('✅ Salida del vehículo finalizada:', {
                vehicle: data.vehicleLicensePlate,
                method: data.method,
                amount: formatCurrency(data.amount)
            });

        } catch (error) {
            console.error("Error finalizando salida:", error);
            throw error;
        }
    };

    // Cerrar modales de pago
    const closePaymentModals = () => {
        setShowPaymentSelector(false);
        setShowTransferDialog(false);
        setShowQRDialog(false);
        setShowReservationConfirm(false);
        setPaymentData(null);
        setSelectedPaymentMethod(null);
        setPaymentLoading(false);
        setQrData(null);
        setQRPaymentStatus('pending');
        setReservationData(null);
        reservationExitDataRef.current = null;
    };

    // Funciones auxiliares para visualización de plazas
    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Libre': return 'bg-green-500';
            case 'Ocupada': return 'bg-red-500';
            case 'Reservada': return 'bg-yellow-500';
            case 'Abonado': return 'bg-violet-500';
            case 'Mantenimiento': return 'bg-gray-500';
            default: return 'bg-gray-400';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'Libre': return '🟢';
            case 'Ocupada': return '🔴';
            case 'Reservada': return '🟡';
            case 'Abonado': return '🟠';
            case 'Mantenimiento': return '⚫';
            default: return '❓';
        }
    };


    // Función para configurar zonas (redirige al panel de administrador)
    const handleConfigureZones = () => {
        toast({
            title: "Configurar Zonas",
            description: "Ve al Panel de Administrador para configurar las zonas del estacionamiento"
        });
        // Redirigir al panel de administrador
        router.push('/dashboard/panel-administrador');
    };

    // Estado de carga general: mientras se cargan datos críticos
    if (loading || roleLoading || !user || (estId && (!parkedVehicles && !parkingCapacity))) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                                    <p className="text-gray-600">Cargando panel de operador...</p>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    // Si no hay estId después de cargar, mostrar mensaje apropiado según el rol
    if (!estId) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="p-6">
                            <div className="text-center py-12">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                                <p className="text-gray-600 mb-6">
                                    {canOperateParking ?
                                        "Selecciona un estacionamiento para acceder al panel de operador" :
                                        "No tienes acceso a estacionamientos disponibles"
                                    }
                                </p>
                                {canOperateParking && (
                                    <button
                                        onClick={() => router.push('/dashboard/parking')}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Ir a Mis Estacionamientos
                                    </button>
                                )}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    if (!parking) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="p-6">
                            <div className="text-center py-12">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                                <p className="text-gray-600 mb-6">
                                    Cargando datos del estacionamiento...
                                </p>
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    // Función para verificar manualmente reservas expiradas
    const checkExpiredReservations = async () => {
        try {
            console.log('🔄 [CLIENTE] Verificando reservas expiradas...');
            const response = await fetch('/api/reservas/expirar', {
                method: 'GET'
            });

            const data = await response.json();
            console.log('📊 [CLIENTE] Respuesta del servidor:', data);
            console.log(`📋 [CLIENTE] Status: ${response.status}, Reservas expiradas: ${data.reservas_expiradas}`);

            if (response.ok) {
                console.log(`✅ [CLIENTE] Verificación exitosa. Se procesaron ${data.reservas_expiradas} reservas`);
                const mensaje = data.reservas_expiradas > 0
                    ? `Se liberaron ${data.reservas_expiradas} plazas reservadas que expiraron`
                    : `No hay reservas expiradas en este momento`;
                toast({
                    title: "✅ Verificación completada",
                    description: mensaje
                });

                // Refrescar los datos de vehículos y plazas para mostrar cambios
                console.log('🔄 [CLIENTE] Refrescando datos...');
                await refreshParkedVehicles();
                await refreshCapacity();
                console.log('✅ [CLIENTE] Datos refrescados');
            } else {
                console.error('❌ [CLIENTE] Error en respuesta:', data.error);
                toast({
                    variant: "destructive",
                    title: "❌ Error",
                    description: data.error || "Error al verificar reservas"
                });
            }
        } catch (error) {
            console.error('❌ [CLIENTE] Error de conexión:', error);
            toast({
                variant: "destructive",
                title: "❌ Error",
                description: "No se pudo conectar con el servidor"
            });
        }
    };

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="min-h-screen bg-white">
                        <div className="p-6 space-y-6">
                            {/* Botón para verificar reservas expiradas */}
                            <div className="flex justify-end">
                                <Button
                                    onClick={checkExpiredReservations}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    🔄 Verificar Reservas Expiradas
                                </Button>
                            </div>

                            <TurnoGuard showAlert={true} redirectButton={true}>

                                <OperatorPanel
                                    parking={parking}
                                    availableSpaces={getAvailableSpaces()}
                                    onRegisterEntry={registerEntry}
                                    onRegisterExit={handleExit}
                                    exitInfo={exitInfo}
                                    setExitInfo={setExitInfo}
                                    plazasData={plazasData}
                                    loadingPlazas={loadingPlazas}
                                    fetchPlazasStatus={fetchDashboardData}
                                    onConfigureZones={role === 'owner' ? handleConfigureZones : undefined}
                                    // Nuevas props para visualización rica
                                    plazasCompletas={plazasCompletas}
                                    loadingPlazasCompletas={loadingPlazasCompletas}
                                    getEstadoColor={getEstadoColor}
                                    getEstadoIcon={getEstadoIcon}
                                    refreshParkedVehicles={refreshParkedVehicles}
                                />
                            </TurnoGuard>
                        </div>
                    </div>

                    {/* Modales del sistema de pagos */}
                    <PaymentMethodSelector
                        isOpen={showPaymentSelector}
                        onClose={closePaymentModals}
                        onSelectMethod={handlePaymentMethodSelect}
                        paymentData={paymentData}
                        loading={paymentLoading}
                        paymentSettings={paymentSettings}
                    />


                    <TransferInfoDialog
                        isOpen={showTransferDialog}
                        onClose={closePaymentModals}
                        onConfirmTransfer={async () => {
                            if (!paymentData) return;

                            setPaymentLoading(true);
                            try {
                                // Log para auditoría del operador confirmando transferencia
                                console.log('💰 Operador confirmó recepción de transferencia:', {
                                    vehicle: paymentData.vehicleLicensePlate,
                                    amount: formatCurrency(paymentData.amount),
                                    operator: user?.email
                                });

                                toast({
                                    title: "Transferencia confirmada",
                                    description: `Pago de ${formatCurrency(paymentData.amount)} confirmado por el operador`
                                });

                                // Finalizar salida del vehículo
                                await finalizeVehicleExit(paymentData);
                                closePaymentModals();
                            } catch (error) {
                                console.error('Error confirmando transferencia:', error);
                                toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "No se pudo confirmar la transferencia"
                                });
                            } finally {
                                setPaymentLoading(false);
                            }
                        }}
                        paymentData={{
                            amount: paymentData?.amount || 0,
                            vehicleLicensePlate: paymentData?.vehicleLicensePlate || '',
                            paymentId: generatePaymentId(),
                            duration: paymentData ? formatDuration(paymentData.duration) : ''
                        }}
                        transferConfig={{
                            cbu: '0170020510000001234567', // TODO: Obtener de configuración
                            alias: 'PARKING.EJEMPLO',
                            accountHolder: 'Estacionamiento Ejemplo S.A.',
                            bank: 'Banco Ejemplo'
                        }}
                        loading={paymentLoading}
                    />

                    <QRPaymentDialog
                        isOpen={showQRDialog}
                        onClose={closePaymentModals}
                        onPaymentComplete={async () => {
                            // Procesar la salida del vehículo cuando se confirma el pago manualmente
                            if (paymentData) {
                                await processVehicleExitAfterPayment(paymentData);
                                toast({
                                    title: "Pago confirmado",
                                    description: "El vehículo puede salir"
                                });
                            }
                            setShowQRDialog(false);
                            setShowPaymentSelector(false);
                        }}
                        paymentData={{
                            amount: paymentData?.amount || 0,
                            vehicleLicensePlate: paymentData?.vehicleLicensePlate || '',
                            paymentId: qrData?.preferenceId || generatePaymentId(),
                            duration: paymentData ? formatDuration(paymentData.duration) : '',
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos
                        }}
                        qrData={qrData || {
                            qrCode: '',
                            qrCodeImage: '',
                            preferenceId: ''
                        }}
                        paymentStatus={qrPaymentStatus}
                        loading={paymentLoading}
                    />

                    {/* Diálogo de confirmación de Link de Pago */}
                    {showLinkPagoConfirm && paymentData && (
                        <Dialog open={showLinkPagoConfirm} onOpenChange={setShowLinkPagoConfirm}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirmar Pago con Link de Pago</DialogTitle>
                                    <DialogDescription>
                                        Se envió un link de pago de ${formatCurrency(paymentData.amount)} para el vehículo {paymentData.vehicleLicensePlate}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <p className="text-sm text-muted-foreground">
                                        ¿El cliente confirmó que realizó el pago exitosamente?
                                    </p>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowLinkPagoConfirm(false);
                                            toast({
                                                title: "Pago cancelado",
                                                description: "El egreso no fue registrado"
                                            });
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            setShowLinkPagoConfirm(false);
                                            await finalizeVehicleExit({
                                                ...paymentData,
                                                method: 'app' // Link de pago se registra como 'app' (MercadoPago)
                                            });
                                            toast({
                                                title: "Pago confirmado",
                                                description: "El vehículo puede salir"
                                            });
                                        }}
                                    >
                                        Confirmar Pago
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {/* Diálogo de confirmación de reserva */}
                    {showReservationConfirm && reservationData && (
                        <Dialog open={showReservationConfirm} onOpenChange={setShowReservationConfirm}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Confirmación de Egreso con Reserva</DialogTitle>
                                    <DialogDescription>
                                        Este vehículo tiene una reserva activa
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Patente</p>
                                            <p className="font-semibold">{reservationData.licensePlate}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Código Reserva</p>
                                            <p className="font-semibold">{reservationData.res_codigo}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Fecha de Salida</p>
                                            <p className="font-semibold">{reservationData.exitDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Hora de Salida</p>
                                            <p className="font-semibold">{reservationData.exitTime}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Fin de Reserva</p>
                                            <p className="font-semibold">{reservationData.endDate} {reservationData.endTime}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Monto Pagado</p>
                                            <p className="font-semibold">${formatCurrency(reservationData.ocu_precio_acordado || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        {reservationData.salioAntes ? (
                                            <p className="text-sm text-blue-800">
                                                ✅ El vehículo salió <strong>antes del fin de reserva</strong>. No hay cargo adicional.
                                            </p>
                                        ) : (
                                            <p className="text-sm text-blue-800">
                                                ⏰ El vehículo salió <strong>después del fin de reserva</strong>. Se cobrará un cargo adicional.
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowReservationConfirm(false);
                                            reservationExitDataRef.current = null;
                                            toast({
                                                title: "Egreso cancelado",
                                                description: "El egreso no fue registrado"
                                            });
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={confirmReservationExit}
                                    >
                                        Confirmar Egreso
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                </main>
            </div>
        </div>
    );
}
