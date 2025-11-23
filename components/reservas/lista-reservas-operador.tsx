"use client";

import { useState, useEffect } from 'react';
import { useReservas } from '@/lib/hooks/use-reservas-unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Calendar,
    Clock,
    Car,
    MapPin,
    DollarSign,
    User,
    Phone,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2,
    Search,
    Filter,
    RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReservaConDetalles, EstadoReserva } from '@/lib/types';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface ListaReservasOperadorProps {
    estId: number;
    fecha?: string; // YYYY-MM-DD
    onConfirmarLlegada?: (reserva: ReservaConDetalles) => void;
}

export function ListaReservasOperador({
    estId,
    fecha = dayjs().format('YYYY-MM-DD'),
    onConfirmarLlegada
}: ListaReservasOperadorProps) {
    const [reservas, setReservas] = useState<ReservaConDetalles[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filtroEstado, setFiltroEstado] = useState<EstadoReserva | 'todos'>('todos');
    const [busqueda, setBusqueda] = useState('');
    const [fechaSeleccionada, setFechaSeleccionada] = useState(fecha);

    const { obtenerReservasOperador, confirmarLlegada } = useReservas(estId);

    const cargarReservas = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await obtenerReservasOperador(fechaSeleccionada);

            if (response.success && response.data) {
                setReservas(response.data.reservas || []);
            } else {
                setError(response.error || 'Error al cargar las reservas');
            }
        } catch (err) {
            setError('Error al cargar las reservas');
            console.error('Error cargando reservas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarReservas();
    }, [fechaSeleccionada]);

    const handleConfirmarLlegada = async (reserva: ReservaConDetalles) => {
        try {
            const response = await confirmarLlegada(reserva.res_codigo);

            if (response.success) {
                toast({
                    title: "Llegada confirmada",
                    description: `La reserva ${reserva.res_codigo} ha sido activada exitosamente`,
                });

                if (onConfirmarLlegada) {
                    onConfirmarLlegada(reserva);
                }

                // Recargar la lista
                cargarReservas();
            } else {
                toast({
                    title: "Error",
                    description: response.error || 'No se pudo confirmar la llegada',
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error",
                description: 'Error al confirmar la llegada',
                variant: "destructive",
            });
            console.error('Error confirmando llegada:', err);
        }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'confirmada':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'activa':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'pendiente_pago':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'no_show':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'expirada':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'completada':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'cancelada':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'confirmada':
                return <CheckCircle className="w-4 h-4" />;
            case 'activa':
                return <CheckCircle className="w-4 h-4" />;
            case 'pendiente_pago':
                return <Clock className="w-4 h-4" />;
            case 'no_show':
                return <XCircle className="w-4 h-4" />;
            case 'expirada':
                return <XCircle className="w-4 h-4" />;
            case 'completada':
                return <CheckCircle className="w-4 h-4" />;
            case 'cancelada':
                return <XCircle className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    };

    const estaEnTiempoValido = (reserva: ReservaConDetalles) => {
        const ahora = dayjs();
        const finReserva = dayjs(reserva.res_fh_fin);

        // Válida hasta el fin del tiempo pagado
        return ahora.isBefore(finReserva);
    };

    const puedeConfirmarLlegada = (reserva: ReservaConDetalles) => {
        // Las reservas pendientes pueden confirmarse directamente
        if (reserva.res_estado === 'pendiente_confirmacion_operador') {
            return true;
        }
        // Las reservas confirmadas pueden confirmarse si el tiempo pagado no ha expirado
        return reserva.res_estado === 'confirmada' && estaEnTiempoValido(reserva);
    };

    const estaProximaAExpirar = (reserva: ReservaConDetalles) => {
        const ahora = dayjs();
        const finReserva = dayjs(reserva.res_fh_fin);

        return reserva.res_estado === 'confirmada' &&
            ahora.isBefore(finReserva) &&
            ahora.isAfter(finReserva.subtract(10, 'minutes'));
    };

    // Filtrar reservas
    const reservasFiltradas = reservas.filter(reserva => {
        const cumpleEstado = filtroEstado === 'todos' || reserva.res_estado === filtroEstado;
        const cumpleBusqueda = !busqueda ||
            reserva.res_codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
            reserva.veh_patente.toLowerCase().includes(busqueda.toLowerCase()) ||
            `${reserva.conductor.usu_nom} ${reserva.conductor.usu_ape}`.toLowerCase().includes(busqueda.toLowerCase());

        return cumpleEstado && cumpleBusqueda;
    });

    // Estadísticas
    const estadisticas = {
        total: reservas.length,
        confirmadas: reservas.filter(r => r.res_estado === 'confirmada').length,
        activas: reservas.filter(r => r.res_estado === 'activa').length,
        noShow: reservas.filter(r => r.res_estado === 'no_show').length,
        ingresos: reservas
            .filter(r => r.res_estado === 'activa')
            .reduce((sum, r) => sum + r.res_monto, 0)
    };

    return (
        <div className="space-y-6">
            {/* Header con estadísticas */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Reservas del {format(new Date(fechaSeleccionada), 'dd/MM/yyyy', { locale: es })}
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cargarReservas}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{estadisticas.total}</div>
                            <div className="text-sm text-gray-600">Total</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{estadisticas.confirmadas}</div>
                            <div className="text-sm text-gray-600">Confirmadas</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{estadisticas.activas}</div>
                            <div className="text-sm text-gray-600">Activas</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{estadisticas.noShow}</div>
                            <div className="text-sm text-gray-600">No Show</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{formatCurrency(estadisticas.ingresos)}</div>
                            <div className="text-sm text-gray-600">Ingresos</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filtros */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por código, patente o conductor..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <Select value={filtroEstado} onValueChange={(value) => setFiltroEstado(value as EstadoReserva | 'todos')}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los estados</SelectItem>
                                <SelectItem value="pendiente_pago">Pendiente Pago</SelectItem>
                                <SelectItem value="confirmada">Confirmada</SelectItem>
                                <SelectItem value="activa">Activa</SelectItem>
                                <SelectItem value="completada">Completada</SelectItem>
                                <SelectItem value="cancelada">Cancelada</SelectItem>
                                <SelectItem value="expirada">Expirada</SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                            </SelectContent>
                        </Select>

                        <Input
                            type="date"
                            value={fechaSeleccionada}
                            onChange={(e) => setFechaSeleccionada(e.target.value)}
                            className="w-full md:w-48"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Tabla de reservas */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : reservasFiltradas.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No hay reservas para la fecha seleccionada
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Plaza</TableHead>
                                        <TableHead>Conductor</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Monto</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reservasFiltradas.map((reserva) => (
                                        <TableRow
                                            key={reserva.res_codigo}
                                            className={estaProximaAExpirar(reserva) ? 'bg-yellow-50' : ''}
                                        >
                                            <TableCell>
                                                <div className="font-mono font-medium">{reserva.res_codigo}</div>
                                                {estaProximaAExpirar(reserva) && (
                                                    <Badge variant="outline" className="text-yellow-600 border-yellow-300 mt-1">
                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                        Próxima a expirar
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                <div className="text-sm">
                                                    {dayjs.utc(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires').format('HH:mm')}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {dayjs.utc(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires').format('HH:mm')}
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-gray-500" />
                                                    <span className="text-sm">{reserva.plaza.pla_zona}</span>
                                                </div>
                                                <div className="text-xs text-gray-500">{reserva.plaza.catv_segmento}</div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="text-sm font-medium">
                                                    {reserva.conductor.usu_nom} {reserva.conductor.usu_ape}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Phone className="w-3 h-3" />
                                                    {reserva.conductor.usu_tel}
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="text-sm">{reserva.vehiculo.veh_marca} {reserva.vehiculo.veh_modelo}</div>
                                                <div className="text-xs text-gray-500">{reserva.veh_patente}</div>
                                            </TableCell>

                                            <TableCell>
                                                <Badge className={getEstadoColor(reserva.res_estado)}>
                                                    {getEstadoIcon(reserva.res_estado)}
                                                    <span className="ml-1">{reserva.res_estado.replace('_', ' ').toUpperCase()}</span>
                                                </Badge>
                                            </TableCell>

                                            <TableCell>
                                                <div className="font-medium">{formatCurrency(reserva.res_monto)}</div>
                                            </TableCell>

                                            <TableCell>
                                                {puedeConfirmarLlegada(reserva) ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleConfirmarLlegada(reserva)}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" />
                                                        Confirmar
                                                    </Button>
                                                ) : (
                                                    <div className="text-xs text-gray-500">
                                                        {reserva.res_estado === 'confirmada'
                                                            ? 'Fuera de tiempo'
                                                            : reserva.res_estado === 'activa'
                                                                ? 'Ya activa'
                                                                : 'No disponible'
                                                        }
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
