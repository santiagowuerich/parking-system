"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUserRole } from "@/lib/use-user-role";
import { AbonoConductor } from "@/lib/types";
import { AbonoDetailDialog } from "@/components/abonos/abono-detail-dialog";
import { Search, Loader2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export default function AbonosPage() {
    const { isDriver, loading: roleLoading } = useUserRole();
    const [abonos, setAbonos] = useState<AbonoConductor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [mostrarVencidos, setMostrarVencidos] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [abonoDetailDialog, setAbonoDetailDialog] = useState<number | null>(null);

    const itemsPerPage = 5;

    // Si no es conductor, no mostrar nada (DashboardLayout manejará la redirección)
    if (!isDriver && !roleLoading) {
        return <DashboardLayout><div></div></DashboardLayout>;
    }

    useEffect(() => {
        if (isDriver) {
            cargarAbonos();
        }
    }, [isDriver]);

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
            case 'semanal': return 'Semanal';
            case 'mensual': return 'Mensual';
            case 'trimestral': return 'Trimestral';
            default: return tipo;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <DashboardLayout>
            <div className="flex h-screen bg-background">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="container mx-auto p-6 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                                    <Calendar className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">Mis Abonos</h1>
                                    <p className="text-gray-600">Gestioná tus suscripciones y benefíciate de tarifas especiales</p>
                                </div>
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
                                            <div className="rounded-md border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Estacionamiento</TableHead>
                                                            <TableHead className="hidden md:table-cell">Zona</TableHead>
                                                            <TableHead>Plaza</TableHead>
                                                            <TableHead className="hidden md:table-cell">Tipo</TableHead>
                                                            <TableHead className="hidden md:table-cell">Inicio</TableHead>
                                                            <TableHead>Vence</TableHead>
                                                            <TableHead>Restan</TableHead>
                                                            <TableHead>Aviso</TableHead>
                                                            <TableHead>Acc</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {abonosPaginados.map((abono) => (
                                                            <TableRow key={abono.abo_nro}>
                                                                <TableCell>
                                                                    <div>
                                                                        <div className="font-medium">{abono.estacionamiento_nombre}</div>
                                                                        <div className="text-sm text-gray-500">{abono.estacionamiento_direccion}</div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="hidden md:table-cell">{abono.pla_zona}</TableCell>
                                                                <TableCell>P{abono.pla_numero.toString().padStart(3, '0')}</TableCell>
                                                                <TableCell className="hidden md:table-cell">{getTipoAbono(abono.abo_tipoabono)}</TableCell>
                                                                <TableCell className="hidden md:table-cell">{formatDate(abono.abo_fecha_inicio)}</TableCell>
                                                                <TableCell>{formatDate(abono.abo_fecha_fin)}</TableCell>
                                                                <TableCell>
                                                                    <span className="font-medium">{abono.dias_restantes} días</span>
                                                                </TableCell>
                                                                <TableCell>{getEstadoBadge(abono.estado)}</TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setAbonoDetailDialog(abono.abo_nro)}
                                                                    >
                                                                        Ver detalle
                                                                    </Button>
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