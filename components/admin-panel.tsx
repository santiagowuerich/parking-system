"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2, ArrowLeft, Filter, CheckCircle2 } from "lucide-react"
import type { ParkingHistory, VehicleType } from "@/lib/types"
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils"
import HistoryFilters from "./history-filters"
import { toast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"
import { createBrowserClient } from "@supabase/ssr"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Chatbot } from './ui/chatbot'
import { ZoneManager } from './admin/ZoneManager'

// --- Importar y configurar Day.js --- 
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
// -----------------------------------

interface AdminPanelProps {
  history: ParkingHistory[]
  availableSpaces: {
    Auto: number
    Moto: number
    Camioneta: number
    total: {
      capacity: number
      occupied: number
    }
  }
  capacity: {
    Auto: number
    Moto: number
    Camioneta: number
  }
  onUpdateCapacity: (type: VehicleType, value: number) => void
  onDeleteHistoryEntry?: (id: string) => Promise<void>
  onUpdateHistoryEntry?: (id: string, data: Partial<ParkingHistory>) => Promise<void>
  onReenterVehicle?: (entry: ParkingHistory) => Promise<void>
}

// --- Función de formato con Day.js --- 
const formatArgentineTimeWithDayjs = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "N/A"; // Manejar nulos/undefined
  try {
    const dateUtc = dayjs.utc(dateString);
    if (!dateUtc.isValid()) {
      return "Fecha inválida";
    }
    return dateUtc.tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY hh:mm:ss A');
  } catch (error) {
    console.error("Error formateando fecha con Day.js en AdminPanel:", error);
    return "Error";
  }
};
// ---------------------------------------

