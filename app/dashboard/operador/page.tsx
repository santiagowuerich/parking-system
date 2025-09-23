"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import IngresoModal from "@/components/ingreso-modal";
import VehicleSelectorModal from "@/components/vehicle-selector-modal";
import { toast } from "@/components/ui/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import type { VehicleType, VehicleEntryData, Vehicle, PaymentMethod, PaymentData } from "@/lib/types";
import type { PaymentStatus } from "@/lib/types/payment";
import PaymentMethodSelector from "@/components/payment-method-selector";
import TransferInfoDialog from "@/components/transfer-info-dialog";
import QRPaymentDialog from "@/components/qr-payment-dialog";
import { generatePaymentId, formatCurrency } from "@/lib/utils/payment-utils";
import { formatDuration } from "@/lib/utils";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function OperadorPage() {
    const { user, estId, parkedVehicles, parkingCapacity, fetchUserData, refreshParkedVehicles, refreshCapacity } = useAuth();
    const { canOperateParking, loading: roleLoading } = useUserRole();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ingreso');

    // Estados para los modales
    const [showIngresoModal, setShowIngresoModal] = useState(false);
    const [showVehicleSelectorModal, setShowVehicleSelectorModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [availableTariffs, setAvailableTariffs] = useState<any[]>([]);
    const [availablePlazas, setAvailablePlazas] = useState<any[]>([]);

    // Estado para tarifas reales del sistema
    const [rates, setRates] = useState<any>(null);

    // Estados para egreso
    const [selectedVehicleForExit, setSelectedVehicleForExit] = useState<Vehicle | null>(null);
    const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);
    const [processingExit, setProcessingExit] = useState<string | null>(null);

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

    // Estados para filtros de tabla
    const [filterPlate, setFilterPlate] = useState<string>("");
    const [filterVehicleType, setFilterVehicleType] = useState<VehicleType | 'Todos'>("Todos");

    // Verificar permisos
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

    useEffect(() => {
        if (user && estId) {
            setLoading(false);
        }
    }, [user, estId]);

    // Cargar lista de vehículos estacionados
    useEffect(() => {
        if (parkedVehicles) {
            setVehiclesList(parkedVehicles);
        }
    }, [parkedVehicles]);

    // Cargar tarifas reales del sistema
    useEffect(() => {
        if (!estId) return;

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

                    setRates(data || []);
                    console.log('🏷️ Tarifas cargadas:', data);
                } catch (error) {
                    console.error("Error al cargar tarifas:", error);
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

                // Cargar configuración del usuario (API keys, datos bancarios)
                const userResponse = await fetch('/api/user/settings');
                let userSettings: {
                    mercadopagoApiKey?: string;
                    bankAccountCbu?: string;
                    bankAccountAlias?: string;
                } = {};

                if (userResponse.ok) {
                    userSettings = await userResponse.json();
                    console.log('✅ Configuración de usuario cargada:', {
                        hasMercadoPago: !!userSettings.mercadopagoApiKey,
                        hasBankData: !!(userSettings.bankAccountCbu && userSettings.bankAccountAlias)
                    });
                }

                // Convertir el formato del endpoint al formato esperado por getAvailablePaymentMethods
                const efectivoEnabled = methodsData.methods?.find((m: any) => m.method === 'Efectivo')?.enabled ?? false;
                const transferenciaEnabled = methodsData.methods?.find((m: any) => m.method === 'Transferencia')?.enabled ?? false;
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
                        publicKey: userSettings.mercadopagoApiKey || ''
                    }
                };

                console.log('🔧 Configuración final de pagos:', {
                    efectivo: settings.efectivo.enabled,
                    transferencia: settings.transfer.enabled && !!(settings.transfer.cbu && settings.transfer.alias),
                    'qr/link_pago': settings.mercadopago.enabled && !!settings.mercadopago.accessToken
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

    // Calcular espacios disponibles
    const getAvailableSpaces = () => {
        if (!parkingCapacity || !parkedVehicles) {
            return {
                total: { capacity: 0, occupied: 0 }
            };
        }

        return {
            total: {
                capacity: parkingCapacity.Auto + parkingCapacity.Moto + parkingCapacity.Camioneta,
                occupied: parkedVehicles.length
            }
        };
    };

    const availableSpaces = getAvailableSpaces();
    const totalAvailable = availableSpaces.total.capacity - availableSpaces.total.occupied;

    // Función para cargar tarifas genéricas
    const loadTariffs = async () => {
        try {
            const tariffs = [
                { tar_id: 1, tar_nombre: 'Hora', tar_precio_hora: 200 },
                { tar_id: 2, tar_nombre: 'Día', tar_precio_hora: 1500 },
                { tar_id: 3, tar_nombre: 'Semana', tar_precio_hora: 8000 },
                { tar_id: 4, tar_nombre: 'Mensual', tar_precio_hora: 25000 }
            ];
            setAvailableTariffs(tariffs);
            return tariffs;
        } catch (error) {
            console.error('Error loading tariffs:', error);
            return [];
        }
    };

    // Función para registrar entrada de vehículo
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
            const { error: ocupacionError } = await supabase
                .from('ocupacion')
                .insert({
                    est_id: estId,
                    veh_patente: vehicleData.license_plate,
                    ocu_fh_entrada: entryTime,
                    pla_numero: vehicleData.pla_numero,
                    ocu_duracion_tipo: vehicleData.duracion_tipo || 'hora',
                    ocu_precio_acordado: vehicleData.precio_acordado || 0,
                    ocu_fecha_limite: fechaLimite ? fechaLimite.toISOString() : null
                });

            if (ocupacionError) {
                console.error('Error al registrar ocupación:', ocupacionError);
                throw new Error(`Error al registrar ocupación: ${ocupacionError.message}`);
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
            await refreshCapacity();

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

    // Función para cargar plazas disponibles
    const loadAvailablePlazas = async () => {
        if (!estId) return;

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: plazas, error } = await supabase
                .from('plazas')
                .select('*')
                .eq('est_id', estId)
                .eq('pla_estado', 'Libre');

            if (error) {
                console.error('Error loading available plazas:', error);
                return;
            }

            setAvailablePlazas(plazas || []);
            console.log('Plazas disponibles cargadas:', plazas?.length || 0);
        } catch (error) {
            console.error('Error loading available plazas:', error);
        }
    };

    // Función para abrir modal de ingreso
    const handleOpenIngresoModal = () => {
        loadTariffs();
        loadAvailablePlazas();
        setShowIngresoModal(true);
    };

    // Función para manejar confirmación de ingreso
    const handleConfirmIngreso = async (data: {
        license_plate: string
        type: VehicleType
        plaza_number: number
        modality: string
        agreed_price: number
    }) => {
        setModalLoading(true);
        try {
            await registerEntry({
                license_plate: data.license_plate,
                type: data.type,
                pla_numero: data.plaza_number,
                duracion_tipo: data.modality.toLowerCase(),
                precio_acordado: data.agreed_price
            });

            toast({
                title: "Entrada registrada",
                description: `Vehículo ${data.license_plate} registrado en plaza ${data.plaza_number}`
            });
            setShowIngresoModal(false);

            // Recargar plazas disponibles después del registro
            await loadAvailablePlazas();
        } catch (error) {
            console.error('Error registering entry:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al registrar ingreso"
            });
        } finally {
            setModalLoading(false);
        }
    };

    // Función para abrir modal de egreso
    const handleOpenEgresoModal = () => {
        if (vehiclesList.length === 0) {
            toast({
                variant: "destructive",
                title: "Sin vehículos",
                description: "No hay vehículos estacionados para dar salida"
            });
            return;
        }

        // Si hay solo un vehículo, ir directo al sistema de pagos
        if (vehiclesList.length === 1) {
            handleExit(vehiclesList[0].license_plate);
        } else {
            // Si hay múltiples vehículos, mostrar selector
            setShowVehicleSelectorModal(true);
        }
    };

    // Función para manejar selección de vehículo del selector
    const handleVehicleSelection = (vehicle: Vehicle) => {
        setSelectedVehicleForExit(vehicle);
        setShowVehicleSelectorModal(false);
        // Ir directo al sistema de pagos
        handleExit(vehicle.license_plate);
    };

    // Función para calcular tarifa por plantilla (igual que operador-simple)
    const calculateFeeByTemplate = async (ocupacion: any) => {
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // Calcular duración
            const entryTime = dayjs(ocupacion.entry_time).tz('America/Argentina/Buenos_Aires');
            const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');
            const durationMs = exitTime.diff(entryTime);
            const durationHours = durationMs / (1000 * 60 * 60);

            let fee = 0;
            let calculatedFee = 0;
            let agreedPrice = ocupacion.ocu_precio_acordado || 0;
            let vehicleRate = null;

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
                        if (durationHours <= 1) {
                            calculatedFee = basePrice;
                        } else {
                            calculatedFee = basePrice + (hourlyRate * (durationHours - 1));
                        }
                    } else if (tiptar === 2) { // DÍA
                        const durationDays = Math.ceil(durationHours / 24);
                        calculatedFee = basePrice * durationDays;
                    } else if (tiptar === 4) { // SEMANA
                        const durationWeeks = Math.ceil(durationHours / (24 * 7));
                        calculatedFee = basePrice * durationWeeks;
                    } else if (tiptar === 3) { // MES
                        const durationMonths = Math.ceil(durationHours / (24 * 30));
                        calculatedFee = basePrice * durationMonths;
                    } else {
                        calculatedFee = basePrice;
                    }

                    // Usar el máximo entre la tarifa calculada y el precio acordado
                    fee = Math.max(calculatedFee, agreedPrice);

                    console.log('💰 Cálculo de tarifa:', {
                        vehicleRate,
                        basePrice,
                        hourlyRate,
                        durationHours,
                        tiptar,
                        calculatedFee,
                        agreedPrice,
                        fee
                    });
                } else {
                    console.warn('⚠️ No se encontró tarifa para el vehículo, usando precio acordado');
                    fee = agreedPrice > 0 ? agreedPrice : 200; // Fallback
                }
            } else {
                console.warn('⚠️ No hay tarifas configuradas, usando precio acordado');
                fee = agreedPrice > 0 ? agreedPrice : 200; // Fallback
            }

            return {
                fee,
                calculatedFee,
                agreedPrice,
                durationMs,
                baseRate: vehicleRate ? parseFloat(vehicleRate.tar_precio) : 200
            };
        } catch (error) {
            console.error('Error calculando tarifa:', error);
            return {
                fee: 200, // Fallback
                calculatedFee: 200,
                agreedPrice: 0,
                durationMs: 0,
                baseRate: 200
            };
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

            // Calcular tarifa usando el sistema de plantillas
            const feeData = await calculateFeeByTemplate(ocupacion);

            // Calcular tarifa
            const entryTime = dayjs(ocupacion.entry_time).tz('America/Argentina/Buenos_Aires');
            const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');
            const durationMs = exitTime.diff(entryTime);

            // Preparar datos para el sistema de pagos
            const paymentInfo: PaymentData = {
                vehicleLicensePlate: licensePlate,
                amount: feeData.fee,
                calculatedFee: feeData.calculatedFee,
                agreedFee: feeData.agreedPrice > 0 ? feeData.agreedPrice : undefined,
                entryTime: ocupacion.entry_time,
                exitTime: exitTime.toISOString(),
                duration: durationMs,
                method: 'efectivo', // Se actualizará cuando el usuario seleccione
                estId: estId,
                plazaNumber: ocupacion.plaza_number,
                zone: ocupacion.plaza_number ? 'Zona General' : undefined
            };

            setPaymentData(paymentInfo);
            setShowPaymentSelector(true);

            console.log('💰 Iniciando proceso de pago:', {
                vehicle: licensePlate,
                amount: formatCurrency(feeData.fee),
                duration: formatDuration(durationMs)
            });

        } catch (error) {
            console.error("Error al registrar salida:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo registrar la salida del vehículo"
            });
            throw error;
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
        console.log('📄 Mostrando información de transferencia');
    };

    // Procesar pago con QR
    const processQRPago = async (data: PaymentData) => {
        try {
            console.log('📱 Generando código QR para pago...');

            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo',
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
                const qrDialogData = {
                    qrCode: qr_code || init_point,
                    qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_code || init_point)}`,
                    preferenceId: preferenceId
                };

                // Cerrar el selector de pagos y mostrar el modal QR
                setShowPaymentSelector(false);
                setQrData(qrDialogData);
                setShowQRDialog(true);

                toast({
                    title: "Código QR generado",
                    description: "Muestre el código QR al cliente para que realice el pago"
                });
            } else {
                throw new Error("No se pudo generar el código QR");
            }

            console.log('✅ Código QR generado exitosamente');

        } catch (error) {
            console.error('❌ Error generando código QR:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el código QR. Intenta con otro método de pago."
            });
            // Mantener el selector de métodos abierto para que puedan elegir otro método
        }
    };

    // Procesar pago con link
    const processLinkPago = async (data: PaymentData) => {
        setShowPaymentSelector(false);

        try {
            console.log('🔗 Generando link de pago...');

            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo',
                    paymentType: 'regular',
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
            setShowPaymentSelector(true);
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

            // Actualizar la ocupación marcando la salida
            const { error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: data.exitTime
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
            await refreshCapacity();

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


    // Función para cerrar modales
    const handleCloseModals = () => {
        setShowIngresoModal(false);
        setShowVehicleSelectorModal(false);
        setSelectedVehicleForExit(null);
        setModalLoading(false);
        closePaymentModals();
    };

    if (loading || roleLoading) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                            <p className="text-gray-600">Cargando panel de operador...</p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!estId) {
        return (
            <DashboardLayout>
                <div className="p-6">
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                        <p className="text-gray-600 mb-6">
                            Selecciona un estacionamiento para acceder al panel de operador
                        </p>
                        <Button onClick={() => router.push('/dashboard/parking')}>
                            Ir a Mis Estacionamientos
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-white">
                {/* Header */}
                <div className="bg-white">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        {/* Navegación centrada */}
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setActiveTab('ingreso')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                    activeTab === 'ingreso'
                                        ? 'bg-gray-200 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Ingreso / Egreso
                            </button>
                            <button
                                onClick={() => router.push('/dashboard/operador-simple')}
                                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                    activeTab === 'informacion'
                                        ? 'bg-gray-200 text-gray-900'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Información
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-6 py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">

                        {/* Tarjeta de Ingreso */}
                        <div
                            className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 border-2 border-green-300 cursor-pointer hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center min-h-[400px]"
                            onClick={handleOpenIngresoModal}
                        >
                            {/* Círculo con flecha */}
                            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-8">
                                <ArrowLeft className="w-8 h-8 text-white" />
                            </div>

                            {/* Título */}
                            <h2 className="text-4xl font-bold text-green-800 mb-4">INGRESO</h2>

                            {/* Descripción */}
                            <p className="text-green-700 text-center mb-8 text-lg">
                                Registrar entrada de vehículo
                            </p>

                            {/* Badge con información */}
                            <div className="bg-green-600 text-white px-6 py-3 rounded-full font-medium">
                                {totalAvailable} espacios disponibles
                            </div>
                        </div>

                        {/* Tarjeta de Egreso */}
                        <div
                            className="bg-gradient-to-br from-red-100 to-red-200 rounded-3xl p-8 border-2 border-red-300 cursor-pointer hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center min-h-[400px]"
                            onClick={handleOpenEgresoModal}
                        >
                            {/* Círculo con flecha */}
                            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mb-8">
                                <ArrowRight className="w-8 h-8 text-white" />
                            </div>

                            {/* Título */}
                            <h2 className="text-4xl font-bold text-red-800 mb-4">EGRESO</h2>

                            {/* Descripción */}
                            <p className="text-red-700 text-center mb-8 text-lg">
                                Registrar salida de vehículo
                            </p>

                            {/* Badge con información */}
                            <div className="bg-red-600 text-white px-6 py-3 rounded-full font-medium">
                                {availableSpaces.total.occupied} vehículos estacionados
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Ingreso */}
            <IngresoModal
                plaza={null} // Ya no es necesario porque se selecciona dinámicamente
                isOpen={showIngresoModal}
                onClose={handleCloseModals}
                onConfirm={handleConfirmIngreso}
                loading={modalLoading}
                tarifas={availableTariffs}
                availablePlazas={availablePlazas}
            />

            {/* Modal de Selección de Vehículos */}
            <VehicleSelectorModal
                vehicles={vehiclesList}
                isOpen={showVehicleSelectorModal}
                onClose={handleCloseModals}
                onSelectVehicle={handleVehicleSelection}
            />

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
                        console.log('💰 Operador confirmó recepción de transferencia:', {
                            vehicle: paymentData.vehicleLicensePlate,
                            amount: formatCurrency(paymentData.amount),
                            operator: user?.email
                        });

                        toast({
                            title: "Transferencia confirmada",
                            description: `Pago de ${formatCurrency(paymentData.amount)} confirmado por el operador`
                        });

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
                    cbu: '0170020510000001234567',
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
                    if (paymentData) {
                        await finalizeVehicleExit(paymentData);
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
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                }}
                qrData={qrData || {
                    qrCode: '',
                    qrCodeImage: '',
                    preferenceId: ''
                }}
                paymentStatus={qrPaymentStatus}
                loading={paymentLoading}
            />
        </DashboardLayout>
    );
}