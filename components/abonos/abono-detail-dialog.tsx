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

interface Props {
    open: boolean
    onOpenChange: (v: boolean) => void
    abo_nro: number | null
}

export function AbonoDetailDialog({ open, onOpenChange, abo_nro }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        if (!open || !abo_nro) return

        const fetchDetail = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(`/api/abonos/detail?abo_nro=${abo_nro}`)
                if (!res.ok) throw new Error('No se pudo cargar detalle')
                const detail = await res.json()
                setData(detail)
            } catch (e: any) {
                console.error(e)
                setError(e.message || 'Error cargando detalle')
            } finally {
                setLoading(false)
            }
        }

        fetchDetail()
    }, [open, abo_nro])

    if (!data && !loading && !error) return null

    const abono = data?.abono
    const conductor = data?.conductor
    const vehiculos = data?.vehiculos || []
    const pagos = data?.pagos || []

    const getEstadoAbono = () => {
        if (!abono) return 'Desconocido'
        const today = new Date()
        const vence = new Date(abono.abo_fecha_fin)
        if (vence < today) return 'Vencido'
        const diasRestantes = Math.ceil((vence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return diasRestantes <= 7 ? 'Por vencer' : 'Activo'
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalle del Abono #{abo_nro}</DialogTitle>
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

                {!loading && data && (
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="conductor">Conductor</TabsTrigger>
                            <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
                            <TabsTrigger value="pagos">Pagos</TabsTrigger>
                        </TabsList>

                        {/* TAB: General */}
                        <TabsContent value="general" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Información del Abono</CardTitleComponent>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Número de Abono</span>
                                            <p className="text-lg font-semibold">{abono?.abo_nro}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Tipo</span>
                                            <p className="text-lg font-semibold capitalize">{abono?.abo_tipoabono}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Fecha Inicio</span>
                                            <p className="text-lg font-semibold">{dayjs.utc(abono?.abo_fecha_inicio).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Fecha Vencimiento</span>
                                            <p className="text-lg font-semibold">{dayjs.utc(abono?.abo_fecha_fin).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Zona</span>
                                            <p className="text-lg font-semibold">{(abono?.plazas as any)?.pla_zona || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Plaza</span>
                                            <p className="text-lg font-semibold">{abono?.pla_numero}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Estado</span>
                                            <Badge className={getEstadoAbono() === 'Activo' ? 'bg-green-100 text-green-800' : getEstadoAbono() === 'Por vencer' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                                                {getEstadoAbono()}
                                            </Badge>
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
                                            <p className="text-lg font-semibold">{conductor?.usu_nom || (abono?.abonado?.abon_nombre || 'N/A')}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">Apellido</span>
                                            <p className="text-lg font-semibold">{conductor?.usu_ape || (abono?.abonado?.abon_apellido || 'N/A')}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600">DNI</span>
                                            <p className="text-lg font-semibold">{conductor?.usu_dni || (abono?.abonado?.abon_dni || 'N/A')}</p>
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

                        {/* TAB: Vehículos */}
                        <TabsContent value="vehiculos" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Vehículos Asociados</CardTitleComponent>
                                    <CardDescription>{vehiculos.length} vehículo(s)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {vehiculos.length === 0 ? (
                                        <p className="text-gray-500">Sin vehículos asociados</p>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Patente</TableHead>
                                                        <TableHead>Tipo</TableHead>
                                                        <TableHead>Marca</TableHead>
                                                        <TableHead>Modelo</TableHead>
                                                        <TableHead>Color</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {vehiculos.map((v: any) => (
                                                        <TableRow key={v.veh_patente}>
                                                            <TableCell className="font-semibold">{v.veh_patente}</TableCell>
                                                            <TableCell>{segmentToName(v.vehiculos?.catv_segmento)}</TableCell>
                                                            <TableCell>{v.vehiculos?.veh_marca || 'N/A'}</TableCell>
                                                            <TableCell>{v.vehiculos?.veh_modelo || 'N/A'}</TableCell>
                                                            <TableCell>{v.vehiculos?.veh_color || 'N/A'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB: Pagos */}
                        <TabsContent value="pagos" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitleComponent>Historial de Pagos</CardTitleComponent>
                                    <CardDescription>{pagos.length} pago(s)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {pagos.length === 0 ? (
                                        <p className="text-gray-500">Sin pagos registrados</p>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead>Tipo</TableHead>
                                                        <TableHead>Monto</TableHead>
                                                        <TableHead>Método</TableHead>
                                                        <TableHead>Descripción</TableHead>
                                                        <TableHead>Estado</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {pagos.map((p: any) => (
                                                        <TableRow key={p.pag_nro}>
                                                            <TableCell className="text-sm">{dayjs.utc(p.pag_h_fh).tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY')}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={p.pag_tipo === 'extension' ? 'default' : 'secondary'}>
                                                                    {p.pag_tipo === 'extension' ? 'Extensión' : 'Ocupación'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="font-semibold">{formatCurrency(p.pag_monto)}</TableCell>
                                                            <TableCell className="text-sm">{p.mepa_metodo}</TableCell>
                                                            <TableCell className="text-sm">{p.pag_descripcion || 'N/A'}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={p.pag_estado === 'completado' ? 'default' : 'secondary'}>
                                                                    {p.pag_estado}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
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
