"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { formatArgentineTimeWithDayjs } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface VehicleMovement {
  mov_id: number;
  fecha_hora: string;
  pla_origen: number;
  pla_destino: number;
  zona_origen: string;
  zona_destino: string;
  operador: string;
  razon: string;
}

interface VehicleMovementsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ocupacionId: number | null;
  licensePlate: string;
}

export function VehicleMovementsHistoryModal({
  isOpen,
  onClose,
  ocupacionId,
  licensePlate,
}: VehicleMovementsHistoryModalProps) {
  const { estId } = useAuth();
  const [movements, setMovements] = useState<VehicleMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ocupacionId && estId) {
      loadMovements();
    }
  }, [isOpen, ocupacionId, estId]);

  const loadMovements = async () => {
    if (!ocupacionId || !estId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/parking/vehicle-movements?ocu_id=${ocupacionId}&est_id=${estId}`
      );
      const result = await response.json();

      if (result.success && result.data) {
        setMovements(result.data);
      } else {
        console.error('Error cargando movimientos:', result.error);
        setMovements([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPlaza = (numero: number) => {
    return `P${numero.toString().padStart(3, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Movimientos — {licensePlate} (Ticket #{ocupacionId})
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Se registraron cambios de plaza durante esta estadía.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Cargando movimientos...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se registraron movimientos de plaza para esta ocupación.
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((movement, index) => (
                <div
                  key={movement.mov_id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {formatArgentineTimeWithDayjs(movement.fecha_hora)}
                      </span>
                      {index === movements.length - 1 && (
                        <span className="text-xs text-gray-500 italic">
                          Asignación inicial
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">De zona {movement.zona_origen}</span>
                      {' - '}
                      <span className="font-mono">{formatPlaza(movement.pla_origen)}</span>
                      {' → '}
                      <span className="font-medium">A zona {movement.zona_destino}</span>
                      {' - '}
                      <span className="font-mono">{formatPlaza(movement.pla_destino)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Operador: {movement.operador}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="px-6"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
