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
import dayjs from "dayjs";

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
      toast({ title: "Error", description: "Debe iniciar sesión...", variant: "destructive" });
      return;
    }
    const vehicle = parking.parkedVehicles.find(v => v.license_plate === licensePlate);
    if (!vehicle) {
      toast({ title: "Error", description: "Vehículo no encontrado", variant: "destructive" });
      return;
    }
    if (!vehicle.entry_time) {
      toast({ title: "Error", description: "El vehículo no tiene fecha de entrada...", variant: "destructive" });
      return;
    }

    try {
      console.log('Procesando salida para vehículo:', vehicle);
      
      const entryTimeDayjs = dayjs.utc(vehicle.entry_time);
      if (!entryTimeDayjs.isValid()) {
          throw new Error("Fecha de entrada inválida (Day.js) en handleExit");
      }
      const entryTime = entryTimeDayjs.toDate();
      const exitTime = new Date(); // Hora actual para cálculo inicial

      const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      const durationHours = Math.max(diffInMinutes / 60, 1);
      const rate = parking.rates[vehicle.type] || 0;
      const fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;
      if (!fee || fee <= 0) {
          console.warn("Tarifa calculada es 0 o negativa en handleExit", { durationHours, rate, fee });
          // Podrías lanzar error o asignar una tarifa mínima si esto no debería pasar
          throw new Error("La tarifa calculada inicialmente es inválida");
      }
      
      console.log('Tarifa inicial calculada en handleExit:', { fee, durationHours });

      // Guardar vehículo y tarifa calculada en el estado ANTES de abrir el diálogo
      setExitingVehicle(vehicle);
      setLastCalculatedFee(fee);
      setPaymentMethodDialogOpen(true);

    } catch (error) {
      console.error('Error al iniciar proceso de salida:', error);
      toast({ variant: "destructive", title: "Error", description: error instanceof Error ? error.message : "Error al iniciar el proceso de salida." });
    }
  };

  const handlePaymentMethod = async (method: string) => {
    if (!exitingVehicle || !user) return;
    let shouldCloseDialog = false;
    let historyEntry: ParkingHistory | null = null;

    try {
      const exitTime = new Date();

      console.log("Parsing entry_time in handlePaymentMethod:", exitingVehicle.entry_time);
      const entryTimeDayjs = dayjs.utc(exitingVehicle.entry_time);
      if (!entryTimeDayjs.isValid()) {
          throw new Error("Fecha de entrada inválida (Day.js)");
      }
      const entryTime = entryTimeDayjs.toDate();

      const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      const durationHours = Math.max(diffInMinutes / 60, 1);
      const rate = parking.rates[exitingVehicle.type] || 0;
      const fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;
      if (!fee || fee <= 0) throw new Error("La tarifa debe ser mayor a 0");
      setLastCalculatedFee(fee);
      const durationStr = formatDuration(diffInMinutes * 60 * 1000);

      console.log('Calculando tarifa en handlePaymentMethod (parsed with Day.js):', {
        entryTimeString: exitingVehicle.entry_time,
        entryTimeISO: entryTime.toISOString(),
        exitTimeISO: exitTime.toISOString(),
        durationHours, rate, fee, diffInMinutes
      });

      if (method === 'qr' || method === 'mercadopago') {
        const response = await fetch(`/api/user/settings?userId=${user.id}`);
        const data = await response.json();
        if (!data.mercadopagoApiKey) {
          toast({
            variant: "destructive",
            title: "API Key no configurada",
            description: "Debes configurar tu API Key de MercadoPago en el panel de tarifas antes de usar pagos con QR.",
          });
          return;
        }
        const responseMp = await fetch("/api/payment/mercadopago", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          setQrData({ code: paymentData.qr_code, fee: paymentData.fee, qrCodeBase64: paymentData.qr_code_base64 });
          setShowQRDialog(true);
        } else if (method === 'mercadopago' && paymentData.init_point) {
          window.open(paymentData.init_point, '_blank');
          toast({ title: "Procesando pago", description: "Se ha abierto una nueva ventana..." });
          setPaymentConfirmationOpen(true);
          shouldCloseDialog = true;
        }
      } else {
        historyEntry = await registerExit(exitingVehicle, method, fee, diffInMinutes, exitTime);
        shouldCloseDialog = true;
        setExitInfo({
          vehicle: exitingVehicle,
          fee: fee,
          exitTime: exitTime,
          duration: durationStr
        });
      }
    } catch (error: any) {
      if (!error.message?.includes("Error al registrar salida")) {
          console.error("Error en handlePaymentMethod (antes de registerExit o en MP):");
          toast({ variant: "destructive", title: "Error", description: error.message || "Error desconocido"});
      } else {
          console.error("Error capturado en handlePaymentMethod (probablemente de registerExit):");
      }
       console.error(error); 
       return;
    }
    
    if (shouldCloseDialog) {
      setPaymentMethodDialogOpen(false);
      if (historyEntry) {
        toast({
          title: "Salida registrada",
          description: `Vehículo ${historyEntry.license_plate} salió. Duración: ${formatDuration(historyEntry.duration)}`,
        });
      }
    }
  };

  const registerExit = async (
    vehicle: Vehicle,
    paymentMethod: string,
    fee: number,
    duration: number,
    exitTime: Date
  ): Promise<ParkingHistory> => {
    try {
      if (!user?.id) {
        throw new Error("Debe iniciar sesión para registrar salidas");
      }

      const exitTimeISO = exitTime.toISOString();
      const durationInMs = Math.round(duration * 60 * 1000);

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

      const historyEntryResponse = await response.json(); // Obtener respuesta (puede ser array)
      const newHistoryEntry = Array.isArray(historyEntryResponse) ? historyEntryResponse[0] : historyEntryResponse;

      if (!newHistoryEntry || !newHistoryEntry.id) {
          console.error("Respuesta inválida de /api/parking/log:", historyEntryResponse);
          throw new Error("No se recibió la entrada de historial creada desde la API.");
      }

      // Actualizar el estado local SIN mostrar toast aquí
      setParking((prev) => ({
        ...prev,
        parkedVehicles: prev.parkedVehicles.filter(
          (v) => v.license_plate !== vehicle.license_plate
        ),
        // Asegurarse de añadir la entrada correcta al historial
        history: [newHistoryEntry, ...prev.history.filter(h => h.id !== newHistoryEntry.id)], 
      }));

      // Devolver la entrada creada para que el llamador muestre el toast
      return newHistoryEntry;

    } catch (error: any) {
      console.error("Error registrando salida:", error);
      // Mostrar toast de error aquí
      toast({
        variant: "destructive",
        title: "Error al registrar salida",
        description: error.message || "Error desconocido",
      });
      throw error; // Relanzar para que el llamador sepa que falló
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

  const handleUpdateHistoryEntry = async (id: string, updates: Partial<ParkingHistory>) => {
    try {
      const response = await fetch(`/api/parking/history/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Podríamos necesitar añadir Authorization header si la API lo requiere
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Intenta parsear error, si no, objeto vacío
        throw new Error(errorData.error || `Error ${response.status} al actualizar el registro`);
      }

      const updatedEntry = await response.json();

      // Actualizar el estado local CON LA RESPUESTA DE LA API
      setParking(prev => ({
        ...prev,
        history: prev.history.map(entry => 
          entry.id === id ? { ...entry, ...updatedEntry } : entry
        ),
      }));

      // Ya no necesitamos el toast aquí, AdminPanel lo maneja
      // toast({ ... });

    } catch (error) {
      console.error("Error en handleUpdateHistoryEntry:", error);
      // Relanzar el error para que AdminPanel lo capture y muestre el toast de error
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

      const now = new Date(); // Crear fecha una sola vez
      const entryTimeISO = now.toISOString(); // Usar ISO para la API

      const response = await fetch("/api/parking/entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: entry.license_plate,
          type: entry.type,
          entry_time: entryTimeISO, // Enviar ISO a la API
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear nuevo registro de entrada");
      }

      // Crear el objeto para el estado local usando la misma fecha ISO
      const newVehicle: Vehicle = {
        license_plate: entry.license_plate,
        type: entry.type,
        entry_time: entryTimeISO, // Usar ISO también en el estado local
        user_id: user.id
      };

      // Actualizar estado
      setParking(prev => ({
        ...prev,
        parkedVehicles: [...prev.parkedVehicles, newVehicle],
        history: prev.history.filter(h => h.id !== entry.id)
      }));

      await fetchHistory(); // Recargar historial completo por si acaso

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
    let historyEntry: ParkingHistory | null = null;
    
    if (!exitingVehicle || !user) {
      toast({ variant: "destructive", title: "Error de estado", description: "No se encontró información del vehículo o usuario para confirmar." });
      setShowQRDialog(false); setQrData(null); setExitingVehicle(null);
      setPaymentMethodDialogOpen(false);
      return;
    }

    const exitTime = new Date();

    console.log("Parsing entry_time in handlePaymentConfirmation:", exitingVehicle.entry_time);
    const entryTimeDayjs = dayjs.utc(exitingVehicle.entry_time);
    let entryTime: Date;
    if (!entryTimeDayjs.isValid()) {
        toast({ variant: "destructive", title: "Error interno", description: "No se pudo parsear la fecha de entrada (Day.js)..." });
        setShowQRDialog(false); setQrData(null); setExitingVehicle(null); setPaymentMethodDialogOpen(false);
        return; 
    }
    entryTime = entryTimeDayjs.toDate();

    let fee = lastCalculatedFee;
    let diffInMinutes = 0;
    let durationStr = "Error calculando";

    diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
    durationStr = formatDuration(diffInMinutes * 60 * 1000);
    if (fee <= 0) {
        const durationHours = Math.max(diffInMinutes / 60, 1);
        const rate = parking.rates[exitingVehicle.type] || 0;
        fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;
    }
    
    if (success) {
      try {
        historyEntry = await registerExit(exitingVehicle, qrData ? 'qr' : 'mercadopago', fee, diffInMinutes, exitTime);
        setExitInfo({
          vehicle: exitingVehicle,
          fee: fee,
          exitTime: exitTime,
          duration: durationStr
        });
      } catch (error: any) {
        console.error("Error al registrar salida tras confirmación (ya se mostró toast de error):");
      }
    } else {
      toast({ title: "Confirmación cancelada", description: "El pago no fue marcado como exitoso." });
    }

    setShowQRDialog(false); 
    setQrData(null);
    setExitingVehicle(null);
    setPaymentMethodDialogOpen(false);

    if (historyEntry) {
        toast({
          title: "Pago confirmado y Salida registrada",
          description: `Vehículo ${historyEntry.license_plate} salió. Duración: ${formatDuration(historyEntry.duration)}`,
        });
    }
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
  
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <main className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Sistema de Gestión de Estacionamiento</h1>
        <div className="flex items-center gap-4">
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
          if (!open) {
            setExitingVehicle(null);
          }
        }}
        onSelectMethod={handlePaymentMethod}
        fee={lastCalculatedFee}
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
