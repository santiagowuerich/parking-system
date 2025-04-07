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

export default function ParkingApp() {
  const { user, loading } = useAuth();
  const [exitInfo, setExitInfo] = useState<any>(null);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [exitingVehicle, setExitingVehicle] = useState<Vehicle | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ code: string; fee: number } | null>(null);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [lastCalculatedFee, setLastCalculatedFee] = useState(0);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  const [parking, setParking] = useState<Parking>({
    capacity: {
      Auto: 50,
      Moto: 30,
      Camioneta: 20,
    },
    rates: {
      Auto: 10,
      Moto: 5,
      Camioneta: 15,
    },
    parkedVehicles: [],
    history: [],
  });

  const registerEntry = async (vehicle: Omit<Vehicle, "entryTime">) => {
    const newVehicle = {
      ...vehicle,
      entryTime: new Date(),
    };

    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debe iniciar sesión para registrar entradas"
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
          license_plate: newVehicle.licensePlate,
          type: newVehicle.type,
          entry_time: newVehicle.entryTime.toISOString(),
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
        description: `Se ha registrado la entrada del vehículo ${newVehicle.licensePlate}`
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
    if (!user) return;

    const vehicle = parking.parkedVehicles.find(v => v.licensePlate === licensePlate);
    if (!vehicle) {
      toast({ title: "Error", description: "Vehículo no encontrado", variant: "destructive" });
      return;
    }

    const exitTime = new Date();
    const entryTime = new Date(vehicle.entryTime);
    const duration = Math.abs(exitTime.getTime() - entryTime.getTime());
    const hours = duration / (1000 * 60 * 60);
    const fee = calculateFee(hours, parking.rates[vehicle.type]);

    setExitingVehicle(vehicle);
    setLastCalculatedFee(fee);
    setPaymentMethodDialogOpen(true);
  };

  const handlePaymentMethod = async (method: string) => {
    if (!exitingVehicle || !user) return;

    try {
      const exitTime = new Date();
      const entryTime = new Date(exitingVehicle.entryTime);
      const duration = Math.abs(exitTime.getTime() - entryTime.getTime());
      const fee = lastCalculatedFee;

      switch (method) {
        case 'efectivo':
        case 'transferencia':
          if (method === 'transferencia') {
            alert("Por favor, realiza la transferencia y confirma manualmente.");
          }
          await registerExit(exitingVehicle, method, fee, duration, exitTime);
          setPaymentMethodDialogOpen(false);
          setExitingVehicle(null);
          break;

        case 'mercadopago':
        case 'qr':
          try {
            const paymentType = method === 'qr' ? 'qr' : 'regular';
            const mpResponse = await fetch("/api/payment/mercadopago", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                licensePlate: exitingVehicle.licensePlate,
                fee: fee,
                vehicleType: exitingVehicle.type,
                paymentType: paymentType,
                userId: user.id
              }),
            });

            if (!mpResponse.ok) {
              const errorData = await mpResponse.json();
              console.error("Error de Mercado Pago:", errorData);
              throw new Error(errorData.error || `Error al generar ${method === 'qr' ? 'QR' : 'pago'}`);
            }

            const responseData = await mpResponse.json();

            if (method === 'qr') {
              if (responseData.qr_code || responseData.init_point) {
                setQrData({ code: responseData.qr_code || responseData.init_point, fee });
                setPaymentMethodDialogOpen(false);
                setQrDialogOpen(true);
              } else {
                throw new Error("No se pudo obtener el código QR o link de pago.");
              }
            } else {
              if (responseData.init_point) {
                window.open(responseData.init_point, '_blank');
                setPaymentMethodDialogOpen(false);
                setExitingVehicle(null);
                toast({
                  title: "Redireccionando a Mercado Pago",
                  description: "Completa el pago en la nueva pestaña.",
                });
              } else {
                throw new Error("No se pudo obtener el link de pago.");
              }
            }

          } catch (error: any) {
            console.error("Error con Mercado Pago:", error);
            toast({
              title: "Error de Pago",
              description: error.message || "No se pudo iniciar el proceso de pago.",
              variant: "destructive",
            });
          }
          break;

        default:
          console.warn("Método de pago no reconocido:", method);
          toast({ title: "Error", description: "Método de pago no válido." });
      }
    } catch (error: any) {
      console.error("Error al procesar método de pago:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al procesar la salida del vehículo",
      });
    }
  };

  const registerExit = async (
    vehicle: Vehicle,
    paymentMethod: string,
    fee: number,
    duration: number,
    exitTime: Date
  ) => {
    try {
      const response = await fetch("/api/parking/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: vehicle.licensePlate,
          type: vehicle.type,
          entry_time: vehicle.entryTime,
          exit_time: exitTime,
          duration,
          fee,
          payment_method: paymentMethod,
          user_id: user?.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al registrar la salida");
      }

      const historyEntry = await response.json();

      setParking((prev) => ({
        ...prev,
        parkedVehicles: prev.parkedVehicles.filter(
          (v) => v.licensePlate !== vehicle.licensePlate
        ),
        history: [historyEntry, ...prev.history],
      }));

      toast({
        title: "Salida registrada",
        description: `Vehículo ${vehicle.licensePlate} salió. Tarifa: ${formatDuration(duration)}`,
      });

      if (qrDialogOpen) {
        setQrDialogOpen(false);
        setQrData(null);
        setExitingVehicle(null);
      }

      window.location.reload();

    } catch (error: any) {
      console.error("Error registrando salida:", error);
      toast({
        variant: "destructive",
        title: "Error al registrar salida",
        description: error.message,
      });
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
    try {
      const resHistory = await fetch("/api/parking/history", {
        headers: {
          "user-id": user?.id || "",
        } as HeadersInit,
      });

      if (!resHistory.ok) {
        throw new Error("Error al obtener datos del servidor");
      }

      const historyData = await resHistory.json();

      if (!Array.isArray(historyData)) {
        console.error("historyData no es un arreglo:", historyData);
        throw new Error("Formato de datos de historial inválido");
      }

      const history = historyData.map((h: any) => ({
        id: h.id,
        licensePlate: h.license_plate,
        type: h.type,
        entryTime: new Date(h.entry_time + 'Z'),
        exitTime: new Date(h.exit_time + 'Z'),
        duration: typeof h.duration === 'number' ? h.duration : parseInt(h.duration),
        fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee),
        userId: h.user_id,
        paymentMethod: h.payment_method || 'No especificado'
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
        v => v.licensePlate === entry.licensePlate
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
          license_plate: entry.licensePlate,
          type: entry.type,
          entry_time: new Date().toISOString(),
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear nuevo registro de entrada");
      }

      const newVehicle = {
        licensePlate: entry.licensePlate,
        type: entry.type,
        entryTime: new Date(),
        userId: user.id
      };

      setParking(prev => ({
        ...prev,
        parkedVehicles: [...prev.parkedVehicles, newVehicle],
        history: prev.history.filter(h => h.id !== entry.id)
      }));

      await fetchHistory();

      toast({
        title: "Vehículo reingresado",
        description: `El vehículo ${entry.licensePlate} ha sido reingresado exitosamente.`,
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
    if (!open) {
      setQrDialogOpen(false);
      setQrData(null);
      if (exitingVehicle && !parking.parkedVehicles.find(v => v.licensePlate === exitingVehicle.licensePlate)) {
        setParking(prev => ({...prev, parkedVehicles: [exitingVehicle, ...prev.parkedVehicles]}));
      }
      setExitingVehicle(null);
      toast({ title: "Pago cancelado", description: "El proceso de pago con QR fue cancelado." });
    }
  };

  const handlePaymentConfirmation = async (success: boolean) => {
    if (!exitingVehicle || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se encontró información del vehículo o usuario.",
      });
      return;
    }

    if (success) {
      const exitTime = new Date();
      const entryTime = new Date(exitingVehicle.entryTime);
      const duration = Math.abs(exitTime.getTime() - entryTime.getTime());
      
      try {
        await registerExit(exitingVehicle, 'qr', lastCalculatedFee, duration, exitTime);
        toast({
          title: "Pago confirmado",
          description: "El pago se ha registrado correctamente.",
        });

        // Limpiar estados
        setQrDialogOpen(false);
        setQrData(null);
        setExitingVehicle(null);
        setPaymentMethodDialogOpen(false);

      } catch (error: any) {
        console.error("Error al registrar salida:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo registrar la salida. Por favor, intente nuevamente.",
        });
        // Restaurar el vehículo a la lista si hubo error
        if (!parking.parkedVehicles.some(v => v.licensePlate === exitingVehicle.licensePlate)) {
          setParking(prev => ({
            ...prev,
            parkedVehicles: [exitingVehicle, ...prev.parkedVehicles]
          }));
        }
      }
    } else {
      // Si el pago no fue exitoso
      if (!parking.parkedVehicles.some(v => v.licensePlate === exitingVehicle.licensePlate)) {
        setParking(prev => ({
          ...prev,
          parkedVehicles: [exitingVehicle, ...prev.parkedVehicles]
        }));
      }
      
      setPaymentMethodDialogOpen(true);
      toast({
        title: "Pago no completado",
        description: "Por favor, seleccione otro método de pago o intente nuevamente.",
      });
    }

    // Limpiar estados del QR
    setQrDialogOpen(false);
    setQrData(null);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resParked, resHistory] = await Promise.all([
          fetch("/api/parking/parked", {
            headers: {
              "user-id": user?.id || "",
            } as HeadersInit,
          }),
          fetch("/api/parking/history", {
            headers: {
              "user-id": user?.id || "",
            } as HeadersInit,
          }),
        ]);

        if (!resParked.ok || !resHistory.ok) {
          throw new Error("Error al obtener datos del servidor");
        }

        const parkedData = await resParked.json();
        const historyData = await resHistory.json();

        if (!Array.isArray(parkedData)) {
          console.error("parkedData no es un arreglo:", parkedData);
          throw new Error("Formato de datos de vehículos estacionados inválido");
        }

        if (!Array.isArray(historyData)) {
          console.error("historyData no es un arreglo:", historyData);
          throw new Error("Formato de datos de historial inválido");
        }

        const uniqueParkedVehicles = parkedData.reduce((acc: any[], v: any) => {
          const exists = acc.find(x => x.license_plate === v.license_plate);
          if (!exists) {
            acc.push(v);
          }
          return acc;
        }, []);

        const parkedVehicles = uniqueParkedVehicles.map((v: any) => ({
          licensePlate: v.license_plate,
          type: v.type,
          entryTime: new Date(v.entry_time + 'Z'),
          userId: v.user_id,
        }));

        const history = historyData.map((h: any) => ({
          id: h.id,
          licensePlate: h.license_plate,
          type: h.type,
          entryTime: new Date(h.entry_time + 'Z'),
          exitTime: new Date(h.exit_time + 'Z'),
          duration: typeof h.duration === 'number' ? h.duration : parseInt(h.duration),
          fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee),
          userId: h.user_id,
          paymentMethod: h.payment_method || 'No especificado'
        })) as ParkingHistory[];

        setParking((prev) => ({
          ...prev,
          parkedVehicles,
          history,
        }));

        if (parkedData.length !== uniqueParkedVehicles.length) {
          console.warn("Se detectaron vehículos duplicados, limpiando...");
          const response = await fetch("/api/parking/cleanup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "user-id": user?.id || "",
            },
          });
          if (!response.ok) {
            console.error("Error al limpiar registros duplicados");
          }
        }
      } catch (err) {
        console.error("❌ Error al cargar datos desde Supabase:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar datos. Por favor, intente nuevamente.",
        });
      }
    };

    if (user && !loading) {
      fetchData();
    }
  }, [user, loading]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
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
        <UserNav />
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
        onOpenChange={setPaymentMethodDialogOpen}
        onSelectMethod={handlePaymentMethod}
        fee={lastCalculatedFee || (exitingVehicle ? calculateFee(calculateHours(exitingVehicle.entryTime), parking.rates[exitingVehicle.type]) : 0)}
      />

      <QRDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        qrCode={qrData?.code || ""}
        fee={qrData?.fee || 0}
        onConfirmPayment={handlePaymentConfirmation}
      />

      <PaymentConfirmationDialog
        open={paymentConfirmationOpen}
        onOpenChange={setPaymentConfirmationOpen}
        onConfirm={handlePaymentConfirmation}
      />
    </main>
  );
}

function calculateHours(entryTime: Date): number {
  const duration = Math.abs(new Date().getTime() - new Date(entryTime).getTime());
  return duration / (1000 * 60 * 60);
}