export default function AdminPanel({
  history,
  availableSpaces,
  capacity,
  onUpdateCapacity,
  onDeleteHistoryEntry,
  onUpdateHistoryEntry,
  onReenterVehicle,
}: AdminPanelProps) {

  // Debug log para verificar los datos del historial
  useEffect(() => {
    console.log('📊 AdminPanel - Datos del historial recibidos:', {
      historyLength: history?.length || 0,
      historyData: history?.slice(0, 3), // Primeros 3 registros para debug
      isArray: Array.isArray(history)
    });
    // Actualizar el historial filtrado cuando cambien los props
    setFilteredHistory(history || []);
  }, [history]);
  const { user, refreshCapacity, estId } = useAuth();
  const [plazasStatus, setPlazasStatus] = useState<{ [seg: string]: { total: number, occupied: number, free: number, plazas: { pla_numero: number, occupied: boolean }[] } } | null>(null)
  const [filteredHistory, setFilteredHistory] = useState<ParkingHistory[]>(history || []);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [tempCapacities, setTempCapacities] = useState(capacity);
  const [editingEntry, setEditingEntry] = useState<ParkingHistory | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ParkingHistory | null>(null);
  const [multipleDelete, setMultipleDelete] = useState(false);
  const [reenterDialogOpen, setReenterDialogOpen] = useState(false);
  const [entryToReenter, setEntryToReenter] = useState<ParkingHistory | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayIncome = filteredHistory
    .filter((entry) => new Date(entry.exit_time) >= today)
    .reduce((sum, entry) => sum + entry.fee, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const weekIncome = filteredHistory
    .filter((entry) => new Date(entry.exit_time) >= weekAgo)
    .reduce((sum, entry) => sum + entry.fee, 0)

  const handleChange = (type: VehicleType, value: number) => {
    setTempCapacities((prev) => ({ ...prev, [type]: value }))
  }

  const handleRegeneratePlazas = async () => {
    if (!estId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "ID de estacionamiento no válido"
      });
      return;
    }

    try {
      console.log('🔄 Regenerando plazas...');

      const response = await fetch('/api/capacity/plazas/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          estId: estId,
          target: tempCapacities
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error regenerando plazas');
      }

      const result = await response.json();
      console.log('✅ Plazas regeneradas:', result);

      toast({
        title: "Éxito",
        description: `Plazas regeneradas exitosamente. Total: ${result.plazas?.length || 0} plazas.`
      });

      // Refrescar la página para ver los cambios
      window.location.reload();

    } catch (error: any) {
      console.error('❌ Error regenerando plazas:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Error regenerando las plazas'
      });
    }
  };

  const handleSave = async () => {
    try {
      if (!user?.id) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debe iniciar sesión para guardar la capacidad"
        });
        return;
      }

      // Obtener el token de sesión
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se encontró una sesión válida"
        });
        return;
      }

      const currentUserId = session?.user?.id;

      // Verificar que estId no sea null/undefined
      if (!estId || estId <= 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "ID de estacionamiento no válido"
        });
        return;
      }

      console.log('Enviando capacidad:', {
        userId: currentUserId,
        estId: estId,
        capacity: tempCapacities,
        sessionValid: !!session
      });

      // 1) Actualizar total en estacionamientos
      const response = await fetch(`/api/capacity?est_id=${estId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          capacity: tempCapacities,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al actualizar la capacidad");
      }

      // 2) Sincronizar plazas de manera inteligente (preservando vehículos estacionados)
      //    El botón Guardar ahora usa la lógica inteligente de sync en lugar de reset destructivo
      const targetForSync = {
        Auto: Number(tempCapacities.Auto || 0),
        Moto: Number(tempCapacities.Moto || 0),
        Camioneta: Number(tempCapacities.Camioneta || 0),
      };

      console.log('🔄 Sincronizando plazas de manera inteligente:', { estId, targetForSync });

      // 🕵️ LOGGING ESTRATÉGICO: Estado antes de la sincronización
      console.log('🎯 INICIO DEL PROCESO DE SINCRONIZACIÓN:', {
        accion: 'Reducir capacidad de Autos',
        capacidadAnterior: capacity.Auto,
        capacidadNueva: targetForSync.Auto,
        mensaje: 'Si hay un vehículo en plaza 10, debería ser preservado'
      });
      const syncRes = await fetch(`/api/capacity/plazas/sync?est_id=${estId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(targetForSync)
      });

      if (!syncRes.ok) {
        const responseText = await syncRes.text();
        let e: any = {};
        try { e = JSON.parse(responseText) } catch { e = { error: responseText } }
        console.error('❌ Error en sincronización de plazas desde Guardar:', e);
        // Mensaje claro si hay plazas ocupadas que bloquean
        if (e.occupiedPlazas && e.occupiedPlazas.length > 0) {
          throw new Error(`${e.error}\n\nPlazas ocupadas: ${e.occupiedPlazas.join(', ')}`);
        }
        throw new Error(e.error || `Error al sincronizar plazas (HTTP ${syncRes.status})`);
      }

      // 🕵️ LOGGING ESTRATÉGICO: Resultado de la sincronización
      const syncResult = await syncRes.json();
      console.log('🎯 RESULTADO DE LA SINCRONIZACIÓN:', {
        exitoso: syncRes.ok,
        resultado: syncResult,
        mensaje: 'Verificar en los logs anteriores si la plaza 10 fue preservada'
      });

      // Refrescar contexto una sola vez (la sincronización ya actualizó las plazas preservando vehículos)
      await refreshCapacity();

      toast({ title: "Capacidad actualizada", description: "Capacidad y plazas sincronizadas correctamente (vehículos preservados)." });
      setOpen(false);
    } catch (error) {
      console.error("Error al guardar capacidad:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la capacidad/sincronizar plazas.",
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedEntries.length === 0) return;
    setEntryToDelete(null);
    setMultipleDelete(true);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete || !onDeleteHistoryEntry) return;
    try {
      await onDeleteHistoryEntry(entryToDelete.id);
      setFilteredHistory(prev => prev.filter(entry => entry.id !== entryToDelete.id));
      setSelectedEntries(selectedEntries.filter(id => id !== entryToDelete.id));
      toast({
        title: "Registro eliminado",
        description: "El registro ha sido eliminado exitosamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el registro.",
      });
    } finally {
      setShowDeleteDialog(false);
      setEntryToDelete(null);
    }
  };

  const confirmMultipleDelete = async () => {
    if (!onDeleteHistoryEntry) return;
    try {
      for (const id of selectedEntries) {
        await onDeleteHistoryEntry(id);
      }
      setFilteredHistory(prev => prev.filter(entry => !selectedEntries.includes(entry.id)));
      setSelectedEntries([]);
      toast({
        title: "Registros eliminados",
        description: `${selectedEntries.length} registros han sido eliminados exitosamente.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron eliminar algunos registros.",
      });
    } finally {
      setShowDeleteDialog(false);
      setMultipleDelete(false);
    }
  };

  const handleDelete = (entry: ParkingHistory) => {
    setEntryToDelete(entry);
    setMultipleDelete(false);
    setShowDeleteDialog(true);
  };

  const handleEdit = (entry: ParkingHistory) => {
    setEditingEntry({ ...entry, payment_method: entry.payment_method || 'No especificado' });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;
    try {
      // Extraer solo los campos que necesitamos actualizar
      const updates = {
        license_plate: editingEntry.license_plate,
        fee: editingEntry.fee,
        payment_method: editingEntry.payment_method
      };

      await onUpdateHistoryEntry?.(editingEntry.id, updates);

      setFilteredHistory(prev =>
        prev.map(entry =>
          entry.id === editingEntry.id ? { ...entry, ...updates } : entry
        )
      );
      setIsEditDialogOpen(false);
      setEditingEntry(null);
      toast({
        title: "Registro actualizado",
        description: "El registro ha sido actualizado exitosamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "No se pudo actualizar el registro.",
      });
      console.error("Error al actualizar registro:", error);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredHistory.filter(entry => entry.id != null).map(entry => entry.id);
      setSelectedEntries(allIds);
    } else {
      setSelectedEntries([]);
    }
  };

  const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, entry: ParkingHistory) => {
    if (e.target.checked) {
      setSelectedEntries([...selectedEntries, entry.id]);
    } else {
      setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
    }
  };

  const handleReenter = async (entry: ParkingHistory) => {
    setEntryToReenter(entry);
    setReenterDialogOpen(true);
  };

  const confirmReenter = async () => {
    if (!entryToReenter || !onReenterVehicle) return;

    try {
      await onReenterVehicle(entryToReenter);
      setReenterDialogOpen(false);
      setEntryToReenter(null);
      setFilteredHistory(prev => prev.filter(entry => entry.id !== entryToReenter.id));
    } catch (error) {
      console.error("Error al reingresar vehículo:", error);
      alert(error instanceof Error ? error.message : "Error al reingresar el vehículo");
    }
  };

  const handleFilteredDataChange = (newData: ParkingHistory[]) => {
    // Filtrar entradas válidas y eliminar duplicados basados en id y tiempo de salida
    const validEntries = newData.filter(entry =>
      entry &&
      entry.id &&
      typeof entry.id === 'string' &&
      entry.exit_time // asegurarse de que tenga tiempo de salida
    );

    // Usar Map para mantener solo la entrada más reciente por matrícula
    const uniqueEntries = new Map();

    validEntries.forEach(entry => {
      const existingEntry = uniqueEntries.get(entry.license_plate);
      if (!existingEntry || new Date(entry.exit_time) > new Date(existingEntry.exit_time)) {
        uniqueEntries.set(entry.license_plate, entry);
      }
    });

    // Convertir el Map a array y ordenar por tiempo de salida (más reciente primero)
    const filteredEntries = Array.from(uniqueEntries.values())
      .sort((a, b) => new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime());

    setFilteredHistory(filteredEntries);
  };

  const renderSpaceInfo = (label: string, type: VehicleType) => (
    <div key={type} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-medium dark:text-zinc-100">
          {availableSpaces[type]} ocupados de {capacity[type]}
      </p>
    </div>
  )

  useEffect(() => {
    // Actualizar historial filtrado si el historial original cambia
    setFilteredHistory(history);
  }, [history]);

  useEffect(() => {
    const loadPlazas = async () => {
      try {
        const res = await fetch(`/api/plazas/status?est_id=${estId}`)
        if (res.ok) {
          const js = await res.json()
          setPlazasStatus(js.byType)
        }
      } catch { }
    }
    loadPlazas()
  }, [estId])

  return (
    <div className="space-y-6">
      {/* Capacidad por tipo (plazas) - OCULTO */}
      {/* <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="dark:text-zinc-100">Capacidad por Tipo (Plazas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["Auto","Moto","Camioneta"] as VehicleType[]).map((t)=> {
              const seg = t === 'Moto' ? 'MOT' : t === 'Camioneta' ? 'CAM' : 'AUT'
              const st = plazasStatus?.[seg]
              return (
                <div key={t} className="p-3 bg-gray-50 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{t}s</p>
                  <p className="text-lg font-medium dark:text-zinc-100">{st ? `${st.free} libres de ${st.total}` : `${availableSpaces[t]} libres de ${capacity[t]}`}</p>
                  {st && (
                    <div className="mt-3 grid grid-cols-5 gap-1 text-xs">
                      {st.plazas.map((p, index) => (
                        <span key={`${seg}-${p.pla_numero || index}`} className={`px-2 py-1 rounded ${p.occupied ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                          {p.pla_numero || 'N/A'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card> */}
      {/* Ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Ingresos del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold dark:text-zinc-100">{formatCurrency(todayIncome)}</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Ingresos de la Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold dark:text-zinc-100">{formatCurrency(weekIncome)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado actual + botón para modificar */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle className="dark:text-zinc-100">Estado Actual del Estacionamiento</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                Modificar espacios
              </Button>
            </DialogTrigger>
            <DialogContent className="dark:bg-zinc-950 dark:border-zinc-800">
              <DialogHeader>
                <DialogTitle className="dark:text-zinc-100">Modificar capacidad máxima</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => (
                  <div key={type} className="space-y-1">
                    <label className="text-sm font-medium dark:text-zinc-400">{type}</label>
                    <Input
                      type="number"
                      min={0}
                      value={tempCapacities[type]}
                      onChange={(e) => handleChange(type, parseInt(e.target.value))}
                      className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    />
                  </div>
                ))}
              </div>
              <DialogFooter className="flex justify-end gap-2">
                {/* Botón de regenerar plazas se elimina porque Guardar ahora incluye esa operación */}
                <Button onClick={handleSave} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderSpaceInfo("Autos", "Auto")}
            {renderSpaceInfo("Motos", "Moto")}
            {renderSpaceInfo("Camionetas", "Camioneta")}
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-md dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <p className="text-center font-medium dark:text-zinc-100">
              Total: {availableSpaces.total.occupied} vehículos ocupando {availableSpaces.total.capacity} espacios (
              {availableSpaces.total.capacity - availableSpaces.total.occupied} libres)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <CardHeader className="flex flex-row justify-between items-center">
          <div className="flex items-center gap-4">
            <CardTitle className="dark:text-zinc-100">Historial de Operaciones</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="hidden flex items-center gap-2 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
          {/* Botón de eliminar seleccionados oculto por requerimiento */}
        </CardHeader>
        <CardContent>
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogContent className="max-w-3xl dark:bg-zinc-950 dark:border-zinc-800">
              <DialogHeader>
                <DialogTitle className="dark:text-zinc-100">Filtros de Búsqueda</DialogTitle>
                <DialogDescription className="dark:text-zinc-400">
                  Ajusta los filtros para encontrar registros específicos en el historial.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <HistoryFilters
                  history={history}
                  onFilteredDataChange={handleFilteredDataChange}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowFilters(false)} className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800">
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {filteredHistory.length === 0 ? (
            <p className="text-center text-gray-500 py-4 dark:text-zinc-500">No hay operaciones registradas</p>
          ) : (
            <div className="overflow-x-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-zinc-800">
                    {/* Columna de selección oculta */}
                    <TableHead className="w-[50px] hidden" />
                    <TableHead className="dark:text-zinc-400">Matrícula</TableHead>
                    <TableHead className="dark:text-zinc-400">Tipo</TableHead>
                    <TableHead className="dark:text-zinc-400">Entrada</TableHead>
                    <TableHead className="dark:text-zinc-400">Salida</TableHead>
                    <TableHead className="dark:text-zinc-400">Duración</TableHead>
                    <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                    <TableHead className="dark:text-zinc-400">Método de Pago</TableHead>
                    <TableHead className="text-right dark:text-zinc-400">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((entry, index) => (
                      <TableRow key={String(entry.id ?? `entry-${index}`)} className="dark:border-zinc-800">
                        {/* celda de selección oculta */}
                        <TableCell className="hidden" />
                        <TableCell className="dark:text-zinc-100">{entry.license_plate}</TableCell>
                        <TableCell className="dark:text-zinc-100">{entry.type}</TableCell>
                        <TableCell className="dark:text-zinc-100">{formatArgentineTimeWithDayjs(entry.entry_time)}</TableCell>
                        <TableCell className="dark:text-zinc-100">{formatArgentineTimeWithDayjs(entry.exit_time)}</TableCell>
                        <TableCell className="dark:text-zinc-100">{formatDuration(entry.duration)}</TableCell>
                        <TableCell className="dark:text-zinc-100">{formatCurrency(entry.fee)}</TableCell>
                        <TableCell>
                          <Badge className="bg-black text-white hover:bg-gray-800 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600">
                            {entry.payment_method || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {/* Editar y Eliminar removidos por requerimiento */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReenter(entry)}
                              className="text-primary hover:text-primary hover:bg-primary/10 dark:text-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                              title="Reingresar vehículo"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="dark:border-zinc-800">
                      <TableCell colSpan={9} className="h-24 text-center dark:text-zinc-500">
                        No hay resultados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      {/* <Chatbot /> */}

      {/* Gestión de Zonas */}
      <ZoneManager />
    </div>
  )
}
