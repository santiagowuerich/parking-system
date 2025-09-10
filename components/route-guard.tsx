"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRole } from "@/lib/use-role";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, AlertCircle } from "lucide-react";

interface RouteGuardProps {
  children: ReactNode;
  allowedRoles: ('owner' | 'playero' | 'conductor')[];
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
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, isUnknown } = useRole();
  const router = useRouter();

  // Loading state
  if (authLoading || roleLoading) {
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
    console.log('🚫 Usuario no autenticado, redirigiendo a login');
    router.push('/auth/login');
    return null;
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

    router.push('/auth/login');
    return null;
  }

  // Check if user has required role
  if (!allowedRoles.includes(role)) {
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

    router.push(redirectTo);
    return null;
  }

  // User has access
  console.log(`✅ Usuario con rol '${role}' tiene acceso permitido`);
  return <>{children}</>;
}
