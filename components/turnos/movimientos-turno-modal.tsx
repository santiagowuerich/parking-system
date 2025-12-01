"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Calendar } from "lucide-react";
import dayjs from "dayjs";

interface Movimiento {
  pag_nro: number;
  veh_patente: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  ingreso: string | null;
  egreso: string | null;
  metodo_pago: string;
  monto: number;
}

interface TotalesPorMetodo {
  efectivo: number;
  transferencia: number;
  mercadopago: number;
  link_pago: number;
}

interface MovimientosTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turnoId: number | null;
}

export default function MovimientosTurnoModal({ isOpen, onClose, turnoId }: MovimientosTurnoModalProps) {
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totales, setTotales] = useState<TotalesPorMetodo | null>(null);
  const [totalGeneral, setTotalGeneral] = useState(0);

  useEffect(() => {
    if (isOpen && turnoId) {
      loadMovimientos();
    }
  }, [isOpen, turnoId]);

  const loadMovimientos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/turnos/${turnoId}/movimientos`);

      if (!response.ok) {
        throw new Error("Error al cargar movimientos");
      }

      const data = await response.json();
      setMovimientos(data.movimientos || []);
      setTotales(data.totales_por_metodo || null);
      setTotalGeneral(data.total_general || 0);
    } catch (error) {
      console.error("Error loading movimientos:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar los movimientos del turno"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'Abono Nuevo':
      case 'Extensión Abono':
        return 'bg-yellow-100 text-yellow-800';
      case 'Reserva':
        return 'bg-purple-100 text-purple-800';
      case 'Ocupación':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Movimientos del Turno
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : movimientos.length > 0 ? (
          <div className="space-y-4">
            {/* Tabla de movimientos */}
            <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
              <table className="w-full bg-white border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Tipo</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Patente</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Detalle</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Fecha</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Método de Pago</th>
                    <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => (
                    <tr key={mov.pag_nro} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                      <td className="py-4 px-4 text-sm text-center border-r border-gray-300">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTipoBadgeColor(mov.tipo)}`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 text-center border-r border-gray-300 font-medium">
                        {mov.veh_patente}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 text-center border-r border-gray-300">
                        {mov.descripcion}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 text-center border-r border-gray-300">
                        {dayjs(mov.fecha).format('DD/MM HH:mm')}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700 text-center border-r border-gray-300">
                        {mov.metodo_pago}
                      </td>
                      <td className="py-4 px-4 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(mov.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales por método de pago */}
            {totales && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                <h3 className="font-bold text-lg mb-3 text-gray-900">Totales por Método de Pago</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Efectivo</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(totales.efectivo)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Transferencia</p>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(totales.transferencia)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Mercado Pago</p>
                    <p className="text-lg font-bold text-cyan-600">{formatCurrency(totales.mercadopago)}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Link de Pago</p>
                    <p className="text-lg font-bold text-purple-600">{formatCurrency(totales.link_pago)}</p>
                  </div>
                </div>

                {/* Total general */}
                <div className="mt-4 pt-4 border-t border-gray-300 flex justify-between items-center">
                  <span className="font-bold text-gray-900">TOTAL GENERAL:</span>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalGeneral)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay movimientos registrados
            </h3>
            <p className="text-gray-600">
              No se encontraron movimientos para este turno.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
