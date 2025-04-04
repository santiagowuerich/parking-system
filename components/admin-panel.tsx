"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Pencil, Trash2 } from "lucide-react"
import type { ParkingHistory, VehicleType } from "@/lib/types"
import { formatCurrency, formatTime, formatDuration } from "@/lib/utils"
import HistoryFilters from "./history-filters"

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
}

export default function AdminPanel({
  history,
  availableSpaces,
  capacity,
  onUpdateCapacity,
  onDeleteHistoryEntry,
  onUpdateHistoryEntry,
}: AdminPanelProps) {
  const [filteredHistory, setFilteredHistory] = useState<ParkingHistory[]>(history);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [tempCapacities, setTempCapacities] = useState(capacity);
  const [editingEntry, setEditingEntry] = useState<ParkingHistory | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [multipleDeleteDialogOpen, setMultipleDeleteDialogOpen] = useState(false);

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

  const handleDelete = async (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (entryToDelete) {
      try {
        await onDeleteHistoryEntry?.(entryToDelete);
        setDeleteDialogOpen(false);
        setEntryToDelete(null);
      } catch (error) {
        console.error("Error al eliminar registro:", error);
        alert("Error al eliminar el registro");
      }
    }
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

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedEntries(new Set(filteredHistory.map(entry => entry.id)));
    } else {
      setSelectedEntries(new Set());
    }
  };

  const handleSelectEntry = (id: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedEntries.size === 0) return;
    setMultipleDeleteDialogOpen(true);
  };

  const confirmMultipleDelete = async () => {
    try {
      const promises = Array.from(selectedEntries).map(id => onDeleteHistoryEntry?.(id));
      await Promise.all(promises);
      setSelectedEntries(new Set());
      setMultipleDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error al eliminar registros:", error);
      alert("Error al eliminar los registros");
    }
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
          <CardTitle>Historial de Operaciones</CardTitle>
          {selectedEntries.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="ml-2"
            >
              Eliminar seleccionados ({selectedEntries.size})
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <HistoryFilters
            history={history}
            onFilteredDataChange={setFilteredHistory}
          />
          
          {filteredHistory.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No hay operaciones registradas</p>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedEntries.size === filteredHistory.length}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="text-left p-2">Matrícula</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Entrada</th>
                    <th className="text-left p-2">Salida</th>
                    <th className="text-left p-2">Duración</th>
                    <th className="text-left p-2">Tarifa</th>
                    <th className="text-left p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedEntries.has(entry.id)}
                          onChange={() => handleSelectEntry(entry.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-2">{entry.licensePlate}</td>
                      <td className="p-2">{entry.type}</td>
                      <td className="p-2">{formatTime(entry.entryTime)}</td>
                      <td className="p-2">{formatTime(entry.exitTime)}</td>
                      <td className="p-2">{formatDuration(entry.duration)}</td>
                      <td className="p-2">{formatCurrency(entry.fee)}</td>
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
                            onClick={() => handleDelete(entry.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación para eliminar un registro */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente este registro del historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar múltiples registros */}
      <AlertDialog open={multipleDeleteDialogOpen} onOpenChange={setMultipleDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente {selectedEntries.size} registros del historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMultipleDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmMultipleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar {selectedEntries.size} registros
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para editar entrada */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
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
    </div>
  )
}
