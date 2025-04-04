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

export default function ParkingApp() {
  const { user, loading } = useAuth();

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

    try {
      await fetch("/api/parking/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_plate: newVehicle.licensePlate,
          type: newVehicle.type,
          entry_time: newVehicle.entryTime.toISOString(),
        }),
      });
    } catch (err) {
      console.error("❌ Error al guardar entrada en Supabase", err);
      alert("Error al registrar la entrada.");
    }

    setParking((prev) => ({
      ...prev,
      parkedVehicles: [...prev.parkedVehicles, newVehicle],
    }));
  };

  const registerExit = async (licensePlate: string) => {
    const exitTime = new Date();
    const vehicle = parking.parkedVehicles.find((v) => v.licensePlate === licensePlate);
    if (!vehicle) return null;

    const durationMs = exitTime.getTime() - vehicle.entryTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const fee = calculateFee(durationHours, parking.rates[vehicle.type]);

    const historyEntry: ParkingHistory = {
      ...vehicle,
      exitTime,
      duration: durationMs,
      fee,
    };

    try {
      await fetch("/api/parking/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_plate: vehicle.licensePlate,
          type: vehicle.type,
          entry_time: vehicle.entryTime,
          exit_time: exitTime,
          duration: durationMs,
          fee,
        }),
      });

      const deleteResponse = await fetch(`/api/parking/parked/${vehicle.licensePlate}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        console.error("❌ Error al eliminar vehículo de Supabase", errorData);
        alert("Error al eliminar el vehículo.");
        return;
      }

      setParking((prev) => ({
        ...prev,
        parkedVehicles: prev.parkedVehicles.filter((v) => v.licensePlate !== licensePlate),
        history: [historyEntry, ...prev.history],
      }));
    } catch (err) {
      console.error("❌ Error al registrar salida o eliminar vehículo en Supabase", err);
      alert("Error al registrar la salida.");
    }

    return {
      vehicle,
      exitTime,
      duration: formatDuration(durationMs),
      fee,
    };
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resParked, resHistory] = await Promise.all([
          fetch("/api/parking/parked"),
          fetch("/api/parking/history"),
        ]);

        const parkedData = await resParked.json();
        const historyData = await resHistory.json();

        const parkedVehicles = parkedData.map((v: any) => ({
          licensePlate: v.license_plate,
          type: v.type,
          entryTime: new Date(v.entry_time),
        }));

        const history = historyData.map((h: any) => ({
          licensePlate: h.license_plate,
          type: h.type,
          entryTime: new Date(h.entry_time),
          exitTime: new Date(h.exit_time),
          duration: h.duration,
          fee: h.fee,
        }));

        setParking((prev) => ({
          ...prev,
          parkedVehicles,
          history,
        }));
      } catch (err) {
        console.error("❌ Error al cargar datos desde Supabase", err);
        alert("Error al cargar datos.");
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
            onRegisterExit={registerExit}
          />
        </TabsContent>

        <TabsContent value="admin">
          <AdminPanel
            history={parking.history}
            availableSpaces={getAvailableSpaces()}
            capacity={parking.capacity}
            onUpdateCapacity={updateCapacity}
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