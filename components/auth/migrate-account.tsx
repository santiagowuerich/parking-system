"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface MigrateAccountProps {
  email: string;
  oldUserId: string;
  onMigrate: () => void;
  onCancel: () => void;
}

export function MigrateAccount({
  email,
  oldUserId,
  onMigrate,
  onCancel,
}: MigrateAccountProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMigrate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          oldUserId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error migrating data");
      }

      onMigrate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Migrar Datos de Cuenta</CardTitle>
        <CardDescription>
          Se detectó que tienes datos en una cuenta anterior. ¿Deseas migrar estos datos a tu nueva cuenta?
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Esta acción migrará todos tus datos (vehículos estacionados, historial, tarifas y capacidad) 
            de tu cuenta anterior a tu nueva cuenta verificada.
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleMigrate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrando...
                </>
              ) : (
                "Migrar Datos"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 