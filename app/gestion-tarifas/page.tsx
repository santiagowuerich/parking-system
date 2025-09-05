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
import { Switch } from "@/components/ui/switch"

type Modalidad = 'Hora' | 'Diaria' | 'Mensual'
type PlazaTipo = 'Normal' | 'VIP' | 'Reservada'

const segToName = (s: string) => (s === 'MOT' ? 'Moto' : s === 'CAM' ? 'Camioneta' : 'Auto') as VehicleType
const nameToSeg = (t: string) => (t === 'Moto' ? 'MOT' : t === 'Camioneta' ? 'CAM' : 'AUT')

export default function TariffsManagerPage() {
  const { user, estId } = useAuth()

  // Debug: mostrar estId en consola
  useEffect(() => {
    console.log(`🎯 TariffsManagerPage - estId actual: ${estId}`);
  }, [estId]);
  const [modalidad, setModalidad] = useState<Modalidad>('Hora')
  const plaTipo = 'Normal' // Fijo en Normal
  const [rates, setRates] = useState<Record<VehicleType, number>>({ Auto: 0, Moto: 0, Camioneta: 0 })
  const [versions, setVersions] = useState<any[]>([])
  const [calcVehicle, setCalcVehicle] = useState<VehicleType>('Auto')
  const [calcHours, setCalcHours] = useState<number>(1)
  const [calcFee, setCalcFee] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [baselineNormalHora, setBaselineNormalHora] = useState<Record<VehicleType, number> | null>(null)

  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [savedRates, setSavedRates] = useState<{ rates: Record<VehicleType, number>, modalidad: string, plaTipo: string } | null>(null)

  // Estados para configuración de MercadoPago y Transferencia
  const [mercadopagoApiKey, setMercadopagoApiKey] = useState("")
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [bankAccountHolder, setBankAccountHolder] = useState("")
  const [bankAccountCbu, setBankAccountCbu] = useState("")
  const [bankAccountAlias, setBankAccountAlias] = useState("")
  const [isSavingTransfer, setIsSavingTransfer] = useState(false)

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
      } catch { }
    }
    loadBase()
  }, [estId])

  // NUEVA SECCIÓN: Métodos de pago simplificados
  const [simplePaymentMethods, setSimplePaymentMethods] = useState([
    { method: 'Efectivo', description: 'Pago en efectivo', enabled: true },
    { method: 'Transferencia', description: 'Transferencia bancaria', enabled: true },
    { method: 'MercadoPago', description: 'Pago vía MercadoPago', enabled: true },
    { method: 'QR', description: 'Código QR de MercadoPago', enabled: true }
  ]);

  const handleSimplePaymentToggle = async (method: string, enabled: boolean) => {
    try {
      // Usar estId del contexto o del localStorage
      let currentEstId = estId;
      if (!currentEstId && typeof window !== 'undefined') {
        const savedEstId = localStorage.getItem('parking_est_id');
        if (savedEstId) {
          currentEstId = parseInt(savedEstId);
        }
      }

      if (!currentEstId) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se puede actualizar método de pago sin estacionamiento seleccionado'
        });
        return;
      }

      console.log(`🔄 Actualizando ${method} a ${enabled} para estId: ${currentEstId}`);

      const res = await fetch(`/api/payment/methods?est_id=${currentEstId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, enabled })
      });

      if (!res.ok) {
        throw new Error('Error al actualizar método de pago');
      }

      // Actualizar el estado local
      setSimplePaymentMethods(prev =>
        prev.map(pm =>
          pm.method === method ? { ...pm, enabled } : pm
        )
      );

      toast({
        title: enabled ? 'Método habilitado' : 'Método deshabilitado',
        description: `${method} ${enabled ? 'habilitado' : 'deshabilitado'} correctamente`
      });
    } catch (e: any) {
      console.error('Error:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e.message || 'No se pudo actualizar el método de pago'
      });
    }
  };

  // Cargar configuración del usuario (MercadoPago y Transferencia)
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!user?.id) return

      try {
        const response = await fetch('/api/user/settings')
        if (response.ok) {
          const settings = await response.json()
          setMercadopagoApiKey(settings.mercadopagoApiKey || "")
          setBankAccountHolder(settings.bankAccountHolder || "")
          setBankAccountCbu(settings.bankAccountCbu || "")
          setBankAccountAlias(settings.bankAccountAlias || "")
        }
      } catch (error) {
        console.error('Error cargando configuración del usuario:', error)
      }
    }

    loadUserSettings()
  }, [user?.id])

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
      console.log('🔄 Guardando tarifas:', { rates, modalidad, plaTipo, estId })

      const res = await fetch(`/api/rates?est_id=${estId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates, modalidad, tipoPlaza: plaTipo })
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        console.error('❌ Error en respuesta del servidor:', e)
        throw new Error(e.error || 'Error al guardar tarifas')
      }

      const result = await res.json()
      console.log('✅ Tarifas guardadas exitosamente:', result)

      // Guardar los datos para mostrar en el diálogo de éxito
      setSavedRates({ rates: { ...rates }, modalidad, plaTipo })
      setConfirmOpen(false)
      setSuccessDialogOpen(true)

      // Recargar las versiones para mostrar la nueva tarifa en la tabla
      console.log('🔄 Recargando versiones de tarifas...')
      const tiptar = modalidad === 'Hora' ? 1 : modalidad === 'Diaria' ? 2 : 3
      const versionsRes = await fetch(`/api/rates/versions?tiptar=${tiptar}&pla=${plaTipo}&est_id=${estId}`)
      if (versionsRes.ok) {
        const versionsData = await versionsRes.json()
        const list = Array.isArray(versionsData.tarifas) ? versionsData.tarifas : []
        setVersions(list)
        console.log('✅ Versiones recargadas:', list.length, 'entradas')

        // Actualizar los inputs con las nuevas tarifas guardadas
        const currentLatest = { Auto: 0, Moto: 0, Camioneta: 0 } as Record<VehicleType, number>
        const currentSeen: Record<string, boolean> = {}
        for (const row of list) {
          if (!currentSeen[row.catv_segmento]) {
            currentSeen[row.catv_segmento] = true
            const vehicleType = row.catv_segmento === 'MOT' ? 'Moto' : row.catv_segmento === 'CAM' ? 'Camioneta' : 'Auto'
            currentLatest[vehicleType] = Number(row.tar_precio)
          }
        }
        setRates(currentLatest)
        console.log('✅ Tarifas actualizadas en inputs:', currentLatest)

        // También actualizar baselineNormalHora si corresponde
        if (modalidad === 'Hora' && plaTipo === 'Normal') {
          setBaselineNormalHora(currentLatest)
          console.log('✅ Baseline actualizado:', currentLatest)
        }
      } else {
        console.warn('⚠️ No se pudieron recargar las versiones')
      }

    } catch (e: any) {
      console.error('❌ Error guardando tarifas:', e)
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'No se pudieron guardar las tarifas' })
    } finally {
      setLoading(false)
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



  const handleSaveApiKey = async () => {
    if (!user?.id) return
    setIsSavingApiKey(true)
    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id, mercadopagoApiKey }),
      })
      if (!response.ok) throw new Error("Error al guardar API key")
      toast({ title: "API Key guardada", description: "La API Key de MercadoPago se ha guardado." })
    } catch (error) {
      console.error("Error al guardar API key:", error)
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la API Key." })
    } finally {
      setIsSavingApiKey(false)
    }
  }

  const handleSaveTransferDetails = async () => {
    if (!user?.id) return
    setIsSavingTransfer(true)
    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          bankAccountHolder: bankAccountHolder,
          bankAccountCbu: bankAccountCbu,
          bankAccountAlias: bankAccountAlias
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Error al guardar datos de transferencia")
      }
      toast({ title: "Datos de Transferencia guardados", description: "La información se ha actualizado." })
    } catch (error: any) {
      console.error("Error al guardar datos de transferencia:", error)
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron guardar los datos de transferencia." })
    } finally {
      setIsSavingTransfer(false)
    }
  }

  const versionsBySeg = useMemo(() => {
    const map: Record<string, any[]> = { AUT: [], MOT: [], CAM: [] }
    for (const v of versions) map[v.catv_segmento]?.push(v)
    return map
  }, [versions])

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/">Volver al menú</Link>
        </Button>
        <h1 className="text-xl font-semibold dark:text-zinc-100 absolute left-1/2 transform -translate-x-1/2">Gestión de Tarifas</h1>
        <div></div> {/* Spacer para mantener el balance */}
      </div>

      {/* Grid horizontal para los dos modales principales */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Configurar Tarifas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="dark:text-zinc-400">Modalidad</Label>
              <Select value={modalidad} onValueChange={(v: any) => setModalidad(v)}>
                <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hora">Hora</SelectItem>
                  <SelectItem value="Diaria">Diaria</SelectItem>
                  <SelectItem value="Mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((t) => (
              <div key={t} className="space-y-1">
                <Label className="dark:text-zinc-400">{t}</Label>
                <Input value={rates[t] ?? ''} type="number" step="0.01" min={0} onChange={(e) => handleRateChange(t, e.target.value)} />
              </div>
            ))}
            <div className="pt-2">
              <Button onClick={handleSave} disabled={loading} className="dark:bg-white dark:text-black dark:hover:bg-gray-200 w-full">{loading ? 'Guardando...' : 'Guardar Tarifas'}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Previsualizar Cálculo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="dark:text-zinc-400">Vehículo</Label>
              <Select value={calcVehicle} onValueChange={(v: any) => setCalcVehicle(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Auto">Auto</SelectItem>
                  <SelectItem value="Moto">Moto</SelectItem>
                  <SelectItem value="Camioneta">Camioneta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="dark:text-zinc-400">Horas</Label>
              <Input type="number" min={1} value={calcHours} onChange={(e) => setCalcHours(Math.max(1, Number(e.target.value)))} />
            </div>
            <Button onClick={handleCalculate} className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200">Calcular</Button>
            <div className="text-center dark:text-zinc-100 text-xl">{calcFee != null ? `$ ${calcFee.toFixed(2)}` : '—'}</div>
          </CardContent>
        </Card>
      </div>



      {/* NUEVA SECCIÓN: Métodos de pago simplificados */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configuración de Métodos de Pago</CardTitle>
          <p className="text-sm text-zinc-400">Habilita o deshabilita los métodos de pago disponibles</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {simplePaymentMethods.map((pm) => (
              <div key={pm.method} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex flex-col">
                  <span className="font-medium dark:text-zinc-100">{pm.method}</span>
                  <span className="text-sm text-zinc-400">{pm.description}</span>
                  <span className={`text-xs mt-1 ${pm.enabled ? 'text-green-400' : 'text-red-400'}`}>
                    {pm.enabled ? '✅ Habilitado' : '❌ Deshabilitado'}
                  </span>
                </div>
                <Switch
                  checked={pm.enabled}
                  onCheckedChange={(checked) => handleSimplePaymentToggle(pm.method, checked)}
                />
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-zinc-500 mt-4">
            <p>💡 Los cambios se guardan automáticamente en la base de datos</p>
            <p>🎯 Estacionamiento actual: {estId || 'No seleccionado'}</p>
          </div>
        </CardContent>
      </Card>




      {/* Historial de tarifas */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Historial de Tarifas</CardTitle>
        </CardHeader>
        <CardContent>
          {(['AUT', 'MOT', 'CAM'] as const).map(seg => (
            <div key={seg} className="mb-4">
              <h3 className="font-semibold mb-2 dark:text-zinc-200">{segToName(seg)}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="dark:text-zinc-400">Fecha desde</TableHead>
                      <TableHead className="dark:text-zinc-400">Precio</TableHead>
                      <TableHead className="dark:text-zinc-400">Modalidad</TableHead>
                      <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(versionsBySeg[seg] || []).map((v: any, i: number) => (
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

      {/* Configuración de MercadoPago */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configuración de MercadoPago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mercadopago-api-key" className="dark:text-zinc-400">API Key</Label>
            <Input
              id="mercadopago-api-key"
              type="password"
              value={mercadopagoApiKey}
              onChange={(e) => setMercadopagoApiKey(e.target.value)}
              placeholder="Ingresa tu API Key"
              disabled={isSavingApiKey}
            />
            <p className="text-xs text-muted-foreground dark:text-zinc-500">Tu Access Token de producción (APP_USR-...) o pruebas (TEST-...).</p>
          </div>
          <div className="pt-2">
            <Button
              onClick={handleSaveApiKey}
              disabled={isSavingApiKey}
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isSavingApiKey ? "Guardando..." : "Guardar API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de Transferencia */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Configuración de Transferencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bankHolder" className="dark:text-zinc-400">Nombre del Titular</Label>
            <Input
              id="bankHolder"
              value={bankAccountHolder}
              onChange={(e) => setBankAccountHolder(e.target.value)}
              disabled={isSavingTransfer}
              placeholder="Nombre completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankCbu" className="dark:text-zinc-400">CBU / CVU</Label>
            <Input
              id="bankCbu"
              value={bankAccountCbu}
              onChange={(e) => setBankAccountCbu(e.target.value)}
              disabled={isSavingTransfer}
              placeholder="22 dígitos (CBU) o Alias.CVU"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAlias" className="dark:text-zinc-400">Alias</Label>
            <Input
              id="bankAlias"
              value={bankAccountAlias}
              onChange={(e) => setBankAccountAlias(e.target.value)}
              disabled={isSavingTransfer}
              placeholder="tu.alias.mp"
            />
          </div>
          <div className="pt-4">
            <Button
              onClick={handleSaveTransferDetails}
              disabled={isSavingTransfer}
              className="w-full dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              {isSavingTransfer ? "Guardando..." : "Guardar Datos Transferencia"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmación guardar */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
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
                {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map(t => (
                  <TableRow key={t} className="dark:border-zinc-800">
                    <TableCell className="dark:text-zinc-200">{t}</TableCell>
                    <TableCell className="dark:text-zinc-200">${Number(rates[t] || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-white dark:text-black dark:hover:bg-gray-200">Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de éxito */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-zinc-100 text-center text-green-600">
              ¡Tarifas Actualizadas Exitosamente! ✅
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-zinc-400 text-center">
              Se han guardado las nuevas tarifas para <strong>{savedRates?.modalidad}</strong> en plazas <strong>{savedRates?.plaTipo}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <h4 className="text-sm font-medium dark:text-zinc-300 mb-3 text-center">Precios actualizados:</h4>
            <div className="space-y-3">
              {savedRates && (["Auto", "Moto", "Camioneta"] as VehicleType[]).map(vehicleType => (
                <div key={vehicleType} className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <span className="font-medium dark:text-zinc-200">{vehicleType}</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    ${Number(savedRates.rates[vehicleType] || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Las nuevas tarifas ya están disponibles para los cálculos de estacionamiento
          </div>

          <AlertDialogFooter className="justify-center">
            <AlertDialogAction
              onClick={() => setSuccessDialogOpen(false)}
              className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-700 min-w-[120px]"
            >
              ¡Perfecto!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


