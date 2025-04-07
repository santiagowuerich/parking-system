"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { VehicleType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RatesPanelProps {
  rates: Record<VehicleType, number>;
  onUpdateRate: (type: VehicleType, newRate: number) => void;
}

export default function RatesPanel({ rates, onUpdateRate }: RatesPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newRates, setNewRates] = useState(rates);
  const [apiKey, setApiKey] = useState("");
  const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isSavingRates, setIsSavingRates] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setIsLoadingKey(true);
      fetch(`/api/user/settings?userId=${user.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Error al cargar la API Key");
          return res.json();
        })
        .then((data) => {
          setApiKey(data.mercadopagoApiKey || "");
        })
        .catch((error) => {
          console.error("Error fetching API Key:", error);
          toast({
            title: "Error",
            description: "No se pudo cargar la API Key de MercadoPago.",
            variant: "destructive",
          });
        })
        .finally(() => setIsLoadingKey(false));
    }
  }, [user?.id]);

  const handleRateChange = (type: VehicleType, value: string) => {
    const rate = parseFloat(value);
    if (!isNaN(rate) && rate >= 0) {
      setNewRates((prevRates) => ({
        ...prevRates,
        [type]: rate,
      }));
    }
  };

  const handleUpdateRates = () => {
    setIsSavingRates(true);
    Object.entries(newRates).forEach(([type, rate]) => {
      if (rates[type as VehicleType] !== rate) {
        onUpdateRate(type as VehicleType, rate);
      }
    });
    setTimeout(() => setIsSavingRates(false), 1000);
    toast({
      title: "Éxito",
      description: "Tarifas actualizadas correctamente.",
    });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const handleSaveApiKey = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Usuario no autenticado.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingKey(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id, mercadopagoApiKey: apiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar la API Key");
      }

      toast({
        title: "Éxito",
        description: "API Key de MercadoPago guardada correctamente.",
      });
    } catch (error: any) {
      console.error("Error saving API Key:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la API Key.",
        variant: "destructive",
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Gestionar Tarifas por Hora</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Vehículo</TableHead>
                <TableHead className="text-right">Tarifa por Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(newRates).map(([type, rate]) => (
                <TableRow key={type}>
                  <TableCell className="font-medium capitalize">{type}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <span>$</span>
                      <Input
                        type="number"
                        value={rate.toString()}
                        onChange={(e) => handleRateChange(type as VehicleType, e.target.value)}
                        className="w-24 text-right"
                        min="0"
                        step="0.01"
                        disabled={isLoadingRates || isSavingRates}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleUpdateRates} disabled={isLoadingRates || isSavingRates}>
              {isSavingRates ? "Guardando..." : "Actualizar Tarifas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de MercadoPago</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key de Producción</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Ingresa tu API Key de Producción"
                value={apiKey}
                onChange={handleApiKeyChange}
                disabled={isLoadingKey || isSavingKey}
              />
              <p className="text-sm text-muted-foreground">
                Tu clave secreta para procesar pagos. Encuéntrala en tus{" "}
                <a
                  href="https://www.mercadopago.com/developers/panel/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  credenciales de MercadoPago
                </a>.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveApiKey} disabled={isLoadingKey || isSavingKey}>
                {isSavingKey ? "Guardando..." : "Guardar API Key"}
              </Button>
            </div>
            {isLoadingKey && <p className="text-sm text-muted-foreground text-center">Cargando configuración...</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
