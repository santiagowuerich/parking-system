"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"
import type { VehicleType } from "@/lib/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Modalidad = 'Hora' | 'Diaria' | 'Mensual'
type PlazaTipo = 'Normal' | 'VIP' | 'Reservada'

const segToName = (s: string) => (s === 'MOT' ? 'Moto' : s === 'CAM' ? 'Camioneta' : 'Auto') as VehicleType
const nameToSeg = (t: string) => (t === 'Moto' ? 'MOT' : t === 'Camioneta' ? 'CAM' : 'AUT')

export default function TariffsManagerPage() {
  const { user, estId } = useAuth()
  const [modalidad, setModalidad] = useState<Modalidad>('Hora')
  const [plaTipo, setPlaTipo] = useState<PlazaTipo>('Normal')
  const [rates, setRates] = useState<Record<VehicleType, number>>({ Auto: 0, Moto: 0, Camioneta: 0 })
  const [versions, setVersions] = useState<any[]>([])
  const [calcVehicle, setCalcVehicle] = useState<VehicleType>('Auto')
  const [calcHours, setCalcHours] = useState<number>(1)
  const [calcFee, setCalcFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [baselineNormalHora, setBaselineNormalHora] = useState<Record<VehicleType, number> | null>(null)

  // Cargar últimas tarifas por modalidad/plaza seleccionadas usando versions
  useEffect(() => {
    const load = async () => {
      try {
        const tiptar = modalidad === 'Hora' ? 1 : modalidad === 'Diaria' ? 2 : 3
        const res = await fetch(`/api/rates/versions?tiptar=${tiptar}&pla=${plaTipo}&est_id=${estId}`)
        if (res.ok) {
          const js = await res.json()
          const list = Array.isArray(js.tarifas) ? js.tarifas : []
          setVersions(list)
          // construir últimas por segmento
          const latest = { Auto: 0, Moto: 0, Camioneta: 0 } as Record<VehicleType, number>
          const seen: Record<string, boolean> = {}
          for (const row of list) {
            if (!seen[row.catv_segmento]) {
              seen[row.catv_segmento] = true
              latest[segToName(row.catv_segmento)] = Number(row.tar_precio)
            }
          }
          setRates(latest)
        }
      } catch (e) {
        console.error('Error cargando tarifas:', e)
      }
    }
    load()
  }, [modalidad, plaTipo, estId])

  // Cargar base "Normal/Hora" para sugerencias (VIP/Reservada)
  useEffect(() => {
    const loadBase = async () => {
      try {
        const res = await fetch(`/api/rates/versions?tiptar=1&pla=Normal&est_id=${estId}`)
        if (res.ok) {
          const js = await res.json()
          const list = Array.isArray(js.tarifas) ? js.tarifas : []
          const latest: Record<VehicleType, number> = { Auto: 0, Moto: 0, Camioneta: 0 }
          const seen: Record<string, boolean> = {}
          for (const row of list) {
            if (!seen[row.catv_segmento]) {
              seen[row.catv_segmento] = true
              latest[segToName(row.catv_segmento)] = Number(row.tar_precio)
            }
          }
          setBaselineNormalHora(latest)
        }
      } catch {}
    }
    loadBase()
  }, [estId])

  const handleRateChange = (type: VehicleType, value: string) => {
    const v = Number(value)
    if (isNaN(v) || v < 0) return
    setRates(prev => ({ ...prev, [type]: v }))
  }

  const handleSave = async () => {
    if (!user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debe iniciar sesión' })
      return
    }
    setConfirmOpen(true)
  }

  const doSave = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/rates?est_id=${estId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates, modalidad, tipoPlaza: plaTipo })
      })
      if (!res.ok) {
        const e = await res.json().catch(()=>({}))
        throw new Error(e.error || 'Error al guardar tarifas')
      }
      setConfirmOpen(false)
      toast({ title: 'Tarifas actualizadas', description: `Tarifas ${modalidad} (${plaTipo}) guardadas` })
    } catch (e: any) {
      console.error(e)
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudieron guardar las tarifas' })
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = () => {
    // VIP: +20% sobre Normal/Hora
    // Reservada: si Mensual, calcular desde Normal/Hora * 24 * 30 * 0.8 ; si no, advertir
    if (!baselineNormalHora) return
    if (plaTipo === 'VIP') {
      const uplift = 1.2
      setRates({
        Auto: Math.round((baselineNormalHora.Auto * uplift + Number.EPSILON) * 100) / 100,
        Moto: Math.round((baselineNormalHora.Moto * uplift + Number.EPSILON) * 100) / 100,
        Camioneta: Math.round((baselineNormalHora.Camioneta * uplift + Number.EPSILON) * 100) / 100,
      })
      toast({ title: 'Sugerencia aplicada', description: 'VIP: +20% sobre Normal/Hora' })
    } else if (plaTipo === 'Reservada') {
      if (modalidad !== 'Mensual') {
        toast({ variant: 'destructive', title: 'Sugerencia', description: 'Para plazas Reservadas se recomienda modalidad Mensual.' })
        return
      }
      const factor = 24 * 30 * 0.8 // 20% descuento sobre mensual estimado
      setRates({
        Auto: Math.round((baselineNormalHora.Auto * factor + Number.EPSILON) * 100) / 100,
        Moto: Math.round((baselineNormalHora.Moto * factor + Number.EPSILON) * 100) / 100,
        Camioneta: Math.round((baselineNormalHora.Camioneta * factor + Number.EPSILON) * 100) / 100,
      })
      toast({ title: 'Sugerencia aplicada', description: 'Reservada/Mensual estimada desde Normal/Hora con 20% descuento.' })
    }
  }

  const handleCalculate = async () => {
    try {
      const now = new Date()
      const entry = new Date(now.getTime() - Math.max(1, calcHours) * 60 * 60 * 1000)
      const res = await fetch(`/api/pricing/calculate?est_id=${estId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleType: calcVehicle, entry_time: entry.toISOString(), exit_time: now.toISOString(), modalidad, pla_tipo: plaTipo })
      })
      if (!res.ok) throw new Error('Error al calcular')
      const js = await res.json()
      setCalcFee(Number(js.fee || 0))
    } catch (e) {
      setCalcFee(null)
    }
  }

  const versionsBySeg = useMemo(() => {
    const map: Record<string, any[]> = { AUT: [], MOT: [], CAM: [] }
    for (const v of versions) map[v.catv_segmento]?.push(v)
    return map
  }, [versions])

  return (
    <div className="container mx-auto p-4 grid gap-6 md:grid-cols-3">
      <div className="md:col-span-3 flex justify-between items-center">
        <h1 className="text-xl font-semibold dark:text-zinc-100">Gestión de Tarifas</h1>
        <Button variant="outline" className="dark:border-zinc-700 dark:text-zinc-100" asChild>
          <Link href="/">Volver al menú</Link>
        </Button>
      </div>
      <Card className="md:col-span-2 dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configurar Tarifas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="dark:text-zinc-400">Modalidad</Label>
              <Select value={modalidad} onValueChange={(v:any)=> setModalidad(v)}>
                <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"><SelectValue placeholder="Modalidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hora">Hora</SelectItem>
                  <SelectItem value="Diaria">Diaria</SelectItem>
                  <SelectItem value="Mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-zinc-400">Tipo de Plaza</Label>
              <Select value={plaTipo} onValueChange={(v:any)=> setPlaTipo(v)}>
                <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"><SelectValue placeholder="Plaza" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Reservada">Reservada</SelectItem>
                </SelectContent>
              </Select>
              {(plaTipo === 'VIP' || plaTipo === 'Reservada') && (
                <Button type="button" variant="outline" onClick={applySuggestion} className="w-full dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                  Aplicar sugerencia {plaTipo === 'VIP' ? '(+20% VIP)' : '(Mensual estimada)' }
                </Button>
              )}
              {plaTipo === 'Reservada' && modalidad !== 'Mensual' && (
                <p className="text-xs text-amber-600">Sugerencia: usar modalidad Mensual para plazas Reservadas.</p>
              )}
            </div>
          </div>
          {(["Auto","Moto","Camioneta"] as VehicleType[]).map((t)=> (
            <div key={t} className="space-y-1">
              <Label className="dark:text-zinc-400">{t}</Label>
              <Input value={rates[t] ?? ''} type="number" step="0.01" min={0} onChange={(e)=> handleRateChange(t, e.target.value)} className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={handleSave} disabled={loading} className="dark:bg-white dark:text-black dark:hover:bg-gray-200 w-full">{loading ? 'Guardando...' : 'Guardar Tarifas'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Previsualizar Cálculo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="dark:text-zinc-400">Vehículo</Label>
            <Select value={calcVehicle} onValueChange={(v:any)=> setCalcVehicle(v)}>
              <SelectTrigger className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Auto">Auto</SelectItem>
                <SelectItem value="Moto">Moto</SelectItem>
                <SelectItem value="Camioneta">Camioneta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="dark:text-zinc-400">Horas</Label>
            <Input type="number" min={1} value={calcHours} onChange={(e)=> setCalcHours(Math.max(1, Number(e.target.value))) } className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          </div>
          <Button onClick={handleCalculate} className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200">Calcular</Button>
          <div className="text-center dark:text-zinc-100 text-xl">{calcFee != null ? `$ ${calcFee.toFixed(2)}` : '—'}</div>
        </CardContent>
      </Card>

      <Card className="md:col-span-3 dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Historial de Tarifas</CardTitle>
        </CardHeader>
        <CardContent>
          {(['AUT','MOT','CAM'] as const).map(seg => (
            <div key={seg} className="mb-4">
              <h3 className="font-semibold mb-2 dark:text-zinc-200">{segToName(seg)}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-zinc-800">
                      <TableHead className="dark:text-zinc-400">Fecha desde</TableHead>
                      <TableHead className="dark:text-zinc-400">Precio</TableHead>
                      <TableHead className="dark:text-zinc-400">Modalidad</TableHead>
                      <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(versionsBySeg[seg] || []).map((v:any, i:number) => (
                      <TableRow key={`${seg}-${i}`} className="dark:border-zinc-800">
                        <TableCell className="dark:text-zinc-200">{new Date(v.tar_f_desde).toLocaleString('es-AR')}</TableCell>
                        <TableCell className="dark:text-zinc-200">${Number(v.tar_precio).toFixed(2)}</TableCell>
                        <TableCell className="dark:text-zinc-200">{v.tiptar_nro === 1 ? 'Hora' : v.tiptar_nro === 2 ? 'Diaria' : 'Mensual'}</TableCell>
                        <TableCell className="dark:text-zinc-200">{v.pla_tipo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Confirmación guardar */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-zinc-100">Confirmar guardado de tarifas</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-zinc-400">
              Se guardarán nuevas tarifas para <strong>{modalidad}</strong> y plaza <strong>{plaTipo}</strong> en el estacionamiento {estId}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-zinc-800">
                  <TableHead className="dark:text-zinc-400">Tipo</TableHead>
                  <TableHead className="dark:text-zinc-400">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["Auto","Moto","Camioneta"] as VehicleType[]).map(t => (
                  <TableRow key={t} className="dark:border-zinc-800">
                    <TableCell className="dark:text-zinc-200">{t}</TableCell>
                    <TableCell className="dark:text-zinc-200">${Number(rates[t] || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-transparent dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-gray-200">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


