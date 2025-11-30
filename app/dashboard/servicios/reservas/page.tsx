"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Calendar,
    Copy,
    MapPin,
    Clock,
    User,
    Car,
    DollarSign,
    Eye,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertTriangle
} from "lucide-react";
import { ReservaConDetalles } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import dayjs from 'dayjs';
import { DetalleReservaDialog } from "@/components/reservas/detalle-reserva-dialog";

const ITEMS_POR_PAGINA = 10;

export default function ReservasPage() {
    const { estId } = useAuth();
    const [reservas, setReservas] = useState<ReservaConDetalles[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fechaFiltro, setFechaFiltro] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [tabActual, setTabActual] = useState<'vigentes' | 'historial'>('vigentes');
    const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservaConDetalles | null>(null);

    const cargarReservas = async () => {
        if (!estId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/reservas/list?est_id=${estId}`);
            const data = await response.json();

            if (data.success) {
                setReservas(data.reservas || []);
            } else {
                toast({
                    title: "Error",
                    description: "No se pudieron cargar las reservas",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error cargando reservas:", error);
            toast({
                title: "Error",
                description: "Error al cargar las reservas",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarReservas();
    }, [estId]);

    const reservasVigentes = useMemo(() => {
        return reservas.filter(r =>
            ['pendiente_pago', 'confirmada', 'activa'].includes(r.res_estado)
        );
    }, [reservas]);

    const reservasHistorial = useMemo(() => {
        return reservas.filter(r =>
            ['completada', 'expirada', 'cancelada', 'no_show'].includes(r.res_estado)
        );
    }, [reservas]);

    const reservasFiltradas = useMemo(() => {
        const lista = tabActual === 'vigentes' ? reservasVigentes : reservasHistorial;

        return lista.filter(r => {
            // Filtro de búsqueda
            const cumpleBusqueda = !searchTerm || (
                r.res_codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.veh_patente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                `${r.conductor.usu_nom} ${r.conductor.usu_ape}`.toLowerCase().includes(searchTerm.toLowerCase())
            );

            // Filtro de fecha
            const cumpleFecha = !fechaFiltro ||
                dayjs(r.res_fh_ingreso).format('YYYY-MM-DD') === fechaFiltro;

            return cumpleBusqueda && cumpleFecha;
        });
    }, [tabActual, reservasVigentes, reservasHistorial, searchTerm, fechaFiltro]);

    const totalPages = Math.ceil(reservasFiltradas.length / ITEMS_POR_PAGINA);
    const startIndex = (currentPage - 1) * ITEMS_POR_PAGINA;
    const endIndex = startIndex + ITEMS_POR_PAGINA;
    const reservasPaginadas = reservasFiltradas.slice(startIndex, endIndex);

    const obtenerColorEstado = (estado: string): string => {
        const colores: Record<string, string> = {
            'pendiente_pago': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'confirmada': 'bg-green-100 text-green-800 border-green-200',
            'activa': 'bg-blue-100 text-blue-800 border-blue-200',
            'completada': 'bg-purple-100 text-purple-800 border-purple-200',
            'expirada': 'bg-gray-100 text-gray-800 border-gray-200',
            'cancelada': 'bg-red-100 text-red-800 border-red-200',
            'no_show': 'bg-orange-100 text-orange-800 border-orange-200',
        };
        return colores[estado] || 'bg-gray-100 text-gray-800';
    };

    const formatearFecha = (fecha: string): string => {
        return dayjs(fecha).format('DD/MM/YYYY HH:mm');
    };

    const copiarCodigo = (codigo: string) => {
        navigator.clipboard.writeText(codigo);
        toast({
            title: "Código copiado",
            description: `El código ${codigo} se copió al portapapeles`
        });
    };

    const verDetalles = (reserva: ReservaConDetalles) => {
        setReservaSeleccionada(reserva);
    };

    const renderizarTarjetas = (reservasList: ReservaConDetalles[]) => (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reservasList.map((reserva) => (
                    <Card key={reserva.res_codigo} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-sm font-medium">
                                    {reserva.res_codigo}
                                </div>
                                <Button size="sm" variant="ghost" onClick={(e) => {
                                    e.stopPropagation();
                                    copiarCodigo(reserva.res_codigo);
                                }}>
                                    <Copy className="w-4 h-4" />
                                </Button>
                            </div>

                            <Badge className={obtenerColorEstado(reserva.res_estado)}>
                                {reserva.res_estado.replace('_', ' ').toUpperCase()}
                            </Badge>
                        </CardHeader>

                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span>{reserva.plaza.pla_zona} - Plaza {reserva.pla_numero}</span>
                            </div>

                            <div className="flex items-start gap-2">
                                <Clock className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <div>{formatearFecha(reserva.res_fh_ingreso)}</div>
                                    <div className="text-xs text-gray-500">
                                        hasta {formatearFecha(reserva.res_fh_fin)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span>{reserva.conductor.usu_nom} {reserva.conductor.usu_ape}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Car className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span>{reserva.veh_patente}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="font-semibold">{formatCurrency(reserva.res_monto)}</span>
                            </div>

                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2"
                                onClick={() => verDetalles(reserva)}
                            >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver Detalles
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-gray-600">
                        Mostrando {startIndex + 1}-{Math.min(endIndex, reservasFiltradas.length)} de {reservasFiltradas.length} reservas
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <DashboardLayout title="Reservas" description="Gestiona las reservas del estacionamiento">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">Reservas del Estacionamiento</h1>
                    <p className="text-gray-600">Gestiona todas las reservas del estacionamiento</p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 max-w-md">
                                <Input
                                    type="text"
                                    placeholder="Buscar por código, patente o conductor..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full"
                                />
                            </div>

                            <Input
                                type="date"
                                value={fechaFiltro}
                                onChange={(e) => {
                                    setFechaFiltro(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full md:w-48"
                            />

                            <Button onClick={cargarReservas} disabled={loading} size="sm">
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Actualizar
                            </Button>
                        </div>
                    </CardHeader>
                </Card>

                <Tabs value={tabActual} onValueChange={(v) => {
                    setTabActual(v as 'vigentes' | 'historial');
                    setCurrentPage(1);
                }}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="vigentes">
                            Vigentes ({reservasVigentes.length})
                        </TabsTrigger>
                        <TabsTrigger value="historial">
                            Historial ({reservasHistorial.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="vigentes" className="space-y-6">
                        {loading ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </CardContent>
                            </Card>
                        ) : reservasPaginadas.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-12">
                                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">
                                        {searchTerm ? "No se encontraron reservas vigentes con esa búsqueda" : "No hay reservas vigentes"}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            renderizarTarjetas(reservasPaginadas)
                        )}
                    </TabsContent>

                    <TabsContent value="historial" className="space-y-6">
                        {loading ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </CardContent>
                            </Card>
                        ) : reservasPaginadas.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-12">
                                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">
                                        {searchTerm ? "No se encontraron reservas en el historial con esa búsqueda" : "No hay reservas en el historial"}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            renderizarTarjetas(reservasPaginadas)
                        )}
                    </TabsContent>
                </Tabs>

                <DetalleReservaDialog
                    reserva={reservaSeleccionada}
                    open={!!reservaSeleccionada}
                    onOpenChange={(open) => {
                        if (!open) setReservaSeleccionada(null);
                    }}
                />
            </div>
        </DashboardLayout>
    );
}
