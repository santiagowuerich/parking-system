"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Calendar, Search, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Abono {
    abo_nro: number;
    conductor_nombre: string;
    conductor_apellido: string;
    conductor_dni: string;
    zona: string;
    pla_numero: number;
    tipo_abono: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias_restantes: number;
    estado: 'Activo' | 'Por vencer' | 'Vencido';
}

export default function GestionAbonosPage() {
    const { estId } = useAuth();
    const [abonos, setAbonos] = useState<Abono[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortByExpiry, setSortByExpiry] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        if (estId) {
            cargarAbonos();
        }
    }, [estId]);

    const cargarAbonos = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/abonos/list?est_id=${estId}`);
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

    // Filtrar abonos por búsqueda
    const abonosFiltrados = abonos.filter(abono => {
        const searchLower = searchTerm.toLowerCase();
        return (
            abono.conductor_nombre.toLowerCase().includes(searchLower) ||
            abono.conductor_apellido.toLowerCase().includes(searchLower) ||
            abono.conductor_dni.includes(searchTerm)
        );
    });

    // Ordenar por proximidad a vencer si está activado
    const abonosOrdenados = sortByExpiry
        ? [...abonosFiltrados].sort((a, b) => a.dias_restantes - b.dias_restantes)
        : abonosFiltrados;

    // Paginación
    const totalPages = Math.ceil(abonosOrdenados.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const abonosPaginados = abonosOrdenados.slice(startIndex, endIndex);

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'Activo':
                return <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>;
            case 'Por vencer':
                return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Por vencer</Badge>;
            case 'Vencido':
                return <Badge className="bg-red-100 text-red-800 border-red-200">Vencido</Badge>;
            default:
                return <Badge>{estado}</Badge>;
        }
    };

    const getTipoAbono = (tipo: string) => {
        switch (tipo) {
            case 'semanal':
                return 'Semanal';
            case 'mensual':
                return 'Mensual';
            default:
                return tipo;
        }
    };

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="container mx-auto p-6 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                                <Calendar className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Abonos actuales</h1>
                                <p className="text-gray-600">Grilla con abonos vigentes. Ordenable por proximidad a vencer.</p>
                            </div>
                        </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="flex-1 w-full sm:w-auto">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar por DNI, correo..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant={sortByExpiry ? "default" : "outline"}
                                onClick={() => setSortByExpiry(!sortByExpiry)}
                                className="flex-1 sm:flex-none"
                            >
                                {sortByExpiry ? "✓ " : ""}Ordenar por proximidad a vencer
                            </Button>
                            <Button
                                variant="outline"
                                onClick={cargarAbonos}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                            </Button>
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
                                {searchTerm ? 'No se encontraron abonos con ese criterio de búsqueda.' : 'No hay abonos activos en este estacionamiento.'}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Conductor</TableHead>
                                            <TableHead>DNI</TableHead>
                                            <TableHead>Zona</TableHead>
                                            <TableHead>Plaza</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Inicio</TableHead>
                                            <TableHead>Vence</TableHead>
                                            <TableHead>Restan</TableHead>
                                            <TableHead>Aviso</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {abonosPaginados.map((abono) => (
                                            <TableRow key={abono.abo_nro}>
                                                <TableCell className="font-medium">
                                                    {abono.conductor_nombre} {abono.conductor_apellido}
                                                </TableCell>
                                                <TableCell>{abono.conductor_dni}</TableCell>
                                                <TableCell>{abono.zona}</TableCell>
                                                <TableCell>{abono.pla_numero}</TableCell>
                                                <TableCell>{getTipoAbono(abono.tipo_abono)}</TableCell>
                                                <TableCell>{new Date(abono.fecha_inicio).toLocaleDateString('es-AR')}</TableCell>
                                                <TableCell>{new Date(abono.fecha_fin).toLocaleDateString('es-AR')}</TableCell>
                                                <TableCell>{abono.dias_restantes} días</TableCell>
                                                <TableCell>{getEstadoBadge(abono.estado)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button variant="outline" size="sm">
                                                            Ver detalle
                                                        </Button>
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                            Extender abono
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
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
                    </div>
                </main>
            </div>
        </div>
    );
}
