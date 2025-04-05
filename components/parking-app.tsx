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

export default function ParkingApp() {
  const { user, loading } = useAuth();
  const [exitInfo, setExitInfo] = useState<any>(null);

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
    const newVehicle: Vehicle = {
      ...vehicle,
      entryTime: new Date(),
    };

    if (!user?.id) {
      console.error("❌ Error: No hay usuario autenticado");
      alert("Error: Debe iniciar sesión para registrar entradas");
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

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Error al guardar entrada:", errorData);
        alert("Error al registrar la entrada del vehículo.");
        return;
      }

      setParking((prev) => ({
        ...prev,
        parkedVehicles: [...prev.parkedVehicles, newVehicle],
      }));
    } catch (err) {
      console.error("❌ Error al guardar entrada en Supabase:", err);
      alert("Error al registrar la entrada del vehículo.");
    }
  };

  const handleExit = async (licensePlate: string) => {
    try {
      const vehicle = parking.parkedVehicles.find(
        (v) => v.licensePlate === licensePlate
      );

      if (!vehicle) {
        throw new Error("Vehículo no encontrado");
      }

      const exitTime = new Date();
      const entryTime = new Date(vehicle.entryTime);
      const duration = Math.abs(exitTime.getTime() - entryTime.getTime());
      const hours = duration / (1000 * 60 * 60);
      const fee = calculateFee(hours, parking.rates[vehicle.type]);

      const response = await fetch("/api/parking/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: vehicle.licensePlate,
          type: vehicle.type,
          entry_time: entryTime.toISOString(),
          exit_time: exitTime.toISOString(),
          duration,
          fee,
          user_id: user?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al registrar la salida");
      }

      const data = await response.json();

      // Actualizar el estado local con el nuevo registro del historial
      const newHistoryEntry: ParkingHistory = {
        id: data.id,
        licensePlate: vehicle.licensePlate,
        type: vehicle.type,
        entryTime: new Date(entryTime),
        exitTime: new Date(exitTime),
        duration,
        fee
      };

      setParking((prev) => ({
        ...prev,
        parkedVehicles: prev.parkedVehicles.filter(
          (v) => v.licensePlate !== licensePlate
        ),
        history: [...prev.history, newHistoryEntry],
      }));

      // Actualizar la información de salida
      setExitInfo({
        vehicle: {
          licensePlate: vehicle.licensePlate,
          type: vehicle.type,
          entryTime: entryTime
        },
        exitTime,
        duration: formatDuration(duration),
        fee: fee
      });
    } catch (error) {
      console.error("Error al procesar la salida:", error);
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

      // Actualizar el estado local solo si la eliminación fue exitosa
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

      // Actualizar el estado local
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
        fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee)
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
      // Primero, eliminamos el registro de salida
      await handleDeleteHistoryEntry(entry.id);

      // Luego, creamos un nuevo registro de entrada
      const response = await fetch("/api/parking/entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          license_plate: entry.licensePlate,
          type: entry.type,
          entry_time: entry.entryTime.toISOString(),
          user_id: user.id
        }),
      });

      if (!response.ok) {
        throw new Error("Error al crear nuevo registro de entrada");
      }

      const newEntry = await response.json();

      // Actualizamos el estado local
      setParking((prev) => ({
        ...prev,
        parkedVehicles: [
          ...prev.parkedVehicles,
          {
            licensePlate: entry.licensePlate,
            type: entry.type,
            entryTime: new Date(entry.entryTime),
            userId: user.id
          }
        ],
      }));

      // Actualizamos el historial
      await fetchHistory();
    } catch (error) {
      console.error("Error al reingresar vehículo:", error);
      throw new Error("Error al reingresar el vehículo");
    }
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

        // Validar que los datos sean arreglos
        if (!Array.isArray(parkedData)) {
          console.error("parkedData no es un arreglo:", parkedData);
          throw new Error("Formato de datos de vehículos estacionados inválido");
        }

        if (!Array.isArray(historyData)) {
          console.error("historyData no es un arreglo:", historyData);
          throw new Error("Formato de datos de historial inválido");
        }

        const parkedVehicles = parkedData.map((v: any) => ({
          licensePlate: v.license_plate,
          type: v.type,
          entryTime: new Date(v.entry_time + 'Z'),
        }));

        const history = historyData.map((h: any) => ({
          id: h.id,
          licensePlate: h.license_plate,
          type: h.type,
          entryTime: new Date(h.entry_time + 'Z'),
          exitTime: new Date(h.exit_time + 'Z'),
          duration: typeof h.duration === 'number' ? h.duration : parseInt(h.duration),
          fee: typeof h.fee === 'number' ? h.fee : parseFloat(h.fee)
        })) as ParkingHistory[];

        setParking((prev) => ({
          ...prev,
          parkedVehicles,
          history,
        }));
      } catch (err) {
        console.error("❌ Error al cargar datos desde Supabase:", err);
        alert("Error al cargar datos. Por favor, intente nuevamente.");
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
    </main>
  );
}
