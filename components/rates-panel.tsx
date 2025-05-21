"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VehicleType, Rates, UserSettings } from "@/lib/types";
import { toast } from "./ui/use-toast";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

interface SettingsPanelProps {
  initialRates: Rates | null;
  initialUserSettings: UserSettings | null;
  onSaveRates: (newRates: Rates) => Promise<void>;
  onSaveUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  userId: string;
}

export default function SettingsPanel({
  initialRates,
  initialUserSettings,
  onSaveRates,
  onSaveUserSettings,
  userId 
}: SettingsPanelProps) {
  const [localRates, setLocalRates] = useState<Rates | null>(initialRates);
  const [isSavingRates, setIsSavingRates] = useState(false);
  
  const [mercadopagoApiKey, setMercadopagoApiKey] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountCbu, setBankAccountCbu] = useState("");
  const [bankAccountAlias, setBankAccountAlias] = useState("");
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    if (initialRates) {
      setLocalRates(initialRates);
    }
    if (initialUserSettings) {
      setMercadopagoApiKey(initialUserSettings.mercadopagoApiKey || "");
      setBankAccountHolder(initialUserSettings.bankAccountHolder || "");
      setBankAccountCbu(initialUserSettings.bankAccountCbu || "");
      setBankAccountAlias(initialUserSettings.bankAccountAlias || "");
    }
    setIsLoading(false);
  }, [initialRates, initialUserSettings]);

  const handleRateChange = (type: VehicleType, value: string) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0) {
      const currentRate = localRates ? localRates[type] : '';
      const input = document.getElementById(`rate-${type}`) as HTMLInputElement;
      if (input) input.value = String(currentRate || 0);
      return;
    }

    const newRates = { 
      ...(localRates ?? { Auto: 0, Moto: 0, Camioneta: 0 }),
      [type]: numericValue 
    } as Rates;
    setLocalRates(newRates);
  };

  const handleSaveRates = async () => {
    if (!localRates) {
        toast({ title: "Error", description: "No hay tarifas para guardar.", variant: "destructive" });
        return;
    }
    setIsSavingRates(true);
    try {
      await onSaveRates(localRates);
      toast({ title: "Tarifas actualizadas", description: "Las tarifas se han guardado correctamente." });
    } catch (error) {
      console.error("Error al guardar tarifas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar las tarifas." });
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleSaveApiKey = async () => {
    setIsSavingApiKey(true);
    try {
      await onSaveUserSettings({ mercadopagoApiKey });
      toast({ title: "API Key guardada", description: "La API Key de MercadoPago se ha guardado." });
    } catch (error) {
      console.error("Error al guardar API key:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la API Key." });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSaveTransferDetails = async () => {
    setIsSavingTransfer(true);
    try {
      await onSaveUserSettings({
        bankAccountHolder: bankAccountHolder,
        bankAccountCbu: bankAccountCbu,
        bankAccountAlias: bankAccountAlias
      }); 
      toast({ title: "Datos de Transferencia guardados", description: "La información se ha actualizado." });
    } catch (error: any) {
      console.error("Error al guardar datos de transferencia:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron guardar los datos de transferencia." });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader><Skeleton className="h-6 w-3/4 dark:bg-zinc-800" /></CardHeader>
          <CardContent><Skeleton className="h-40 w-full dark:bg-zinc-800" /></CardContent>
        </Card>
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader><Skeleton className="h-6 w-3/4 dark:bg-zinc-800" /></CardHeader>
          <CardContent><Skeleton className="h-20 w-full dark:bg-zinc-800" /></CardContent>
        </Card>
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader><Skeleton className="h-6 w-3/4 dark:bg-zinc-800" /></CardHeader>
          <CardContent><Skeleton className="h-32 w-full dark:bg-zinc-800" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
    <Card className="dark:bg-zinc-900 dark:border-zinc-800">
      <CardHeader>
          <CardTitle className="dark:text-zinc-100">Tarifas por Hora</CardTitle>
      </CardHeader>
        <CardContent className="space-y-4">
          {(localRates ? Object.entries(localRates) : []).map(([type, rate]) => (
              <div key={type} className="space-y-2">
                <Label htmlFor={`rate-${type}`} className="dark:text-zinc-400">{type}</Label>
                  <Input
                  id={`rate-${type}`}
                    type="number"
                    min="0"
                    step="0.01"
                  value={localRates?.[type as VehicleType] ?? 0} 
                  onChange={(e) => handleRateChange(type as VehicleType, e.target.value)}
                  disabled={isSavingRates}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  />
                </div>
            ))}
            {!localRates && (
                <p className="dark:text-zinc-500">Cargando tarifas o no disponibles...</p>
            )}
          <div className="pt-4">
            <Button 
              onClick={handleSaveRates} 
              disabled={isSavingRates || !localRates}
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isSavingRates ? "Guardando..." : "Guardar Tarifas"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configuración de MercadoPago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mercadopago-api-key" className="dark:text-zinc-400">API Key</Label>
            <Input
              id="mercadopago-api-key"
              type="password"
              value={mercadopagoApiKey}
              onChange={(e) => setMercadopagoApiKey(e.target.value)}
              placeholder="Ingresa tu API Key"
              disabled={isSavingApiKey}
              className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
            <p className="text-xs text-muted-foreground dark:text-zinc-500">Tu Access Token de producción (APP_USR-...) o pruebas (TEST-...).</p>
          </div>
          <div className="pt-2">
            <Button 
              onClick={handleSaveApiKey} 
              disabled={isSavingApiKey}
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isSavingApiKey ? "Guardando..." : "Guardar API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configuración de Transferencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="bank-holder" className="dark:text-zinc-400">Nombre del Titular</Label>
                <Input id="bank-holder" value={bankAccountHolder} onChange={e => setBankAccountHolder(e.target.value)} disabled={isSavingTransfer} className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="bank-cbu" className="dark:text-zinc-400">CBU/CVU</Label>
                <Input id="bank-cbu" value={bankAccountCbu} onChange={e => setBankAccountCbu(e.target.value)} disabled={isSavingTransfer} className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="bank-alias" className="dark:text-zinc-400">Alias</Label>
                <Input id="bank-alias" value={bankAccountAlias} onChange={e => setBankAccountAlias(e.target.value)} disabled={isSavingTransfer} className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
            <div className="pt-2">
                <Button onClick={handleSaveTransferDetails} disabled={isSavingTransfer} className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200">
                    {isSavingTransfer ? "Guardando..." : "Guardar Datos de Transferencia"}
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
