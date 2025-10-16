"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2 } from 'lucide-react'
import { useAbonoExtension } from '@/hooks/use-abono-extension'
import type { AbonoData } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
    open: boolean
    onOpenChange: (v: boolean) => void
    abono: AbonoData | null
}

export function ExtenderAbonoDialog({ open, onOpenChange, abono }: Props) {
    const ext = useAbonoExtension(abono)

    const subtotal = ext.state.monto

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Extender abono</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Info actual */}
                    {abono && (
                        <Card className="p-4 bg-muted/50 space-y-1 text-sm">
                            <div className="font-medium">Abono actual</div>
                            <div>{abono.titular} · {abono.tipoActual} — Vence: {new Date(abono.fechaFinActual).toLocaleDateString('es-AR')} · zona {abono.zona} - {abono.codigo}</div>
                        </Card>
                    )}

                    {/* Configuración */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="md:col-span-2">
                            <Label>Tipo de extensión</Label>
                            <Select value={ext.state.tipoExtension} onValueChange={v => ext.setTipoExtension(v as any)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mensual">Mensual</SelectItem>
                                    <SelectItem value="bimestral">Bimestral</SelectItem>
                                    <SelectItem value="trimestral">Trimestral</SelectItem>
                                    <SelectItem value="anual">Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Cantidad</Label>
                            <Input type="number" min={1} value={ext.state.cantidad} onChange={e => ext.setCantidad(parseInt(e.target.value))} />
                        </div>
                        <div>
                            <Label>Desde</Label>
                            <Input type="date" value={ext.state.desde} onChange={e => ext.setDesde(e.target.value)} />
                        </div>
                        <div className="md:col-span-2">
                            <Label>Nuevo vencimiento</Label>
                            <Input type="date" value={ext.state.nuevoVencimiento} readOnly className="bg-muted" />
                        </div>
                        <div className="md:col-span-4">
                            <Label>Observación (opcional)</Label>
                            <Textarea value={ext.state.nota} onChange={e => ext.setNota(e.target.value)} rows={2} />
                        </div>
                    </div>

                    {/* Pago */}
                    <div className="space-y-3">
                        <Label>Método de pago</Label>
                        <RadioGroup className="flex gap-6" value={ext.state.metodoPago} onValueChange={v => ext.setMetodoPago(v as any)}>
                            <div className="flex items-center gap-2"><RadioGroupItem value="efectivo" id="efectivo" /><Label htmlFor="efectivo">Efectivo</Label></div>
                            <div className="flex items-center gap-2"><RadioGroupItem value="tarjeta" id="tarjeta" /><Label htmlFor="tarjeta">Tarjeta (MercadoPago)</Label></div>
                            <div className="flex items-center gap-2"><RadioGroupItem value="transferencia" id="transferencia" /><Label htmlFor="transferencia">Transferencia</Label></div>
                        </RadioGroup>

                        {ext.state.metodoPago === 'tarjeta' && (
                            <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Input placeholder="Nº" value={ext.state.tarjeta.numero} onChange={e => ext.setTarjeta({ ...ext.state.tarjeta, numero: e.target.value })} />
                                <Input placeholder="Venc." value={ext.state.tarjeta.vencimiento} onChange={e => ext.setTarjeta({ ...ext.state.tarjeta, vencimiento: e.target.value })} />
                                <Input placeholder="CVV" value={ext.state.tarjeta.cvv} onChange={e => ext.setTarjeta({ ...ext.state.tarjeta, cvv: e.target.value })} />
                            </Card>
                        )}
                    </div>

                    {/* Resumen */}
                    <Card className="p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold">
                            <span>Total a cobrar</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                    </Card>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ext.state.loading}>Cancelar</Button>
                    <Button onClick={ext.submit} disabled={!ext.isValid() || ext.state.loading}>
                        {ext.state.loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>) : 'Confirmar extensión'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


