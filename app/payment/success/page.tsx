'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [reserva, setReserva] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  // Parámetros que envía MercadoPago
  const preferenceId = searchParams.get('preference_id');
  const paymentId = searchParams.get('payment_id');
  const status = searchParams.get('status');
  const resCodigo = searchParams.get('res_codigo');

  useEffect(() => {
    if (resCodigo || preferenceId) {
      verificarEstadoReserva();
    } else {
      setCargando(false);
    }
  }, [preferenceId, resCodigo]);

  const verificarEstadoReserva = async () => {
    try {
      console.log('🔍 Verificando estado de reserva...');
      const response = await fetch('/api/reservas/verificar-estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference_id: preferenceId, res_codigo: resCodigo })
      });

      const data = await response.json();
      if (data.success) {
        console.log('✅ Reserva encontrada:', data.reserva);
        setReserva(data.reserva);
      } else {
        console.error('❌ Error verificando reserva:', data.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo verificar el estado de la reserva."
        });
      }
    } catch (error) {
      console.error('❌ Error verificando reserva:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al verificar el estado de la reserva."
      });
    } finally {
      setCargando(false);
    }
  };

  const confirmarManual = async () => {
    if (!reserva) return;

    setConfirmando(true);
    try {
      console.log('✅ Confirmando reserva manualmente...');
      const response = await fetch('/api/reservas/confirmar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          res_codigo: reserva.res_codigo,
          preference_id: preferenceId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "¡Reserva Confirmada!",
          description: "Tu reserva ha sido confirmada exitosamente.",
        });
        // Recargar estado
        await verificarEstadoReserva();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "No se pudo confirmar la reserva."
        });
      }
    } catch (error) {
      console.error('❌ Error confirmando:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al confirmar la reserva."
      });
    } finally {
      setConfirmando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="mt-4 text-lg">Verificando estado del pago...</p>
      </div>
    );
  }

  const getEstadoConfig = () => {
    if (!reserva) {
      return {
        tipo: 'error',
        titulo: 'Reserva no encontrada',
        descripcion: 'No se encontró información de la reserva.',
        icono: <AlertCircle className="w-6 h-6 text-red-600" />,
        color: 'bg-red-50 border-red-200'
      };
    }

    switch (reserva.res_estado) {
      case 'confirmada':
        return {
          tipo: 'confirmada',
          titulo: '¡Reserva Confirmada!',
          descripcion: 'Tu reserva ha sido confirmada automáticamente.',
          icono: <CheckCircle className="w-6 h-6 text-green-600" />,
          color: 'bg-green-50 border-green-200'
        };
      case 'pendiente_pago':
        return {
          tipo: 'pendiente',
          titulo: 'Pago Procesado',
          descripcion: 'Tu pago fue exitoso. Confirma tu reserva manualmente.',
          icono: <Clock className="w-6 h-6 text-blue-600" />,
          color: 'bg-blue-50 border-blue-200'
        };
      default:
        return {
          tipo: 'error',
          titulo: 'Estado Desconocido',
          descripcion: 'Contacta al soporte si el problema persiste.',
          icono: <AlertCircle className="w-6 h-6 text-red-600" />,
          color: 'bg-red-50 border-red-200'
        };
    }
  };

  const estadoConfig = getEstadoConfig();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {estadoConfig.icono}
          </div>
          <CardTitle className="text-2xl">{estadoConfig.titulo}</CardTitle>
          <p className="text-muted-foreground">{estadoConfig.descripcion}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {reserva && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Código de Reserva:</span>
                <Badge variant="outline">{reserva.res_codigo}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Plaza</p>
                  <p className="font-semibold">{reserva.pla_numero}</p>
                </div>
                <div>
                  <p className="text-gray-600">Monto</p>
                  <p className="font-semibold">${reserva.res_monto}</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-gray-600">Estado:</span>
                <Badge variant={
                  reserva.res_estado === 'confirmada' ? 'default' : 'secondary'
                }>
                  {reserva.res_estado}
                </Badge>
              </div>
            </div>
          )}

          {/* Botón de confirmación manual si está pendiente */}
          {estadoConfig.tipo === 'pendiente' && (
            <Button
              onClick={confirmarManual}
              disabled={confirmando}
              className="w-full"
            >
              {confirmando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Reserva
                </>
              )}
            </Button>
          )}

          {/* Botones de navegación */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/conductor">
                <ExternalLink className="w-4 h-4 mr-2" />
                Mis Reservas
              </Link>
            </Button>

            <Button className="flex-1" asChild>
              <Link href="/">Inicio</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 