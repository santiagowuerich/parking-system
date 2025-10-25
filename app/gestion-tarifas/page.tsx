"use client"


import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

interface Plantilla {
  plantilla_id: number;
  nombre_plantilla: string;
  catv_segmento: string;
  caracteristicas: Record<string, string[]>;
}

export default function GestionTarifasPage() {
  const { estId } = useAuth();
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Cargar plantillas al montar el componente
  useEffect(() => {
    loadPlantillas();
  }, [estId]);

  const loadPlantillas = async () => {
    if (!estId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/plantillas?est_id=${estId}`);

      if (!response.ok) {
        throw new Error('Error al cargar plantillas');
      }

      const data = await response.json();
      setPlantillas(data.plantillas || []);
    } catch (error: any) {
      console.error('Error cargando plantillas:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al cargar las plantillas"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDefinirPrecios = () => {
    router.push("/dashboard/plantillas");
  };

  const getVehicleTypeDisplay = (segmento: string) => {
    switch (segmento) {
      case 'AUT': return 'Auto';
      case 'MOT': return 'Moto';
      case 'CAM': return 'Camioneta';
      default: return segmento;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Cargando plantillas...</p>
          </div>
        </div>
      </div>
    );
  }

  const isInDashboard = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

  return (
    <div className={`container mx-auto p-6 max-w-7xl ${isInDashboard ? '' : 'min-h-screen'}`}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Tarifas y Plantillas</h1>
        <p className="text-gray-600 mt-2">
          Define los precios por hora, día, mes y año para cada plantilla de estacionamiento
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Plantillas Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          {plantillas.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plantillas disponibles</h3>
              <p className="text-gray-500 mb-4">
                Crea plantillas en la sección de gestión de plantillas antes de definir precios.
              </p>
              <Button
                onClick={() => window.location.href = '/gestion-plantillas'}
                variant="outline"
              >
                Ir a Gestión de Plantillas
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
              <table className="w-full bg-white border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Nombre</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vehículo</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Techo</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Seguridad</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Conectividad</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {plantillas.map((plantilla) => (
                    <tr key={plantilla.plantilla_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                      <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium">
                        {plantilla.nombre_plantilla}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                        {getVehicleTypeDisplay(plantilla.catv_segmento)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                        {plantilla.caracteristicas['Techo']?.map((valor, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1"
                          >
                            {valor}
                          </span>
                        )) || <span className="text-gray-400 italic">Sin especificar</span>}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                        {plantilla.caracteristicas['Seguridad']?.map((valor, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1 mb-1"
                          >
                            {valor}
                          </span>
                        )) || <span className="text-gray-400 italic">Sin especificar</span>}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                        {plantilla.caracteristicas['Conectividad']?.map((valor, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-1 mb-1"
                          >
                            {valor}
                          </span>
                        )) || <span className="text-gray-400 italic">Sin especificar</span>}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Button
                          variant="ghost"
                          onClick={handleDefinirPrecios}
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded px-2 py-1"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          <span className="text-xs font-medium">Definir Precios</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
