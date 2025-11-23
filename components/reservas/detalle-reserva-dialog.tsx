'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle as CardTitleComponent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency, segmentToName } from '@/lib/utils'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { createBrowserClient } from '@supabase/ssr'

dayjs.extend(utc)
dayjs.extend(timezone)

interface Props {
    open: boolean
    onOpenChange: (v: boolean) => void
    res_codigo: string | null
}

export function DetalleReservaDialog({ open, onOpenChange, res_codigo }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        if (!open || !res_codigo) return

        const fetchDetail = async () => {
            setLoading(true)
            setError(null)
            try {
                // Crear cliente Supabase para obtener datos directamente
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                )

                // Obtener reserva con detalles completos desde la vista
                const { data: reserva, error: reservaError } = await supabase
                    .from('vw_reservas_detalles')
                    .select('*')
                    .eq('res_codigo', res_codigo)
                    .single()

                if (reservaError) {
                    console.error('Error obteniendo reserva:', reservaError)
                    throw new Error('No se pudo cargar la reserva')
                }

                if (!reserva) {
                    throw new Error('Reserva no encontrada')
                }

                // Obtener vehículos del conductor
                const { data: vehiculos } = await supabase
                    .from('vehiculos')
                    .select('veh_patente, con_id, catv_segmento, veh_marca, veh_modelo, veh_color')
                    .eq('con_id', reserva.con_id)

                setData({
                    ...reserva,
                    vehiculos: vehiculos || []
                })
            } catch (e: any) {
                console.error('Error:', e)
                setError(e.message || 'Error cargando detalle')
            } finally {
                setLoading(false)
            }
        }

        fetchDetail()
    }, [open, res_codigo])

    if (!open) return null

    const reserva = data
    const conductor = data ? {
        usu_nom: data.usu_nom,
        usu_ape: data.usu_ape,
        usu_email: data.usu_email,
        usu_tel: data.usu_tel
    } : null
    const vehiculo = data ? {
        veh_marca: data.veh_marca,
        veh_modelo: data.veh_modelo,
        veh_color: data.veh_color
    } : null
    const plaza = data ? {
        pla_zona: data.pla_zona,
        catv_segmento: data.catv_segmento
    } : null
    const vehiculos = data?.vehiculos || []

    const getEstadoReserva = () => {
        if (!reserva) return 'Desconocido'
        return reserva.res_estado?.replace('_', ' ').toUpperCase() || 'Desconocido'
    }

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'confirmada':
                return 'bg-green-100 text-green-800'
            case 'activa':
                return 'bg-blue-100 text-blue-800'
            case 'pendiente_pago':
                return 'bg-yellow-100 text-yellow-800'
            case 'no_show':
                return 'bg-red-100 text-red-800'
            case 'expirada':
                return 'bg-gray-100 text-gray-800'
            case 'completada':
                return 'bg-purple-100 text-purple-800'
            case 'cancelada':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalle de Reserva {res_codigo}</DialogTitle>
                </DialogHeader>

                {loading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {!loading && !error && data && (
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="conductor">Conductor</TabsTrigger>
                            <TabsTrigger value="vehiculo">Vehículo</TabsTrigger>
                            <TabsTrigger value="pago">Pago</TabsTrigger>
                        </TabsList>

                        {/* TAB: General */}
                        <TabsContent value="general" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Información de la Reserva</CardTitleComponent>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Código de Reserva</span>
                                            <p className="text-lg font-semibold">{reserva?.res_codigo}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Estado</span>
                                            <Badge className={getEstadoColor(reserva?.res_estado)}>
                                                {getEstadoReserva()}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Fecha de Reserva</span>
                                            <p className="text-lg font-semibold">
                                                {reserva?.res_created_at ? dayjs.utc(reserva.res_created_at).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm') : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Hora de Ingreso Prevista</span>
                                            <p className="text-lg font-semibold">
                                                {reserva?.res_fh_ingreso ? dayjs.utc(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm') : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Hora de Fin Prevista</span>
                                            <p className="text-lg font-semibold">
                                                {reserva?.res_fh_fin ? dayjs.utc(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY HH:mm') : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Monto</span>
                                            <p className="text-lg font-semibold">{formatCurrency(reserva?.res_monto || 0)}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Zona</span>
                                            <p className="text-lg font-semibold">{plaza?.pla_zona || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Plaza Número</span>
                                            <p className="text-lg font-semibold">{reserva?.pla_numero || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Método de Pago</span>
                                            <p className="text-lg font-semibold capitalize">{reserva?.metodo_pago?.replace('_', ' ') || 'N/A'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: Conductor */}
                        <TabsContent value="conductor" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Datos del Conductor</CardTitleComponent>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Nombre</span>
                                            <p className="text-lg font-semibold">{conductor?.usu_nom || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Apellido</span>
                                            <p className="text-lg font-semibold">{conductor?.usu_ape || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Email</span>
                                            <p className="text-lg font-semibold text-blue-600">{conductor?.usu_email || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Teléfono</span>
                                            <p className="text-lg font-semibold">{conductor?.usu_tel || 'N/A'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: Vehículo */}
                        <TabsContent value="vehiculo" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Información del Vehículo</CardTitleComponent>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Patente</span>
                                            <p className="text-lg font-semibold">{reserva?.veh_patente || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Tipo</span>
                                            <p className="text-lg font-semibold">{segmentToName(plaza?.catv_segmento)}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Marca</span>
                                            <p className="text-lg font-semibold">{vehiculo?.veh_marca || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Modelo</span>
                                            <p className="text-lg font-semibold">{vehiculo?.veh_modelo || 'N/A'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-sm text-gray-600">Color</span>
                                            <p className="text-lg font-semibold">{vehiculo?.veh_color || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {vehiculos.length > 1 && (
                                        <div className="mt-6">
                                            <h4 className="font-semibold mb-4">Otros vehículos del conductor</h4>
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Patente</TableHead>
                                                            <TableHead>Marca</TableHead>
                                                            <TableHead>Modelo</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {vehiculos.map((v: any) => (
                                                            <TableRow key={v.veh_patente}>
                                                                <TableCell className="font-semibold">{v.veh_patente}</TableCell>
                                                                <TableCell>{v.veh_marca || 'N/A'}</TableCell>
                                                                <TableCell>{v.veh_modelo || 'N/A'}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: Pago */}
                        <TabsContent value="pago" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Información de Pago</CardTitleComponent>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Monto Total</span>
                                            <p className="text-lg font-semibold">{formatCurrency(reserva?.res_monto || 0)}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Método de Pago</span>
                                            <p className="text-lg font-semibold capitalize">{reserva?.metodo_pago?.replace('_', ' ') || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Número de Pago</span>
                                            <p className="text-lg font-semibold">{reserva?.pag_nro || 'Sin pago registrado'}</p>
                                        </div>
                                    </div>

                                    {reserva?.payment_info && (
                                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold mb-2">Información de Pago Adicional</h4>
                                            <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                                                {JSON.stringify(reserva.payment_info, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    )
}
