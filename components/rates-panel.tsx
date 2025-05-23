"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehicleType } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "./ui/use-toast";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

interface SettingsPanelProps {
  // Rates prop is no longer strictly required as the component fetches its own
  // rates?: Record<VehicleType, number>; 
}

export default function SettingsPanel(/* { rates }: SettingsPanelProps */) {
  const { user, rates, userSettings, loadingUserData, fetchUserData } = useAuth();
  // State for rates - initialize with rates from context
  const [localRates, setLocalRates] = useState<Record<VehicleType, number> | null>(rates);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [mercadopagoApiKey, setMercadopagoApiKey] = useState(userSettings?.mercadopagoApiKey || "");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [bankAccountHolder, setBankAccountHolder] = useState(userSettings?.bankAccountHolder || "");
  const [bankAccountCbu, setBankAccountCbu] = useState(userSettings?.bankAccountCbu || "");
  const [bankAccountAlias, setBankAccountAlias] = useState(userSettings?.bankAccountAlias || "");
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);

  // Actualizar los estados locales cuando cambian los datos en el contexto
  useEffect(() => {
    if (rates) {
      setLocalRates(rates);
    }
    if (userSettings) {
      setMercadopagoApiKey(userSettings.mercadopagoApiKey || "");
      setBankAccountHolder(userSettings.bankAccountHolder || "");
      setBankAccountCbu(userSettings.bankAccountCbu || "");
      setBankAccountAlias(userSettings.bankAccountAlias || "");
    }
  }, [rates, userSettings]);

  const handleRateChange = (type: VehicleType, value: string) => {
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0) return;

    const newRates = { ...(localRates ?? {}), [type]: numericValue };
    setLocalRates(newRates as Record<VehicleType, number>);
  };

  const handleSaveRates = async () => {
    if (!user?.id || !localRates) return;
    setIsSavingRates(true);
    try {
      const response = await fetch("/api/rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id, rates: localRates }),
      });
      if (!response.ok) throw new Error("Error al actualizar tarifas");
      
      toast({ title: "Tarifas actualizadas", description: "Las tarifas se han guardado correctamente." });
      // Actualizar los datos en el contexto
      await fetchUserData();
    } catch (error) {
      console.error("Error al guardar tarifas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar las tarifas." });
    } finally {
      setIsSavingRates(false);
    }
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
        body: JSON.stringify({ userId: user.id, mercadopagoApiKey }),
      });
      if (!response.ok) throw new Error("Error al guardar API key");
      toast({ title: "API Key guardada", description: "La API Key de MercadoPago se ha guardado." });
      // Actualizar los datos en el contexto
      await fetchUserData();
    } catch (error) {
      console.error("Error al guardar API key:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la API Key." });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleSaveTransferDetails = async () => {
    if (!user?.id) return;
    setIsSavingTransfer(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          bankAccountHolder: bankAccountHolder,
          bankAccountCbu: bankAccountCbu,
          bankAccountAlias: bankAccountAlias
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al guardar datos de transferencia");
      }
      toast({ title: "Datos de Transferencia guardados", description: "La información se ha actualizado." });
      // Actualizar los datos en el contexto
      await fetchUserData();
    } catch (error: any) {
      console.error("Error al guardar datos de transferencia:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron guardar los datos de transferencia." });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  if (loadingUserData) {
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
          {localRates ? (
            Object.entries(localRates).map(([type, rate]) => (
              <div key={type} className="space-y-2">
                <Label htmlFor={`rate-${type}`} className="dark:text-zinc-400">{type}</Label>
                  <Input
                  id={`rate-${type}`}
                    type="number"
                    min="0"
                    step="0.01"
                  value={rate ?? ''}
                  onChange={(e) => handleRateChange(type as VehicleType, e.target.value)}
                  disabled={isSavingRates}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  />
                </div>
            ))
          ) : (
            <p className="dark:text-zinc-500">Error al cargar tarifas.</p>
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
            <Label htmlFor="bankHolder" className="dark:text-zinc-400">Nombre del Titular</Label>
            <Input id="bankHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} disabled={isSavingTransfer} placeholder="Nombre completo" className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankCbu" className="dark:text-zinc-400">CBU / CVU</Label>
            <Input id="bankCbu" value={bankAccountCbu} onChange={(e) => setBankAccountCbu(e.target.value)} disabled={isSavingTransfer} placeholder="22 dígitos (CBU) o Alias.CVU" className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAlias" className="dark:text-zinc-400">Alias</Label>
            <Input id="bankAlias" value={bankAccountAlias} onChange={(e) => setBankAccountAlias(e.target.value)} disabled={isSavingTransfer} placeholder="tu.alias.mp" className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          <div className="pt-4">
            <Button 
              onClick={handleSaveTransferDetails} 
              disabled={isSavingTransfer}
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isSavingTransfer ? "Guardando..." : "Guardar Datos Transferencia"}
            </Button>
            </div>
      </CardContent>
    </Card>
      
    </div>
  );
}
