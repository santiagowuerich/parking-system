"use client"

import { useState } from "react"
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
import { Pencil, Trash2, ArrowLeft, Filter } from "lucide-react"
import type { ParkingHistory, VehicleType } from "@/lib/types"
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils"
import HistoryFilters from "./history-filters"
import { toast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"

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

export default function AdminPanel({
  history,
  availableSpaces,
  capacity,
  onUpdateCapacity,
  onDeleteHistoryEntry,
  onUpdateHistoryEntry,
  onReenterVehicle,
}: AdminPanelProps) {
  const [filteredHistory, setFilteredHistory] = useState<ParkingHistory[]>(history);
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
    .filter((entry) => new Date(entry.exitTime) >= today)
    .reduce((sum, entry) => sum + entry.fee, 0)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  weekAgo.setHours(0, 0, 0, 0)

  const weekIncome = filteredHistory
    .filter((entry) => new Date(entry.exitTime) >= weekAgo)
    .reduce((sum, entry) => sum + entry.fee, 0)

  const handleChange = (type: VehicleType, value: number) => {
    setTempCapacities((prev) => ({ ...prev, [type]: value }))
  }

  const handleSave = () => {
    Object.entries(tempCapacities).forEach(([type, value]) => {
      onUpdateCapacity(type as VehicleType, value)
    })
    setOpen(false)
  }

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
    setEditingEntry(entry);
    setIsEditDialogOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    try {
      await onUpdateHistoryEntry?.(editingEntry.id, editingEntry);
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("Error al actualizar registro:", error);
      alert("Error al actualizar el registro");
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredHistory.map(entry => entry.id);
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
      entry.exitTime // asegurarse de que tenga tiempo de salida
    );

    // Usar Map para mantener solo la entrada más reciente por matrícula
    const uniqueEntries = new Map();
    
    validEntries.forEach(entry => {
      const existingEntry = uniqueEntries.get(entry.licensePlate);
      if (!existingEntry || new Date(entry.exitTime) > new Date(existingEntry.exitTime)) {
        uniqueEntries.set(entry.licensePlate, entry);
      }
    });
    
    // Convertir el Map a array y ordenar por tiempo de salida (más reciente primero)
    const filteredEntries = Array.from(uniqueEntries.values())
      .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime());
    
    setFilteredHistory(filteredEntries);
  };

  const renderSpaceInfo = (label: string, type: VehicleType) => (
    <div key={type} className="p-3 bg-gray-50 rounded-md">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-lg font-medium">
        {capacity[type] - availableSpaces[type]} ocupados de {capacity[type]}
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Ingresos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(todayIncome)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos de la Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(weekIncome)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado actual + botón para modificar */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Estado Actual del Estacionamiento</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Modificar espacios
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modificar capacidad máxima</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                {(["Auto", "Moto", "Camioneta"] as VehicleType[]).map((type) => (
                  <div key={type} className="space-y-1">
                    <label className="text-sm font-medium">{type}</label>
                    <Input
                      type="number"
                      min={0}
                      value={tempCapacities[type]}
                      onChange={(e) => handleChange(type, parseInt(e.target.value))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button onClick={handleSave}>Guardar</Button>
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
          <div className="mt-4 p-3 bg-gray-100 rounded-md">
            <p className="text-center font-medium">
              Total: {availableSpaces.total.occupied} vehículos ocupando {availableSpaces.total.capacity} espacios (
              {availableSpaces.total.capacity - availableSpaces.total.occupied} libres)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div className="flex items-center gap-4">
            <CardTitle>Historial de Operaciones</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
          {selectedEntries.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="ml-2"
            >
              Eliminar seleccionados ({selectedEntries.length})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Filtros de Búsqueda</DialogTitle>
                <DialogDescription>
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
                <Button variant="outline" onClick={() => setShowFilters(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {filteredHistory.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No hay operaciones registradas</p>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-[50px]">
                      <Checkbox
                        checked={selectedEntries.length > 0 && selectedEntries.length === filteredHistory.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const allIds = filteredHistory.map(entry => entry.id);
                            setSelectedEntries(allIds);
                          } else {
                            setSelectedEntries([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left p-2">Matrícula</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Entrada</th>
                    <th className="text-left p-2">Salida</th>
                    <th className="text-left p-2">Duración</th>
                    <th className="text-left p-2">Tarifa</th>
                    <th className="text-left p-2">Método de Pago</th>
                    <th className="text-left p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((entry) => {
                    const rowKey = `${entry.id}-${entry.exitTime}`;
                    return (
                      <tr key={rowKey} className="border-b">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedEntries.includes(entry.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEntries([...selectedEntries, entry.id]);
                              } else {
                                setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                              }
                            }}
                          />
                        </td>
                        <td className="p-2">{entry.licensePlate}</td>
                        <td className="p-2">{entry.type}</td>
                        <td className="p-2">{formatTime(entry.entryTime)}</td>
                        <td className="p-2">{formatTime(entry.exitTime)}</td>
                        <td className="p-2">{formatDuration(entry.duration)}</td>
                        <td className="p-2">{formatCurrency(entry.fee)}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            entry.paymentMethod === 'Efectivo' ? 'bg-green-100 text-green-800' :
                            entry.paymentMethod === 'Transferencia' ? 'bg-blue-100 text-blue-800' :
                            entry.paymentMethod === 'Link de pago' ? 'bg-purple-100 text-purple-800' :
                            entry.paymentMethod === 'QR' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.paymentMethod || 'No especificado'}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(entry)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleReenter(entry)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              title="Reingresar vehículo"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para eliminar un registro */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              {multipleDelete 
                ? `Esta acción eliminará ${selectedEntries.length} registros del historial.`
                : "Esta acción eliminará el registro del historial."}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={multipleDelete ? confirmMultipleDelete : confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para editar entrada */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>
              Modifica los detalles del registro seleccionado.
            </DialogDescription>
          </DialogHeader>
          {editingEntry && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="licensePlate">Matrícula</label>
                <Input
                  id="licensePlate"
                  value={editingEntry.licensePlate}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      licensePlate: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="fee">Tarifa</label>
                <Input
                  id="fee"
                  type="number"
                  value={editingEntry.fee}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      fee: parseFloat(e.target.value),
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="paymentMethod">Método de Pago</label>
                <Input
                  id="paymentMethod"
                  value={editingEntry.paymentMethod || 'No especificado'}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      paymentMethod: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateEntry}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para reingresar un vehículo */}
      <AlertDialog open={reenterDialogOpen} onOpenChange={setReenterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reingresar vehículo?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToReenter && (
                <>
                  ¿Está seguro que desea reingresar el vehículo con matrícula {entryToReenter.licensePlate}?
                  Esta acción eliminará el registro de salida y creará una nueva entrada.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReenterDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmReenter} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Reingresar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
