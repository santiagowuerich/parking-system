"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "../lib/use-user-role";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, AlertCircle } from "lucide-react";

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: ('owner' | 'playero')[];
  redirectTo?: string;
  showAccessDenied?: boolean;
  fallback?: ReactNode;
}

export function RouteGuard({
  children,
  allowedRoles,
  redirectTo = '/dashboard',
  showAccessDenied = true,
  fallback
}: RouteGuardProps) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const isUnknown = role === null;
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Verificar que estamos en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Manejar redirecciones en el cliente
  useEffect(() => {
    if (!isClient || roleLoading) return;

    // No authenticated user
    if (!user) {
      console.log('🚫 Usuario no autenticado, redirigiendo a login');
      router.push('/auth/login');
      return;
    }

    // User has unknown role (sin showAccessDenied)
    if (isUnknown && !showAccessDenied) {
      console.log('❓ Usuario con rol desconocido, redirigiendo a login');
      router.push('/auth/login');
      return;
    }

    // User without required role (sin showAccessDenied)
    if (role && !allowedRoles.includes(role as 'owner' | 'playero') && !showAccessDenied) {
      console.log(`🚫 Usuario con rol '${role}' redirigiendo a ${redirectTo}`);
      router.push(redirectTo);
      return;
    }
  }, [isClient, user, role, isUnknown, roleLoading, router, allowedRoles, redirectTo, showAccessDenied]);

  // Durante SSR o mientras se inicializa el cliente, mostrar loading
  if (!isClient || roleLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Verificando permisos...</h3>
            <p className="text-sm text-muted-foreground">
              Estamos determinando tu rol en el sistema
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No authenticated user
  if (!user) {
    return null; // La redirección se maneja en useEffect
  }

  // User has unknown role
  if (isUnknown) {
    console.log('❓ Usuario con rol desconocido');

    if (showAccessDenied) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-6 max-w-md mx-auto p-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-yellow-100 p-3">
                <AlertCircle className="h-12 w-12 text-yellow-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Acceso Restringido
              </h2>
              <p className="text-gray-600">
                Tu cuenta no tiene permisos asignados en el sistema.
                Por favor, contacta al administrador.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full"
              >
                Cerrar Sesión
              </Button>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              <p className="font-medium mb-1">¿Necesitas ayuda?</p>
              <p>Contacta al soporte técnico para resolver este problema.</p>
            </div>
          </div>
        </div>
      );
    }

    return null; // La redirección se maneja en useEffect
  }

  // Check if user has required role
  if (!allowedRoles.includes(role as 'owner' | 'playero')) {
    console.log(`🚫 Usuario con rol '${role}' intentando acceder a ruta protegida para roles:`, allowedRoles);

    if (showAccessDenied) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-6 max-w-md mx-auto p-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-3">
                <Shield className="h-12 w-12 text-red-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                Acceso Denegado
              </h2>
              <p className="text-gray-600">
                No tienes permisos para acceder a esta página.
                Tu rol actual es: <strong className="text-primary">{role}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push(redirectTo)}
                className="w-full"
              >
                Volver al Dashboard
              </Button>
              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full"
              >
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null; // La redirección se maneja en useEffect
  }

  // User has access
  console.log(`✅ Usuario con rol '${role}' tiene acceso permitido`);
  return <>{children}</>;
}
