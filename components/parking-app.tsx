"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OperatorPanel from "@/components/operator-panel";
import AdminPanel from "@/components/admin-panel";
import RatesPanel from "@/components/rates-panel";
import type { Parking, Vehicle, ParkingHistory, VehicleType } from "@/lib/types";
import { calculateFee, formatDuration } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-context";
import AuthPage from "@/components/auth/auth-page";
import { UserNav } from "@/components/layout/user-nav";
import { supabase } from "@/lib/supabase";
import { PaymentMethodDialog } from "./payment-method-dialog";
import { toast } from "@/components/ui/use-toast";
import { QRDialog } from "./qr-dialog";
import { PaymentConfirmationDialog } from "./payment-confirmation-dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExitInfo = {
  vehicle: Vehicle;
  fee: number;
  exitTime: Date;
  duration: string;
};

export default function ParkingApp() {
  const { user, loading: authLoading } = useAuth();
  const [parkedVehicles, setParkedVehicles] = useState<Parking[]>([]);
  const [parkingHistory, setParkingHistory] = useState<ParkingHistory[]>([]);
  const [rates, setRates] = useState<Record<VehicleType, number>>({
    Auto: 0,
    Moto: 0,
    Camioneta: 0,
  });

  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQrData] = useState<{
    code: string;
    fee: number;
    qrCodeBase64?: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [exitingVehicle, setExitingVehicle] = useState<Vehicle | null>(null);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [lastCalculatedFee, setLastCalculatedFee] = useState(0);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  const [parking, setParking] = useState<Parking>({
    capacity: {
      Auto: 0,
      Moto: 0,
      Camioneta: 0,
    },
    rates: {
      Auto: 0,
      Moto: 0,
      Camioneta: 0,
    },
    parkedVehicles: [],
    history: [],
  });

  const registerEntry = async (vehicle: Omit<Vehicle, "entry_time" | "user_id">) => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debe iniciar sesión para registrar entradas"
      });
      return;
    }

    const now = new Date();
    const entryTimeISO = now.toISOString(); // Usar formato ISO 8601 UTC

    const newVehicle: Vehicle = {
      ...vehicle,
      entry_time: entryTimeISO, // Guardar ISO en estado local
      user_id: user.id
    };

    // Verificar si hay capacidad configurada
    if (parking.capacity[vehicle.type] === 0) {
      toast({
        variant: "destructive",
        title: "Capacidad no configurada",
        description: "Debe configurar la capacidad del estacionamiento en el Panel de Administrador antes de registrar vehículos.",
      });
      return;
    }

    // Verificar si hay espacio disponible
    const availableSpaces = getAvailableSpaces();
    if (availableSpaces[vehicle.type] <= 0) {
      toast({
        variant: "destructive",
        title: "Estacionamiento lleno",
        description: `No hay espacios disponibles para ${vehicle.type}s. Por favor, configure más espacios en el Panel de Administrador.`,
      });
      return;
    }

    try {
      const response = await fetch("/api/parking/entry", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: newVehicle.license_plate,
          type: newVehicle.type,
          entry_time: entryTimeISO, // Enviar ISO a la API
          user_id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Error al guardar entrada:", data);
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Error al registrar la entrada del vehículo."
        });
        return;
      }

      setParking((prev) => ({
        ...prev,
        parkedVehicles: [...prev.parkedVehicles, newVehicle],
      }));

      toast({
        title: "Éxito",
        description: `Se ha registrado la entrada del vehículo ${newVehicle.license_plate}`
      });
    } catch (err) {
      console.error("❌ Error al guardar entrada:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al conectar con el servidor."
      });
    }
  };

  const handleExit = async (licensePlate: string) => {
    if (!user) {
      toast({ 
        title: "Error", 
        description: "Debe iniciar sesión para registrar salidas", 
        variant: "destructive" 
      });
      return;
    }

    console.log('Buscando vehículo:', { licensePlate, parkedVehicles: parking.parkedVehicles });
    const vehicle = parking.parkedVehicles.find(v => v.license_plate === licensePlate);
    
    if (!vehicle) {
      toast({ 
        title: "Error", 
        description: "Vehículo no encontrado", 
        variant: "destructive" 
      });
      return;
    }

    if (!vehicle.entry_time) {
      console.error('Vehículo sin fecha de entrada:', vehicle);
      toast({ 
        title: "Error", 
        description: "El vehículo no tiene fecha de entrada registrada", 
        variant: "destructive" 
      });
      return;
    }

    try {
      console.log('Procesando salida para vehículo:', vehicle);
      
      // Parsear la fecha ISO directamente
      const entryTime = new Date(vehicle.entry_time);
      
      if (isNaN(entryTime.getTime())) {
        console.error('Fecha inválida:', {
          original: vehicle.entry_time,
          parsed: entryTime
        });
        throw new Error("Fecha de entrada inválida");
      }

      const now = new Date();
      const diffInMinutes = Math.abs(now.getTime() - entryTime.getTime()) / (1000 * 60);
      const durationHours = Math.max(diffInMinutes / 60, 1);
      
      if (!parking.rates[vehicle.type]) {
        console.error('Tarifa no encontrada para el tipo de vehículo:', vehicle.type);
        throw new Error(`Tarifa no configurada para ${vehicle.type}`);
      }

      const rate = parking.rates[vehicle.type];
      const fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;

      console.log('Cálculo de tarifa:', {
        entryTime: entryTime.toISOString(),
        exitTime: now.toISOString(),
        durationHours,
        rate,
        fee,
        diffInMinutes,
        vehicle
      });

      // Formatear la duración como string
      const durationStr = diffInMinutes < 60 
        ? `${Math.round(diffInMinutes)} min`
        : `${Math.floor(diffInMinutes / 60)}h ${Math.round(diffInMinutes % 60)}min`;

      setExitInfo({
        vehicle,
        fee,
        exitTime: now,
        duration: durationStr
      });
      
      setExitingVehicle(vehicle);
      setLastCalculatedFee(fee);
      setPaymentMethodDialogOpen(true);

    } catch (error) {
      console.error('Error al calcular tarifa:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al calcular la tarifa. Verifique la fecha de entrada."
      });
    }
  };

  const handlePaymentMethod = async (method: string) => {
    if (!exitingVehicle || !user) return;

    try {
      const exitTime = new Date();
      // Parsear la fecha ISO directamente
      const entryTime = new Date(exitingVehicle.entry_time);
      
      if (isNaN(entryTime.getTime())) {
        console.error('Fecha inválida en handlePaymentMethod:', {
          original: exitingVehicle.entry_time,
          parsed: entryTime
        });
        throw new Error("Fecha de entrada inválida");
      }

      const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      const durationHours = Math.max(diffInMinutes / 60, 1); // Mínimo 1 hora
      const rate = parking.rates[exitingVehicle.type] || 0;
      const fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;
      
      console.log('Calculando tarifa en handlePaymentMethod:', {
        entryTime: entryTime.toISOString(),
        exitTime: exitTime.toISOString(),
        durationHours,
        rate,
        fee,
        diffInMinutes,
        vehicle: exitingVehicle
      });
      
      if (!fee || fee <= 0) {
        throw new Error("La tarifa debe ser mayor a 0");
      }

      setLastCalculatedFee(fee);

      if (method === 'qr' || method === 'mercadopago') {
        // Verificar si el usuario tiene API key configurada
        const response = await fetch(`/api/user/settings?userId=${user.id}`);
        const data = await response.json();

        if (!data.mercadopagoApiKey) {
          toast({
            variant: "destructive",
            title: "API Key no configurada",
            description: "Debes configurar tu API Key de MercadoPago en el panel de tarifas antes de usar pagos con QR.",
          });
          setPaymentMethodDialogOpen(false);
          // Mantener el vehículo en la lista de estacionados
          return;
        }

        const responseMp = await fetch("/api/payment/mercadopago", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            licensePlate: exitingVehicle.license_plate,
            fee: fee,
            vehicleType: exitingVehicle.type,
            paymentType: method,
            userId: user.id
          }),
        });

        if (!responseMp.ok) {
          const errorData = await responseMp.json();
          throw new Error(errorData.error || "Error al generar el pago");
        }

        const paymentData = await responseMp.json();
        
        if (method === 'qr') {
          setQrData({
            code: paymentData.qr_code,
            fee: paymentData.fee,
            qrCodeBase64: paymentData.qr_code_base64
          });
          setShowQRDialog(true);
        } else if (method === 'mercadopago' && paymentData.init_point) {
          window.open(paymentData.init_point, '_blank');
          setPaymentMethodDialogOpen(false);
          toast({
            title: "Procesando pago",
            description: "Se ha abierto una nueva ventana para completar el pago.",
          });
          setPaymentConfirmationOpen(true);
          return;
        }
      } else {
        await registerExit(exitingVehicle, method, fee, diffInMinutes, exitTime);
      }
    } catch (error: any) {
      console.error("Error en el proceso de pago:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error desconocido"
      });
      // No cerrar el diálogo de pago si hay un error
      return;
    }
    
    // Solo cerrar el diálogo si todo fue exitoso
    setPaymentMethodDialogOpen(false);
  };

  const registerExit = async (
    vehicle: Vehicle,
    paymentMethod: string,
    fee: number,
    duration: number,
    exitTime: Date
  ) => {
    try {
      if (!user?.id) {
        throw new Error("Debe iniciar sesión para registrar salidas");
      }

      const exitTimeISO = exitTime.toISOString();

      // Convertir la duración a milisegundos (entero)
      const durationInMs = Math.round(duration * 60 * 1000); // convertir minutos a milisegundos

      // Usar la ruta correcta para registrar salidas
      const response = await fetch("/api/parking/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: vehicle.license_plate,
          type: vehicle.type,
          entry_time: vehicle.entry_time,
          exit_time: exitTimeISO,
          duration: durationInMs,
          fee: Math.round(fee * 100) / 100,
          payment_method: paymentMethod,
          user_id: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || "Error al registrar la salida");
      }

      const historyEntry = await response.json();

      if (showQRDialog) {
        setShowQRDialog(false);
        setQrData(null);
        setExitingVehicle(null);
      }

      // Actualizar el estado local
      setParking((prev) => ({
        ...prev,
        parkedVehicles: prev.parkedVehicles.filter(
          (v) => v.license_plate !== vehicle.license_plate
        ),
        history: [historyEntry[0], ...prev.history],
      }));

      // Mostrar mensaje de éxito
      toast({
        title: "Salida registrada",
        description: `Vehículo ${vehicle.license_plate} salió. Duración: ${formatDuration(durationInMs)}`,
      });

    } catch (error: any) {
      console.error("Error registrando salida:", error);
      toast({
        variant: "destructive",
        title: "Error al registrar salida",
        description: error.message || "Error desconocido",
      });
      throw error;
    }
  };

  const updateRate = (type: VehicleType, rate: number) => {
    setParking((prev) => ({
      ...prev,
      rates: {
        ...prev.rates,
        [type]: rate,
      },
    }));
  };

  const updateCapacity = (type: VehicleType, capacity: number) => {
    setParking((prev) => ({
      ...prev,
      capacity: {
        ...prev.capacity,
        [type]: capacity,
      },
    }));
  };

  const getAvailableSpaces = () => {
    const occupied = {
      Auto: parking.parkedVehicles.filter((v) => v.type === "Auto").length,
      Moto: parking.parkedVehicles.filter((v) => v.type === "Moto").length,
      Camioneta: parking.parkedVehicles.filter((v) => v.type === "Camioneta").length,
    };

    return {
      Auto: parking.capacity.Auto - occupied.Auto,
      Moto: parking.capacity.Moto - occupied.Moto,
      Camioneta: parking.capacity.Camioneta - occupied.Camioneta,
      total: {
        capacity: Object.values(parking.capacity).reduce((a, b) => a + b, 0),
        occupied: Object.values(occupied).reduce((a, b) => a + b, 0),
      },
    };
  };

  const handleDeleteHistoryEntry = async (id: string) => {
    try {
      const response = await fetch(`/api/parking/history/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el registro");
      }

      if (data.success) {
        setParking((prev) => ({
          ...prev,
          history: prev.history.filter((entry) => entry.id !== id),
        }));
      }
    } catch (error) {
      console.error("Error al eliminar registro:", error);
      throw error;
    }
  };

  const handleUpdateHistoryEntry = async (id: string, data: Partial<ParkingHistory>) => {
    try {
      const response = await fetch(`/api/parking/history/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar el registro");
      }

      setParking((prev) => ({
        ...prev,
        history: prev.history.map((entry) =>
          entry.id === id ? { ...entry, ...data } : entry
        ),
      }));
    } catch (error) {
      console.error("Error al actualizar registro:", error);
      throw error;
    }
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    
    try {
      const resHistory = await fetch(`/api/parking/history?userId=${user.id}`);

      if (!resHistory.ok) {
        throw new Error("Error al obtener datos del servidor");
      }

      const historyData = await resHistory.json();

      if (!Array.isArray(historyData.history)) {
        console.error("historyData no es un arreglo:", historyData);
        throw new Error("Formato de datos de historial inválido");
      }

      const history = historyData.history.map((h: any) => ({
        id: h.id,
        license_plate: h.license_plate,
        type: h.type,
        entry_time: new Date(h.entry_time + 'Z'),
        exit_time: new Date(h.exit_time + 'Z'),
        duration: typeof h.duration === 'number' ? h.duration : parseInt(h.duration),
        fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee),
        user_id: h.user_id,
        payment_method: h.payment_method || 'No especificado'
      })) as ParkingHistory[];

      setParking(prev => ({
        ...prev,
        history
      }));
    } catch (error) {
      console.error("Error al cargar historial:", error);
      throw error;
    }
  };

  const handleReenterVehicle = async (entry: ParkingHistory) => {
    if (!user) return;

    try {
      const isAlreadyParked = parking.parkedVehicles.some(
        v => v.license_plate === entry.license_plate
      );

      if (isAlreadyParked) {
        throw new Error("Este vehículo ya se encuentra estacionado");
      }

      await handleDeleteHistoryEntry(entry.id);

      const response = await fetch("/api/parking/entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: entry.license_plate,
          type: entry.type,
          entry_time: new Date().toISOString(),
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear nuevo registro de entrada");
      }

      const newVehicle: Vehicle = {
        license_plate: entry.license_plate,
        type: entry.type,
        entry_time: new Date().toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        user_id: user.id
      };

      setParking(prev => ({
        ...prev,
        parkedVehicles: [...prev.parkedVehicles, newVehicle],
        history: prev.history.filter(h => h.id !== entry.id)
      }));

      await fetchHistory();

      toast({
        title: "Vehículo reingresado",
        description: `El vehículo ${entry.license_plate} ha sido reingresado exitosamente.`,
      });
    } catch (error) {
      console.error("Error al reingresar vehículo:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al reingresar el vehículo"
      });
    }
  };

  const handleQRDialogClose = (open: boolean) => {
    setShowQRDialog(open);
    
    if (!open) {
      console.log("QR Dialog closed. Cleaning up QR state.");
      setQrData(null);
      setExitingVehicle(null);
    }
  };

  const handlePaymentConfirmation = async (success: boolean) => {
    setPaymentConfirmationOpen(false);
    
    if (!exitingVehicle || !user) {
      toast({
        variant: "destructive",
        title: "Error de estado",
        description: "No se encontró información del vehículo o usuario para confirmar.",
      });
      setShowQRDialog(false); 
      setQrData(null);
      setExitingVehicle(null);
      return;
    }

    if (success) {
      const exitTime = new Date();
      // Parsear la fecha ISO directamente
      const entryTime = new Date(exitingVehicle.entry_time);
      
      if (isNaN(entryTime.getTime())) {
        console.error('Fecha inválida en handlePaymentConfirmation:', {
          original: exitingVehicle.entry_time,
          parsed: entryTime
        });
        // Lanzar un error o manejarlo como prefieras
        toast({
          variant: "destructive",
          title: "Error interno",
          description: "No se pudo parsear la fecha de entrada del vehículo.",
        });
        setShowQRDialog(false); 
        setQrData(null);
        setExitingVehicle(null);
        return; 
      }
      
      // Calcular la duración en minutos
      const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      
      try {
        await registerExit(exitingVehicle, qrData ? 'qr' : 'mercadopago', lastCalculatedFee, diffInMinutes, exitTime);
        toast({
          title: "Pago confirmado",
          description: "El pago y la salida se han registrado correctamente.",
        });
      } catch (error: any) {
        console.error("Error al registrar salida tras confirmación:", error);
        toast({
          variant: "destructive",
          title: "Error post-confirmación",
          description: "No se pudo registrar la salida aunque el pago se marcó como exitoso.",
        });
      }
    } else {
      toast({
        title: "Confirmación cancelada",
        description: "El pago no fue marcado como exitoso.",
      });
    }

    setShowQRDialog(false); 
    setQrData(null);
    setExitingVehicle(null);
  };

  // Función auxiliar para formatear fechas
  const formatDateTime = (date: Date | string) => {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Modificar donde se procesa el historial
  useEffect(() => {
    const fetchParkingHistory = async () => {
      try {
        const response = await fetch("/api/parking/history");
        const data = await response.json();
        
        if (response.ok) {
          const formattedHistory = data.map((h: any) => ({
            ...h,
            entry_time: formatDateTime(h.entry_time),
            exit_time: formatDateTime(h.exit_time)
          }));
          setParkingHistory(formattedHistory);
        }
      } catch (error) {
        console.error("Error al cargar el historial:", error);
      }
    };

    if (user) {
      fetchParkingHistory();
    }
  }, [user]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [parkedResponse, historyResponse, ratesResponse, capacityResponse] = await Promise.all([
          fetch(`/api/parking/parked?userId=${user.id}`),
          fetch(`/api/parking/history?userId=${user.id}`),
          fetch(`/api/rates?userId=${user.id}`),
          fetch(`/api/capacity?userId=${user.id}`)
        ]);

        const responses = await Promise.all([
          parkedResponse.ok ? parkedResponse.json() : { parkedVehicles: [] },
          historyResponse.ok ? historyResponse.json() : { history: [] },
          ratesResponse.ok ? ratesResponse.json() : { rates: { Auto: 0, Moto: 0, Camioneta: 0 } },
          capacityResponse.ok ? capacityResponse.json() : { capacity: { Auto: 0, Moto: 0, Camioneta: 0 } }
        ]);

        const [parkedData, historyData, ratesData, capacityData] = responses;

        console.log('Datos cargados:', { parkedData, historyData, ratesData, capacityData });

        // Ya no formateamos aquí, asumimos que viene en formato compatible con new Date()
        const parkedVehiclesFromDB = Array.isArray(parkedData.parkedVehicles) ? parkedData.parkedVehicles : [];

        // Actualizar el estado de parking con todos los datos
        setParking(prev => ({
          ...prev,
          capacity: capacityData.capacity || { Auto: 0, Moto: 0, Camioneta: 0 },
          rates: ratesData.rates || { Auto: 0, Moto: 0, Camioneta: 0 },
          parkedVehicles: parkedVehiclesFromDB,
          history: Array.isArray(historyData.history) ? historyData.history : []
        }));

      } catch (error) {
        console.error("Error loading initial data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar los datos iniciales"
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);
  
  const correctParkedVehiclesDates = async () => {
    if (!user?.id) return;

    try {
      const correctedVehicles = parking.parkedVehicles.map(vehicle => {
        try {
          if (!vehicle.entry_time) {
            console.error('Vehículo sin fecha de entrada:', vehicle);
            return vehicle;
          }

          // Verificar si la fecha ya está en formato 24h
          if (!vehicle.entry_time.toLowerCase().includes('a.m.') && 
              !vehicle.entry_time.toLowerCase().includes('p.m.')) {
            return vehicle;
          }

          const parts = vehicle.entry_time.split(', ');
          if (parts.length !== 2) {
            console.error('Formato de fecha inválido:', vehicle.entry_time);
            return vehicle;
          }

          const [datePart, timePart] = parts;
          const [day, month, year] = datePart.split('/');
          
          if (!timePart || !day || !month || !year) {
            console.error('Componentes de fecha faltantes:', { datePart, timePart });
            return vehicle;
          }

          const timeComponents = timePart.split(':');
          if (timeComponents.length < 2) {
            console.error('Formato de hora inválido:', timePart);
            return vehicle;
          }

          let [hours, minutes, seconds] = timeComponents;
          let hoursNum = parseInt(hours, 10);
          
          if (isNaN(hoursNum)) {
            console.error('Hora inválida:', hours);
            return vehicle;
          }

          // Determinar si es AM o PM
          const isPM = timePart.toLowerCase().includes('p.m.') || timePart.toLowerCase().includes('pm');
          const isAM = timePart.toLowerCase().includes('a.m.') || timePart.toLowerCase().includes('am');
          
          // Ajustar las horas para PM
          if (isPM && hoursNum !== 12) {
            hoursNum += 12;
          }
          // Ajustar para medianoche (12 AM)
          if (isAM && hoursNum === 12) {
            hoursNum = 0;
          }

          // Limpiar los segundos de cualquier texto adicional (AM/PM)
          const cleanSeconds = seconds ? seconds.split(' ')[0] : '00';

          // Formatear la nueva fecha en formato 24h
          const correctedTime = `${String(hoursNum).padStart(2, '0')}:${minutes}:${cleanSeconds}`;
          
          console.log('Corrigiendo fecha:', {
            original: vehicle.entry_time,
            datePart,
            timePart,
            hoursNum,
            isPM,
            isAM,
            correctedTime
          });

          return {
            ...vehicle,
            entry_time: `${datePart}, ${correctedTime}`
          };
        } catch (error) {
          console.error('Error procesando vehículo:', vehicle, error);
          return vehicle;
        }
      });

      // Actualizar en la base de datos solo los vehículos que cambiaron
      const updatedVehicles = correctedVehicles.filter((corrected, index) => 
        corrected.entry_time !== parking.parkedVehicles[index].entry_time
      );

      if (updatedVehicles.length === 0) {
        toast({
          title: "Sin cambios",
          description: "No se encontraron fechas para corregir."
        });
        return;
      }

      // Actualizar en la base de datos
      for (const vehicle of updatedVehicles) {
        const response = await fetch("/api/parking/entry/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            license_plate: vehicle.license_plate,
            entry_time: vehicle.entry_time,
            user_id: user.id
          }),
        });

        if (!response.ok) {
          throw new Error(`Error al actualizar el vehículo ${vehicle.license_plate}`);
        }
      }

      // Actualizar el estado local
      setParking(prev => ({
        ...prev,
        parkedVehicles: correctedVehicles
      }));

      toast({
        title: "Fechas corregidas",
        description: `Se han actualizado ${updatedVehicles.length} vehículos.`
      });

    } catch (error) {
      console.error("Error al corregir fechas:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron corregir las fechas de algunos vehículos."
      });
    }
  };

  const handleClearParking = async () => {
    if (!user?.id || parking.parkedVehicles.length === 0) return;

    if (!confirm('¿Está seguro que desea eliminar todos los vehículos estacionados? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch("/api/parking/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error("Error al limpiar el estacionamiento");
      }

      // Actualizar el estado local
      setParking(prev => ({
        ...prev,
        parkedVehicles: []
      }));

      toast({
        title: "Estacionamiento limpiado",
        description: "Se han eliminado todos los vehículos estacionados."
      });

    } catch (error) {
      console.error("Error al limpiar estacionamiento:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo limpiar el estacionamiento."
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Sistema de Gestión de Estacionamiento</h1>
        <div className="flex items-center gap-4">
          {parking.parkedVehicles.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={correctParkedVehiclesDates}
                className="mr-2"
              >
                Corregir Fechas
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearParking}
                className="mr-2"
              >
                Limpiar Estacionamiento
              </Button>
            </>
          )}
          <UserNav />
        </div>
      </div>

      <Tabs defaultValue="operator" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="operator">Panel de Operador</TabsTrigger>
          <TabsTrigger value="admin">Panel de Administrador</TabsTrigger>
          <TabsTrigger value="rates">Gestión de Tarifas</TabsTrigger>
        </TabsList>

        <TabsContent value="operator">
          <OperatorPanel
            parking={parking}
            availableSpaces={getAvailableSpaces()}
            onRegisterEntry={registerEntry}
            onRegisterExit={handleExit}
            exitInfo={exitInfo}
            setExitInfo={setExitInfo}
          />
        </TabsContent>

        <TabsContent value="admin">
          <AdminPanel
            history={parking.history}
            availableSpaces={getAvailableSpaces()}
            capacity={parking.capacity}
            onUpdateCapacity={updateCapacity}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onUpdateHistoryEntry={handleUpdateHistoryEntry}
            onReenterVehicle={handleReenterVehicle}
          />
        </TabsContent>

        <TabsContent value="rates">
          <RatesPanel rates={parking.rates} onUpdateRate={updateRate} />
        </TabsContent>
      </Tabs>

      <Toaster />

      <PaymentMethodDialog
        open={paymentMethodDialogOpen}
        onOpenChange={(open) => {
          setPaymentMethodDialogOpen(open);
          if (!open && exitingVehicle && !parking.parkedVehicles.find(v => v.license_plate === exitingVehicle.license_plate)) {
            setParking(prev => ({
              ...prev,
              parkedVehicles: [...prev.parkedVehicles, exitingVehicle]
            }));
          }
        }}
        onSelectMethod={handlePaymentMethod}
        fee={lastCalculatedFee || (exitingVehicle ? calculateFee(calculateHours(exitingVehicle.entry_time), parking.rates[exitingVehicle.type]) : 0)}
      />

      <QRDialog
        open={showQRDialog}
        onOpenChange={handleQRDialogClose}
        qrCode={qrData?.code || ''}
        qrCodeBase64={qrData?.qrCodeBase64}
        fee={qrData?.fee || lastCalculatedFee}
        onConfirmPayment={() => handlePaymentConfirmation(true)}
      />

      <PaymentConfirmationDialog
        open={paymentConfirmationOpen}
        onOpenChange={setPaymentConfirmationOpen}
        onConfirm={handlePaymentConfirmation}
      />
    </main>
  );
}

function calculateHours(entryTimeStr: string): number {
  try {
    // Parsear la fecha ISO directamente
    const entryTime = new Date(entryTimeStr);
    if (isNaN(entryTime.getTime())) {
      console.error('Error calculando horas: Fecha inválida', entryTimeStr);
      return 1; 
    }
    const now = new Date();
    
    const diffInMinutes = Math.abs(now.getTime() - entryTime.getTime()) / (1000 * 60);
    return Math.max(diffInMinutes / 60, 1);
  } catch (error) {
    console.error('Error calculando horas:', error);
    return 1; // Retornar mínimo 1 hora en caso de error
  }
}
