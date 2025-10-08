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
    const [rates, setRates] = useState<any>(null);
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
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [qrPaymentStatus, setQRPaymentStatus] = useState<PaymentStatus>('pendiente');
    const [qrData, setQrData] = useState<{ qrCode: string, qrCodeImage: string, preferenceId: string } | null>(null);

    // Configuración de métodos de pago
    const [paymentSettings, setPaymentSettings] = useState<any>(null);

    // Inicializar datos del parking
    useEffect(() => {
        if (parkedVehicles !== null && parkingCapacity && estId) {
            setParking({
                capacity: parkingCapacity,
                parkedVehicles: parkedVehicles,
                rates: rates || {},
                history: [] // Se puede cargar después si es necesario
            });
        }
    }, [parkedVehicles, parkingCapacity, estId, rates]);

    // Cargar tarifas con debounce
    useEffect(() => {
        if (!estId) {
            console.log('⚠️ No hay estId, no se pueden cargar tarifas');
            return;
        }

        console.log(`💰 Cargando tarifas para estId: ${estId}`);

        const timeoutId = setTimeout(() => {
            const loadRates = async () => {
                try {
                    const supabase = createBrowserClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                    );

                    const { data, error } = await supabase
                        .from('tarifas')
                        .select('*')
                        .eq('est_id', estId);

                    if (error) throw error;

                    console.log(`✅ Tarifas cargadas (${data?.length || 0} tarifas):`, data);
                    setRates(data || []);
                } catch (error) {
                    console.error("❌ Error al cargar tarifas:", error);
                }
            };

            loadRates();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [estId]);

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

            // Mapeo de tipos de vehículo del frontend a códigos de BD
            const vehicleTypeMapping = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            const dbVehicleType = vehicleTypeMapping[vehicleData.type as keyof typeof vehicleTypeMapping] || 'AUT';

            // Verificar si el vehículo ya existe, si no, crearlo
            const { data: existingVehicle, error: vehicleCheckError } = await supabase
                .from('vehiculos')
                .select('veh_patente')
                .eq('veh_patente', vehicleData.license_plate)
                .single();

            if (vehicleCheckError && vehicleCheckError.code !== 'PGRST116') { // PGRST116 es "not found"
                throw vehicleCheckError;
            }

            // Si el vehículo no existe, crearlo
            if (!existingVehicle) {
                const { error: createVehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: vehicleData.license_plate,
                        catv_segmento: dbVehicleType
                    });

                if (createVehicleError) throw createVehicleError;
            }

            // Calcular fecha límite basada en duración seleccionada
            let fechaLimite: Date | null = null;
            if (vehicleData.duracion_tipo && vehicleData.duracion_tipo !== 'hora') {
                const now = new Date();
                switch (vehicleData.duracion_tipo) {
                    case 'dia':
                        fechaLimite = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // +1 día
                        break;
                    case 'semana':
                        fechaLimite = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // +7 días
                        break;
                    case 'mes':
                        fechaLimite = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // +30 días (aproximado)
                        break;
                }
            }

            // Registrar la ocupación
            const entryTime = dayjs().tz('America/Argentina/Buenos_Aires').toISOString();

            const ocupacionData = {
                est_id: estId,
                veh_patente: vehicleData.license_plate,
                ocu_fh_entrada: entryTime,
                pla_numero: vehicleData.pla_numero || null, // Asegurar null explícito si no hay plaza
                ocu_duracion_tipo: vehicleData.duracion_tipo || 'hora',
                ocu_precio_acordado: vehicleData.precio_acordado || 0,
                ocu_fecha_limite: fechaLimite ? fechaLimite.toISOString() : null
            };

            console.log('📝 Registrando ocupación con datos:', ocupacionData);
            console.log('📝 Tipo de pla_numero:', typeof vehicleData.pla_numero, 'Valor:', vehicleData.pla_numero);

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

            // Si se asignó una plaza específica, actualizarla como ocupada
            if (vehicleData.pla_numero) {
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Ocupada' })
                    .eq('pla_numero', vehicleData.pla_numero)
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
                description: `${vehicleData.license_plate} ha sido registrado exitosamente`
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

            // Buscar la ocupación activa del vehículo usando la vista
            const { data: ocupacion, error: ocupacionError } = await supabase
                .from('vw_ocupacion_actual')
                .select('*')
                .eq('license_plate', licensePlate)
                .eq('est_id', estId)
                .single();

            if (ocupacionError || !ocupacion) {
                throw new Error("Vehículo no encontrado o ya ha salido");
            }

            // Calcular tarifa
            const entryTime = dayjs.utc(ocupacion.entry_time).local();
            const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');
            const durationMs = exitTime.diff(entryTime);
            const durationHours = durationMs / (1000 * 60 * 60);

            // Calcular tarifa basada en las tarifas configuradas
            let fee = 0;
            let calculatedFee = 0; // Tarifa calculada por tiempo real
            let agreedPrice = ocupacion.ocu_precio_acordado || 0; // Precio acordado mínimo

            if (rates && rates.length > 0) {
                // Determinar el tipo de tarifa basado en la duración acordada
                let tiptar = 1; // Por defecto hora
                if (ocupacion.ocu_duracion_tipo === 'dia') {
                    tiptar = 2; // Diaria
                } else if (ocupacion.ocu_duracion_tipo === 'mes') {
                    tiptar = 3; // Mensual
                } else if (ocupacion.ocu_duracion_tipo === 'semana') {
                    tiptar = 4; // Semanal
                }

                let vehicleRate = null;

                // Obtener información de la plaza para determinar la plantilla
                let plazaPlantillaId = null;
                if (ocupacion.plaza_number) {
                    try {
                        const { data: plazaData, error: plazaError } = await supabase
                            .from('plazas')
                            .select('plantilla_id')
                            .eq('pla_numero', ocupacion.plaza_number)
                            .eq('est_id', estId)
                            .single();

                        if (!plazaError && plazaData?.plantilla_id) {
                            plazaPlantillaId = plazaData.plantilla_id;
                        }
                    } catch (error) {
                        console.warn('Error obteniendo plantilla de plaza:', error);
                    }
                }

                // Primero intentar buscar por plantilla_id de la plaza (si existe)
                if (plazaPlantillaId) {
                    vehicleRate = rates.find((r: any) => {
                        return r.plantilla_id === plazaPlantillaId && r.tiptar_nro === tiptar;
                    });
                }

                // Si no se encontró por plantilla, buscar por catv_segmento (fallback)
                if (!vehicleRate) {
                    vehicleRate = rates.find((r: any) => {
                        const rateSegmento = r.catv_segmento;
                        const rateTipo = r.tiptar_nro;
                        return rateSegmento === ocupacion.type && rateTipo === tiptar;
                    });
                }

                if (vehicleRate) {
                    const basePrice = parseFloat(vehicleRate.tar_precio) || 0;
                    const hourlyRate = parseFloat(vehicleRate.tar_fraccion) || 0;

                    // Lógica de cálculo según el tipo de tarifa
                    if (tiptar === 1) { // HORA: calcular dinámicamente
                        // Mínimo 1 hora
                        const hoursToCharge = Math.max(1, Math.ceil(durationHours));
                        if (hoursToCharge <= 1) {
                            calculatedFee = basePrice;
                        } else {
                            calculatedFee = basePrice + (hourlyRate * (hoursToCharge - 1));
                        }
                    } else if (tiptar === 2) { // DÍA
                        // Mínimo 1 día
                        const durationDays = Math.max(1, Math.ceil(durationHours / 24));
                        calculatedFee = basePrice * durationDays;
                    } else if (tiptar === 4) { // SEMANA
                        // Mínimo 1 semana
                        const durationWeeks = Math.max(1, Math.ceil(durationHours / (24 * 7)));
                        calculatedFee = basePrice * durationWeeks;
                    } else if (tiptar === 3) { // MES
                        // Mínimo 1 mes
                        const durationMonths = Math.max(1, Math.ceil(durationHours / (24 * 30))); // 30 días por mes
                        calculatedFee = basePrice * durationMonths;
                    } else {
                        // Fallback: usar precio base
                        calculatedFee = basePrice;
                    }

                    // Usar el máximo entre la tarifa calculada y el precio acordado
                    fee = Math.max(calculatedFee, agreedPrice);

                    console.log('💰 Cálculo de tarifa handleExit:', {
                        vehicleRate,
                        basePrice,
                        hourlyRate,
                        durationHours,
                        tiptar,
                        tipoTarifa: tiptar === 1 ? 'HORA' : tiptar === 2 ? 'DÍA' : tiptar === 3 ? 'MES' : tiptar === 4 ? 'SEMANA' : 'OTRO',
                        unidadesCalculadas: tiptar === 1 ? Math.max(1, Math.ceil(durationHours)) :
                            tiptar === 2 ? Math.max(1, Math.ceil(durationHours / 24)) :
                                tiptar === 3 ? Math.max(1, Math.ceil(durationHours / (24 * 30))) :
                                    tiptar === 4 ? Math.max(1, Math.ceil(durationHours / (24 * 7))) : 0,
                        calculatedFee,
                        agreedPrice,
                        fee,
                        plazaPlantillaId
                    });
                } else {
                    console.warn('⚠️ No se encontró tarifa para:', {
                        plazaPlantillaId,
                        tipoVehiculo: ocupacion.type,
                        tiptar,
                        ratesDisponibles: rates?.length || 0
                    });
                }
            }

            // 🟢 SOLUCIÓN: Si después de todo el fee es 0, usar precio acordado o mínimo
            if (fee === 0) {
                if (agreedPrice > 0) {
                    fee = agreedPrice;
                    console.log('✅ Usando precio acordado como fallback:', agreedPrice);
                } else {
                    // Si no hay precio acordado ni tarifa, advertir pero permitir continuar
                    console.warn('⚠️ ADVERTENCIA: No hay tarifa configurada ni precio acordado. Fee = 0');
                }
            }

            // Preparar datos para el sistema de pagos
            const paymentInfo: PaymentData = {
                vehicleLicensePlate: licensePlate,
                amount: fee,
                calculatedFee: calculatedFee,
                agreedFee: agreedPrice > 0 ? agreedPrice : undefined,
                entryTime: ocupacion.entry_time,
                exitTime: exitTime.toISOString(),
                duration: durationMs,
                method: 'efectivo', // Se actualizará cuando el usuario seleccione
                estId: estId,
                plazaNumber: ocupacion.plaza_number,
                zone: ocupacion.plaza_number ?
                    plazasCompletas.find(p => p.pla_numero === ocupacion.plaza_number)?.pla_zona :
                    undefined
            };

            setPaymentData(paymentInfo);
            setShowPaymentSelector(true);

            console.log('💰 Iniciando proceso de pago:', {
                vehicle: licensePlate,
                amount: formatCurrency(fee),
                duration: formatDuration(durationMs)
            });

        } catch (error) {
            console.error("Error al iniciar proceso de pago:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo calcular la tarifa del vehículo"
            });
        }
    };

    // Manejar selección de método de pago
    const handlePaymentMethodSelect = async (method: PaymentMethod) => {
        if (!paymentData) return;

        setSelectedPaymentMethod(method);
        setPaymentLoading(true);

        try {
            // Actualizar método en los datos de pago
            const updatedPaymentData = { ...paymentData, method };
            setPaymentData(updatedPaymentData);

            console.log(`💳 Método seleccionado: ${method}`);

            // Procesar según el método seleccionado
            switch (method) {
                case 'efectivo':
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
                    userId: user?.id
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
                    userId: user?.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al generar el link de pago");
            }

            const { init_point } = await response.json();
            window.open(init_point, '_blank');

            console.log('✅ Link de pago generado exitosamente');

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

                if (result.status === 'approved') {
                    toast({
                        title: "¡Pago aprobado!",
                        description: "El pago fue procesado exitosamente"
                    });
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

    // Finalizar salida del vehículo (actualizar DB)
    const finalizeVehicleExit = async (data: PaymentData) => {
        if (!estId || !user?.id) return;

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // 1. Registrar el pago en la tabla pagos
            const normalizedMethod = data.method === 'efectivo' ? 'Efectivo' :
                data.method === 'tarjeta' ? 'Tarjeta' :
                    data.method === 'app' ? 'MercadoPago' :
                        data.method === 'transferencia' ? 'Transferencia' : 'Efectivo';

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
            const { error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: data.exitTime,
                    pag_nro: payment.pag_nro
                })
                .eq('est_id', estId)
                .eq('veh_patente', data.vehicleLicensePlate)
                .eq('ocu_fh_entrada', data.entryTime)
                .is('ocu_fh_salida', null);

            if (updateError) throw updateError;

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
        setPaymentData(null);
        setSelectedPaymentMethod(null);
        setPaymentLoading(false);
        setQrData(null);
        setQRPaymentStatus('pending');
    };

    // Funciones auxiliares para visualización de plazas
    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Libre': return 'bg-green-500';
            case 'Ocupada': return 'bg-red-500';
            case 'Reservada': return 'bg-yellow-500';
            case 'Mantenimiento': return 'bg-gray-500';
            default: return 'bg-gray-400';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'Libre': return '🟢';
            case 'Ocupada': return '🔴';
            case 'Reservada': return '🟡';
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

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="min-h-screen bg-white">
                        <div className="p-6 space-y-6">
                            {/* Panel de Operador Original */}
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
                </main>
            </div>
        </div>
    );
}
