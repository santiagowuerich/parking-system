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
  const { user } = useAuth();
  // State for rates - initialize as null or empty object
  const [localRates, setLocalRates] = useState<Record<VehicleType, number> | null>(null);
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [mercadopagoApiKey, setMercadopagoApiKey] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountCbu, setBankAccountCbu] = useState("");
  const [bankAccountAlias, setBankAccountAlias] = useState("");
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) {
        setIsLoadingSettings(false);
        return;
      }
      setIsLoadingSettings(true);
      try {
        const [ratesResponse, settingsResponse] = await Promise.all([
          fetch(`/api/rates?userId=${user.id}`),
          fetch(`/api/user/settings?userId=${user.id}`)
        ]);

        if (ratesResponse.ok) {
          const ratesData = await ratesResponse.json();
          setLocalRates(ratesData.rates || { Auto: 0, Moto: 0, Camioneta: 0 });
        } else {
          console.error("Error al cargar tarifas");
          setLocalRates({ Auto: 0, Moto: 0, Camioneta: 0 });
        }

        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setMercadopagoApiKey(settingsData.mercadopagoApiKey || "");
          setBankAccountHolder(settingsData.bankAccountHolder || "");
          setBankAccountCbu(settingsData.bankAccountCbu || "");
          setBankAccountAlias(settingsData.bankAccountAlias || "");
        } else {
          console.error("Error al cargar configuración del usuario");
          setMercadopagoApiKey("");
          setBankAccountHolder("");
          setBankAccountCbu("");
          setBankAccountAlias("");
        }

      } catch (error) {
        console.error("Error general al cargar configuración:", error);
        toast({ title: "Error", description: "No se pudo cargar la configuración.", variant: "destructive" });
        setLocalRates({ Auto: 0, Moto: 0, Camioneta: 0 });
        setMercadopagoApiKey("");
        setBankAccountHolder("");
        setBankAccountCbu("");
        setBankAccountAlias("");
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [user?.id]);

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
    } catch (error: any) {
      console.error("Error al guardar datos de transferencia:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron guardar los datos de transferencia." });
    } finally {
      setIsSavingTransfer(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
    <Card>
      <CardHeader>
          <CardTitle>Tarifas por Hora</CardTitle>
      </CardHeader>
        <CardContent className="space-y-4">
          {localRates ? (
            Object.entries(localRates).map(([type, rate]) => (
              <div key={type} className="space-y-2">
                <Label htmlFor={`rate-${type}`}>{type}</Label>
                  <Input
                  id={`rate-${type}`}
                    type="number"
                    min="0"
                    step="0.01"
                  value={rate ?? ''}
                  onChange={(e) => handleRateChange(type as VehicleType, e.target.value)}
                  disabled={isSavingRates}
                  />
                </div>
            ))
          ) : (
            <p>Error al cargar tarifas.</p>
          )}
          <div className="pt-4">
            <Button 
              onClick={handleSaveRates} 
              disabled={isSavingRates || !localRates}
              className="w-full"
            >
              {isSavingRates ? "Guardando..." : "Guardar Tarifas"}
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
              onChange={(e) => setMercadopagoApiKey(e.target.value)}
              placeholder="Ingresa tu API Key"
              disabled={isSavingApiKey}
            />
            <p className="text-xs text-muted-foreground">Tu Access Token de producción (APP_USR-...) o pruebas (TEST-...).</p>
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
      
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Transferencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankHolder">Nombre del Titular</Label>
            <Input id="bankHolder" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} disabled={isSavingTransfer} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankCbu">CBU / CVU</Label>
            <Input id="bankCbu" value={bankAccountCbu} onChange={(e) => setBankAccountCbu(e.target.value)} disabled={isSavingTransfer} placeholder="22 dígitos (CBU) o Alias.CVU" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAlias">Alias</Label>
            <Input id="bankAlias" value={bankAccountAlias} onChange={(e) => setBankAccountAlias(e.target.value)} disabled={isSavingTransfer} placeholder="tu.alias.mp" />
            </div>
          <div className="pt-4">
            <Button 
              onClick={handleSaveTransferDetails} 
              disabled={isSavingTransfer}
              className="w-full"
            >
              {isSavingTransfer ? "Guardando..." : "Guardar Datos Transferencia"}
            </Button>
            </div>
      </CardContent>
    </Card>
      
    </div>
  );
}
