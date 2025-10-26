"use client";

import { ReactNode } from "react";
import { useTurnos } from "@/lib/hooks/use-turnos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Clock } from "lucide-react";
import Link from "next/link";

interface TurnoGuardProps {
  children: ReactNode;
  requireActiveTurn?: boolean; // Default: true
  fallback?: ReactNode; // UI personalizada cuando no hay turno
  showAlert?: boolean; // Mostrar alert en lugar de fallback
  redirectButton?: boolean; // Mostrar botón para ir a turnos
}

/**
 * Componente Guard para proteger acciones operativas
 * Verifica que el playero tenga un turno activo antes de permitir ciertas acciones
 * Los owners bypasan esta verificación
 */
export function TurnoGuard({
  children,
  requireActiveTurn = true,
  fallback,
  showAlert = false,
  redirectButton = true,
}: TurnoGuardProps) {
  const { tieneTurnoActivo, loading, isEmployee } = useTurnos();

  // Si no es empleado (owner), no aplicar guard
  if (!isEmployee) {
    return <>{children}</>;
  }

  // Mostrar loading
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Si requiere turno activo y NO lo tiene
  if (requireActiveTurn && !tieneTurnoActivo) {
    // Mostrar alert
    if (showAlert) {
      return (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Turno no iniciado</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Debes iniciar tu turno en la sección de{" "}
              <Link href="/dashboard/mis-turnos" className="font-semibold underline hover:text-red-800">
                Mis Turnos
              </Link>{" "}
              antes de realizar esta acción.
            </p>
            {redirectButton && (
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/mis-turnos">
                    <Clock className="h-4 w-4 mr-2" />
                    Ir a Mis Turnos
                  </Link>
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    // Mostrar fallback personalizado
    if (fallback) {
      return <>{fallback}</>;
    }

    // Por defecto, no renderizar nada
    return null;
  }

  // Tiene turno activo o no se requiere, renderizar children
  return <>{children}</>;
}
