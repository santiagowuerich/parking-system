"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehicleType } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "./ui/use-toast";
import { Button } from "./ui/button";

interface RatesPanelProps {
  rates: Record<VehicleType, number>;
  onUpdateRate: (type: VehicleType, rate: number) => void;
}

export default function RatesPanel({ rates, onUpdateRate }: RatesPanelProps) {
  const { user } = useAuth();
  const [localRates, setLocalRates] = useState<Record<VehicleType, number> | null>(null);
  const [mercadopagoApiKey, setMercadopagoApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  useEffect(() => {
    setLocalRates(rates);
  }, [rates]);

  useEffect(() => {
    // Cargar API key de MercadoPago
    const fetchApiKey = async () => {
      try {
        const response = await fetch(`/api/user/settings?userId=${user?.id}`);
        const data = await response.json();
        if (data.mercadopagoApiKey) {
          setMercadopagoApiKey(data.mercadopagoApiKey);
        }
      } catch (error) {
        console.error("Error al cargar API key:", error);
      }
    };

    if (user?.id) {
      fetchApiKey();
    }
  }, [user?.id]);

  if (!localRates) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const handleRateChange = (type: VehicleType, value: string) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0) return;

    const newRates = { ...localRates, [type]: numericValue };
    setLocalRates(newRates);
  };

  const handleSaveRates = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      const response = await fetch("/api/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          rates: localRates,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar tarifas");
      }

      // Actualizar las tarifas en el componente padre
      Object.entries(localRates).forEach(([type, rate]) => {
        onUpdateRate(type as VehicleType, Number(rate));
      });

      toast({
        title: "Tarifas actualizadas",
        description: "Las tarifas se han guardado correctamente.",
      });
    } catch (error) {
      console.error("Error al guardar tarifas:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar las tarifas.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApiKeyChange = (value: string) => {
    setMercadopagoApiKey(value);
  };

  const handleSaveApiKey = async () => {
    if (!user?.id) return;
    setIsSavingApiKey(true);

    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          mercadopagoApiKey: mercadopagoApiKey,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar API key");
      }

      toast({
        title: "API Key guardada",
        description: "La API Key de MercadoPago se ha guardado correctamente.",
      });
    } catch (error) {
      console.error("Error al guardar API key:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la API Key.",
      });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tarifas por Hora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(localRates).map(([type, rate]) => (
            <div key={type} className="space-y-2">
              <Label htmlFor={`rate-${type}`}>{type}</Label>
              <Input
                id={`rate-${type}`}
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => handleRateChange(type as VehicleType, e.target.value)}
              />
            </div>
          ))}
          <div className="pt-4">
            <Button 
              onClick={handleSaveRates} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? "Guardando..." : "Guardar Tarifas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de MercadoPago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mercadopago-api-key">API Key</Label>
            <Input
              id="mercadopago-api-key"
              type="password"
              value={mercadopagoApiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Ingresa tu API Key de MercadoPago"
            />
          </div>
          <div className="pt-2">
            <Button 
              onClick={handleSaveApiKey} 
              disabled={isSavingApiKey}
              className="w-full"
            >
              {isSavingApiKey ? "Guardando..." : "Guardar API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
