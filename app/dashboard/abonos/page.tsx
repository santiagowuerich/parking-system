"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/lib/use-user-role";
import { AbonoConductor } from "@/lib/types";
import { AbonoDetailDialog } from "@/components/abonos/abono-detail-dialog";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function AbonosPage() {
    const { isDriver, loading: roleLoading } = useUserRole();
    const [abonos, setAbonos] = useState<AbonoConductor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [mostrarVencidos, setMostrarVencidos] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [abonoDetailDialog, setAbonoDetailDialog] = useState<number | null>(null);

    const itemsPerPage = 5;

    const cargarAbonos = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/abonos/conductor');
            const data = await response.json();

            if (data.success) {
                setAbonos(data.abonos);
            } else {
                console.error('Error cargando abonos:', data.error);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isDriver) {
            cargarAbonos();
        }
    }, [isDriver]);

    // Si no es conductor, no mostrar nada (DashboardLayout manejará la redirección)
    if (!isDriver && !roleLoading) {
        return <DashboardLayout><div></div></DashboardLayout>;
    }

    // Filtrar abonos por búsqueda y estado (vencidos)
    const abonosFiltrados = abonos.filter(abono => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = (
            abono.estacionamiento_nombre.toLowerCase().includes(searchLower) ||
            abono.estacionamiento_direccion.toLowerCase().includes(searchLower)
        );

        // Si no se quieren mostrar vencidos, filtrar solo activos y por vencer
        const matchesEstado = mostrarVencidos || abono.estado !== 'Vencido';

        return matchesSearch && matchesEstado;
    });

    // Ordenar: primero activos por proximidad a vencer, luego vencidos
    const abonosOrdenados = [...abonosFiltrados].sort((a, b) => {
        // Si uno está vencido y el otro no, el vencido va al final
        if (a.estado === 'Vencido' && b.estado !== 'Vencido') return 1;
        if (a.estado !== 'Vencido' && b.estado === 'Vencido') return -1;

        // Si ambos tienen el mismo estado (ambos vencidos o ambos activos), ordenar por días restantes
        return a.dias_restantes - b.dias_restantes;
    });

    // Paginación
    const totalPages = Math.ceil(abonosOrdenados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const abonosPaginados = abonosOrdenados.slice(startIndex, endIndex);

    const getEstadoDisplay = (estado: string) => {
        let dotColor = 'bg-gray-500';
        let textColor = 'text-gray-700';

        switch (estado) {
            case 'Activo':
                dotColor = 'bg-green-500';
                textColor = 'text-green-700';
                break;
            case 'Por vencer':
                dotColor = 'bg-yellow-500';
                textColor = 'text-yellow-700';
                break;
            case 'Vencido':
                dotColor = 'bg-red-500';
                textColor = 'text-red-700';
                break;
        }

        return (
            <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span className={`text-sm font-medium ${textColor}`}>{estado}</span>
            </div>
        );
    };

    const getTipoAbono = (tipo: string) => {
        switch (tipo) {
            case 'semanal': return 'Semanal';
            case 'mensual': return 'Mensual';
            case 'trimestral': return 'Trimestral';
            default: return tipo;
        }
    };

    const formatDate = (dateString: string) => {
        return dayjs.utc(dateString).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY');
    };

    return (
        <DashboardLayout>
            <div className="flex h-screen bg-background">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="container mx-auto p-6 space-y-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Mis Abonos</h1>
                                <p className="text-gray-600">Gestioná tus suscripciones y benefíciate de tarifas especiales</p>
                            </div>

                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                            <div className="flex-1 w-full sm:w-auto">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <Input
                                                        placeholder="Buscar por Estacionamiento"
                                                        value={searchTerm}
                                                        onChange={(e) => {
                                                            setSearchTerm(e.target.value);
                                                            setCurrentPage(1);
                                                        }}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="mostrar-vencidos"
                                                checked={mostrarVencidos}
                                                onCheckedChange={(checked) => {
                                                    setMostrarVencidos(checked as boolean);
                                                    setCurrentPage(1);
                                                }}
                                            />
                                            <Label
                                                htmlFor="mostrar-vencidos"
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                            >
                                                Mostrar abonos vencidos
                                            </Label>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                            <span className="ml-2 text-gray-600">Cargando abonos...</span>
                                        </div>
                                    ) : abonosPaginados.length === 0 ? (
                                        <Alert>
                                            <AlertDescription>
                                                {searchTerm ? 'No se encontraron abonos con ese criterio de búsqueda.' : 'No tienes abonos activos.'}
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <>
                                            <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                                                <table className="w-full bg-white border-collapse">
                                                    <thead>
                                                        <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estacionamiento</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300 hidden md:table-cell">Zona</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Plaza</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300 hidden md:table-cell">Tipo</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300 hidden md:table-cell">Inicio</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vence</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Restan</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                                            <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {abonosPaginados.map((abono) => (
                                                            <tr key={abono.abo_nro} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300">
                                                                    <div>
                                                                        <div className="font-medium">{abono.estacionamiento_nombre}</div>
                                                                        <div className="text-sm text-gray-500">{abono.estacionamiento_direccion}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center hidden md:table-cell">{abono.pla_zona}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">P{abono.pla_numero.toString().padStart(3, '0')}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center hidden md:table-cell">{getTipoAbono(abono.abo_tipoabono)}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center hidden md:table-cell">{formatDate(abono.abo_fecha_inicio)}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{formatDate(abono.abo_fecha_fin)}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                                    <span className="font-medium">{abono.dias_restantes} días</span>
                                                                </td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{getEstadoDisplay(abono.estado)}</td>
                                                                <td className="py-4 px-4 text-sm text-gray-800 text-center">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setAbonoDetailDialog(abono.abo_nro)}
                                                                    >
                                                                        Ver detalle
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Paginación */}
                                            <div className="flex items-center justify-between mt-4">
                                                <p className="text-sm text-gray-600">
                                                    Mostrando {startIndex + 1}-{Math.min(endIndex, abonosOrdenados.length)} de {abonosOrdenados.length}
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={currentPage === 1}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                        Anterior
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        disabled={currentPage === totalPages}
                                                    >
                                                        Siguiente
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <AbonoDetailDialog
                                open={!!abonoDetailDialog}
                                onOpenChange={(v) => !v && setAbonoDetailDialog(null)}
                                abo_nro={abonoDetailDialog}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </DashboardLayout>
    );
}