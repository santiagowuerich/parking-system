"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import { useAbonoExtension } from '@/hooks/use-abono-extension'
import { useTicket } from '@/lib/hooks/use-ticket'
import { TicketDialog } from '@/components/ticket/ticket-dialog'
import { useAuth } from '@/lib/auth-context'
import type { AbonoData, TipoExtension } from '@/lib/types'
import { CONFIGURACIONES_ABONOS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    abono: AbonoData | null
}

const formatDate = (value: string) => {
    if (!value) return '-'
    const iso = value.split('T')[0] ?? value
    const parts = iso.split('-')
    if (parts.length === 3) {
        const [year, month, day] = parts
        return `${day}/${month}/${year}`
    }
    return iso
}

export function ExtenderAbonoDialog({ open, onOpenChange, abono }: Props) {
    const ext = useAbonoExtension(abono)
    const { user } = useAuth()
    const { 
        ticket, 
        isLoading: ticketLoading, 
        isDialogOpen: showTicketDialog, 
        generateSubscriptionExtensionTicket, 
        closeDialog: closeTicketDialog 
    } = useTicket({ autoShowOnGenerate: true })
    
    const config = CONFIGURACIONES_ABONOS[ext.state.tipoExtension]
    const unidadLabel = config?.unidad ?? 'periodos'
    const tipoDescripcion = config?.descripcion ?? `Abono ${ext.state.tipoExtension}`
    const total = ext.state.monto

    // Mapear método de pago del frontend al formato del ticket
    const mapPaymentMethod = (metodo: 'efectivo' | 'tarjeta' | 'transferencia'): 'efectivo' | 'transferencia' | 'qr' | 'link_pago' => {
        if (metodo === 'tarjeta') return 'qr' // Tarjeta se mapea a QR (MercadoPago)
        if (metodo === 'transferencia') return 'transferencia'
        return 'efectivo'
    }

    const handleSubmit = async () => {
        try {
            const result = await ext.submit()
            
            // Si el submit fue exitoso, generar el ticket
            if (result?.success && result?.data && abono) {
                const { pago_id, est_id, veh_patente } = result.data

                if (pago_id && est_id && veh_patente) {
                    await generateSubscriptionExtensionTicket(
                        pago_id,
                        abono.abo_nro,
                        est_id,
                        veh_patente,
                        user?.email || 'Sistema',
                        mapPaymentMethod(ext.state.metodoPago),
                        'reduced',
                        `Extensión ${ext.state.tipoExtension} x${ext.state.cantidad}`
                    )
                }
            }
            
            // Cerrar el modal de extensión
            onOpenChange(false)
        } catch (error) {
            // El error ya se maneja en el hook con un toast
            console.error('Error al extender abono:', error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Extender abono</DialogTitle>
                </DialogHeader>

                <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-6">
                    {abono && (
                        <Card className="p-4 bg-muted/50 space-y-1 text-sm">
                            <div className="font-medium">Abono actual</div>
                            <div>
                                {abono.titular} - {abono.tipoActual} - Vence: {formatDate(abono.fechaFinActual)} - Zona {abono.zona} - {abono.codigo}
                            </div>
                        </Card>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <Label>Tipo de abono y duracion</Label>
                                <Select
                                    value={ext.state.tipoExtension}
                                    onValueChange={value => ext.setTipoExtension(value as TipoExtension)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CONFIGURACIONES_ABONOS).map(([key, cfg]) => (
                                            <SelectItem key={key} value={key}>
                                                {cfg.descripcion}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Cantidad ({unidadLabel})</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={ext.state.cantidad}
                                    onChange={event => ext.setCantidad(parseInt(event.target.value, 10))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Fecha de inicio</Label>
                                <Input type="date" value={ext.state.desde} onChange={event => ext.setDesde(event.target.value)} />
                            </div>
                            <div>
                                <Label>Nuevo vencimiento</Label>
                                <Input type="date" value={ext.state.nuevoVencimiento} readOnly className="bg-muted" />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm text-gray-600">
                            <p>
                                <span className="font-medium">Tipo seleccionado:</span> {tipoDescripcion}
                            </p>
                            <p>
                                <span className="font-medium">Duracion:</span> {ext.state.cantidad} {unidadLabel}
                            </p>
                            <p>
                                <span className="font-medium">Fecha estimada de fin:</span> {formatDate(ext.state.nuevoVencimiento)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Metodo de pago</Label>
                        <RadioGroup
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6"
                            value={ext.state.metodoPago}
                            onValueChange={value =>
                                ext.setMetodoPago(value as 'efectivo' | 'tarjeta' | 'transferencia')
                            }
                        >
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="efectivo" id="efectivo" />
                                <Label htmlFor="efectivo">Efectivo</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="tarjeta" id="tarjeta" />
                                <Label htmlFor="tarjeta">Tarjeta (MercadoPago)</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <RadioGroupItem value="transferencia" id="transferencia" />
                                <Label htmlFor="transferencia">Transferencia</Label>
                            </div>
                        </RadioGroup>

                        {ext.state.metodoPago === 'tarjeta' && (
                            <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Input
                                    placeholder="Numero"
                                    value={ext.state.tarjeta.numero}
                                    onChange={event => ext.setTarjeta({ ...ext.state.tarjeta, numero: event.target.value })}
                                />
                                <Input
                                    placeholder="Venc."
                                    value={ext.state.tarjeta.vencimiento}
                                    onChange={event => ext.setTarjeta({ ...ext.state.tarjeta, vencimiento: event.target.value })}
                                />
                                <Input
                                    placeholder="CVV"
                                    value={ext.state.tarjeta.cvv}
                                    onChange={event => ext.setTarjeta({ ...ext.state.tarjeta, cvv: event.target.value })}
                                />
                            </Card>
                        )}
                    </div>

                    <Card className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Subtotal estimado</span>
                            <span className="flex items-center gap-2">
                                {ext.state.calculating ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : formatCurrency(total)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-lg font-semibold">
                            <span>Total a cobrar</span>
                            <span className="flex items-center gap-2">
                                {ext.state.calculating ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : formatCurrency(total)}
                            </span>
                        </div>
                    </Card>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ext.state.loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!ext.isValid() || ext.state.loading || ext.state.calculating}>
                        {ext.state.loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            'Confirmar extension'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
            
            {/* Diálogo del ticket */}
            <TicketDialog
                ticket={ticket}
                isOpen={showTicketDialog}
                onClose={closeTicketDialog}
                loading={ticketLoading}
                title="Ticket de Extensión de Abono"
            />
        </Dialog>
    )
}
