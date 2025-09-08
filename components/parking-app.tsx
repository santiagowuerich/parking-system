"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Settings, CreditCard, MapPin, Users, BarChart3, Shield, ParkingCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function ParkingApp() {
  const { user, loading: authLoading, estId } = useAuth();
  const router = useRouter();

  // Quick actions for dashboard
  const quickActions = [
    {
      title: "Panel de Operador",
      description: "Gestionar entradas y salidas de vehiculos",
      icon: ParkingCircle,
      href: "/dashboard/operador",
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      title: "Panel de Administrador",
      description: "Configurar capacidad y ver estadisticas",
      icon: Shield,
      href: "/dashboard/admin",
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      title: "Mis Estacionamientos",
      description: "Administrar multiples estacionamientos",
      icon: Car,
      href: "/dashboard/parking",
      color: "bg-purple-500 hover:bg-purple-600"
    },
    {
      title: "Plantillas",
      description: "Gestionar plantillas de plazas",
      icon: Settings,
      href: "/dashboard/plantillas",
      color: "bg-orange-500 hover:bg-orange-600"
    },
    {
      title: "Tarifas",
      description: "Configurar precios y tarifas",
      icon: CreditCard,
      href: "/dashboard/tarifas",
      color: "bg-red-500 hover:bg-red-600"
    },
    {
      title: "Google Maps",
      description: "Configurar ubicacion y mapas",
      icon: MapPin,
      href: "/dashboard/google-maps",
      color: "bg-indigo-500 hover:bg-indigo-600"
    },
    {
      title: "Empleados",
      description: "Gestionar empleados del sistema",
      icon: Users,
      href: "/dashboard/empleados",
      color: "bg-pink-500 hover:bg-pink-600"
    },
    {
      title: "Pagos",
      description: "Historial de pagos y finanzas",
      icon: BarChart3,
      href: "/dashboard/payments",
      color: "bg-teal-500 hover:bg-teal-600"
    }
  ];

  const handleNavigate = (href: string) => {
    router.push(href);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-zinc-100 mb-2">
          Dashboard Principal
        </h1>
        <p className="text-xl text-gray-600 dark:text-zinc-400">
          Bienvenido al sistema de gestion de estacionamientos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.href} className="group hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${action.color} text-white`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors duration-200">
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                  {action.description}
                </p>
                <Button
                  onClick={() => handleNavigate(action.href)}
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200"
                  variant="outline"
                >
                  Acceder
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {estId && (
        <div className="mt-8">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <ParkingCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                    Estacionamiento Activo
                  </h3>
                  <p className="text-gray-600 dark:text-zinc-400">
                    ID: {estId} - Gestionando este estacionamiento actualmente
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}