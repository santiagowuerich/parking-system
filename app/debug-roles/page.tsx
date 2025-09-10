"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle, User, Crown, Users, Building } from "lucide-react";

interface DiagnosticoData {
  resumen: {
    totalUsuarios: number;
    totalDuenos: number;
    totalPlayeros: number;
    totalAsignaciones: number;
    totalConflictos: number;
  };
  usuarios: Array<{
    usu_id: number;
    usu_nom: string;
    usu_ape: string;
    usu_email: string;
    auth_user_id: string;
    rol: string;
    esDueno: boolean;
    esPlayero: boolean;
    empleadoEst?: { play_id: number; est_id: number };
    problema?: string;
  }>;
  conflictos: Array<{
    usuario: any;
    problema: string;
  }>;
  recomendaciones: string[];
}

export default function DebugRolesPage() {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarDiagnostico = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/debug/roles');
        
        if (!response.ok) {
          throw new Error('Error al cargar el diagnóstico');
        }
        
        const data = await response.json();
        setDiagnostico(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    cargarDiagnostico();
  }, []);

  const getRolBadge = (rol: string) => {
    switch (rol) {
      case 'owner':
        return <Badge className="bg-purple-100 text-purple-800"><Crown className="w-3 h-3 mr-1" />Dueño</Badge>;
      case 'playero':
        return <Badge className="bg-blue-100 text-blue-800"><Users className="w-3 h-3 mr-1" />Playero</Badge>;
      case 'conductor':
        return <Badge className="bg-gray-100 text-gray-800"><User className="w-3 h-3 mr-1" />Conductor</Badge>;
      case 'conflicto':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Conflicto</Badge>;
      default:
        return <Badge variant="outline">{rol}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Cargando diagnóstico...</h3>
              <p className="text-sm text-muted-foreground">
                Analizando roles de usuarios en el sistema
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar el diagnóstico: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!diagnostico) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se pudo cargar el diagnóstico
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico de Roles</h1>
          <p className="text-muted-foreground">
            Análisis del sistema de roles y detección de conflictos
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          Actualizar
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostico.resumen.totalUsuarios}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dueños</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostico.resumen.totalDuenos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Playeros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostico.resumen.totalPlayeros}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Asignaciones</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{diagnostico.resumen.totalAsignaciones}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conflictos</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{diagnostico.resumen.totalConflictos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Conflictos */}
      {diagnostico.conflictos.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Se encontraron {diagnostico.conflictos.length} conflictos:</strong>
            <ul className="mt-2 list-disc list-inside">
              {diagnostico.conflictos.map((conflicto, index) => (
                <li key={index}>
                  {conflicto.usuario.usu_nom} {conflicto.usuario.usu_ape} ({conflicto.usuario.usu_email}): {conflicto.problema}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Recomendaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Recomendaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {diagnostico.recomendaciones.map((recomendacion, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{recomendacion}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Lista de usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios y Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {diagnostico.usuarios.map((usuario) => (
              <div key={usuario.usu_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-medium">{usuario.usu_nom} {usuario.usu_ape}</h4>
                      <p className="text-sm text-muted-foreground">{usuario.usu_email}</p>
                      <p className="text-xs text-muted-foreground">ID: {usuario.usu_id} | Auth ID: {usuario.auth_user_id}</p>
                    </div>
                    {getRolBadge(usuario.rol)}
                  </div>
                  
                  {usuario.problema && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {usuario.problema}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {usuario.empleadoEst && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Asignado al estacionamiento ID: {usuario.empleadoEst.est_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
