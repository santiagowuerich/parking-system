import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VehicleType, ParkingHistory } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface HistoryFiltersProps {
  history: ParkingHistory[];
  onFilteredDataChange: (filteredData: ParkingHistory[]) => void;
}

export default function HistoryFilters({
  history,
  onFilteredDataChange,
}: HistoryFiltersProps) {
  const [filters, setFilters] = useState({
    vehicleType: "todos",
    licensePlate: "",
    dateFrom: "",
    dateTo: "",
    durationMin: "",
    durationMax: "",
    feeMin: "",
    feeMax: "",
    isPaid: "",
  });

  const applyFilters = () => {
    let filtered = [...history];

    // Filtrar por tipo de vehículo
    if (filters.vehicleType !== "todos") {
      filtered = filtered.filter((entry) => entry.type === filters.vehicleType);
    }

    // Filtrar por matrícula
    if (filters.licensePlate) {
      filtered = filtered.filter((entry) =>
        entry.license_plate.toLowerCase().includes(filters.licensePlate.toLowerCase())
      );
    }

    // Filtrar por fecha
    if (filters.dateFrom) {
      filtered = filtered.filter(
        (entry) => new Date(entry.entry_time) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(
        (entry) => new Date(entry.exit_time) <= new Date(filters.dateTo)
      );
    }

    // Filtrar por duración
    if (filters.durationMin) {
      filtered = filtered.filter(
        (entry) => entry.duration >= parseFloat(filters.durationMin) * 60 * 60 * 1000
      );
    }

    if (filters.durationMax) {
      filtered = filtered.filter(
        (entry) => entry.duration <= parseFloat(filters.durationMax) * 60 * 60 * 1000
      );
    }

    // Filtrar por tarifa
    if (filters.feeMin) {
      filtered = filtered.filter((entry) => entry.fee >= parseFloat(filters.feeMin));
    }

    if (filters.feeMax) {
      filtered = filtered.filter((entry) => entry.fee <= parseFloat(filters.feeMax));
    }

    // Asegurarse de que no hay duplicados y todos tienen ID válido
    const uniqueFiltered = filtered.filter(entry => entry.id);
    const uniqueEntries = new Map();
    uniqueFiltered.forEach(entry => {
      uniqueEntries.set(entry.id, entry);
    });

    onFilteredDataChange(Array.from(uniqueEntries.values()));
  };

  const clearFilters = () => {
    setFilters({
      vehicleType: "todos",
      licensePlate: "",
      dateFrom: "",
      dateTo: "",
      durationMin: "",
      durationMax: "",
      feeMin: "",
      feeMax: "",
      isPaid: "",
    });
    onFilteredDataChange(history);
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Aplicar filtros cuando cambien
  useEffect(() => {
    applyFilters();
  }, [filters]);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Filtro por tipo de vehículo */}
        <div className="space-y-2">
          <Label>Tipo de Vehículo</Label>
          <Select
            value={filters.vehicleType}
            onValueChange={(value) => handleFilterChange("vehicleType", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Auto">Auto</SelectItem>
              <SelectItem value="Moto">Moto</SelectItem>
              <SelectItem value="Camioneta">Camioneta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por matrícula */}
        <div className="space-y-2">
          <Label>Matrícula</Label>
          <Input
            placeholder="Buscar por matrícula"
            value={filters.licensePlate}
            onChange={(e) => handleFilterChange("licensePlate", e.target.value)}
          />
        </div>

        {/* Filtro por rango de fechas */}
        <div className="space-y-2">
          <Label>Desde</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
          />
        </div>

        {/* Filtro por duración */}
        <div className="space-y-2">
          <Label>Duración mínima (horas)</Label>
          <Input
            type="number"
            placeholder="0"
            min="0"
            step="0.5"
            value={filters.durationMin}
            onChange={(e) => handleFilterChange("durationMin", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Duración máxima (horas)</Label>
          <Input
            type="number"
            placeholder="24"
            min="0"
            step="0.5"
            value={filters.durationMax}
            onChange={(e) => handleFilterChange("durationMax", e.target.value)}
          />
        </div>

        {/* Filtro por tarifa */}
        <div className="space-y-2">
          <Label>Tarifa mínima</Label>
          <Input
            type="number"
            placeholder="0"
            min="0"
            value={filters.feeMin}
            onChange={(e) => handleFilterChange("feeMin", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Tarifa máxima</Label>
          <Input
            type="number"
            placeholder="1000"
            min="0"
            value={filters.feeMax}
            onChange={(e) => handleFilterChange("feeMax", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={clearFilters}>
          Limpiar Filtros
        </Button>
        <Button onClick={applyFilters}>
          Aplicar Filtros
        </Button>
      </div>
    </div>
  );
} 