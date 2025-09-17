import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PaymentMethodButton, PAYMENT_METHODS } from "@/components/ui/payment-method-button";
import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMethod: (method: string) => void;
  fee: number;
  onChangeCalcParams?: (params: { modalidad: 'Hora' | 'Diaria' | 'Mensual'; pla_tipo: 'Normal' | 'VIP' | 'Reservada' }) => void;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
  fee,
  onChangeCalcParams,
}: PaymentMethodDialogProps) {
  const { estId } = useAuth()
  const [modalidad, setModalidad] = useState<'Hora' | 'Diaria' | 'Mensual'>('Hora')
  const plaTipo = 'Normal' // Fijo en Normal
  const [enabledMethods, setEnabledMethods] = useState<string[]>([])
  const [loadingMethods, setLoadingMethods] = useState(false)

  useEffect(() => {
    onChangeCalcParams?.({ modalidad, pla_tipo: plaTipo })
  }, [modalidad, plaTipo])

  // Cargar métodos de pago habilitados
  useEffect(() => {
    const loadEnabledMethods = async () => {
      if (!open || !estId) {
        console.log('⚠️ PaymentMethodDialog: estId es null o componente cerrado', { open, estId })
        return
      }

      try {
        setLoadingMethods(true)
        const response = await fetch(`/api/payment/methods?est_id=${estId}`)
        if (response.ok) {
          const data = await response.json()
          console.log('📦 Respuesta completa de métodos de pago:', data)
          console.log('📋 Todos los métodos en data.methods:', data.methods)

          // Los métodos que llegan del backend ya están filtrados (solo habilitados)
          const enabled = data.methods?.map((m: any) => m.method) || []
          console.log('💳 Métodos de pago habilitados (ya filtrados en backend):', enabled)
          console.log('📊 Total métodos en respuesta:', data.methods?.length || 0)
          console.log('🔍 Métodos en respuesta:', data.methods?.map((m: any) => `${m.method}: ${m.enabled}`).join(', '))

          // Verificar cada método individualmente
          data.methods?.forEach((method: any, index: number) => {
            console.log(`🔍 Método ${index + 1}: ${method.method} = ${method.enabled} (enabled: ${method.enabled})`)
          })

          // Verificar específicamente QR
          const qrMethod = data.methods?.find((m: any) => m.method === 'QR')
          console.log('📱 Método QR encontrado:', qrMethod ? `enabled: ${qrMethod.enabled}` : 'NO ENCONTRADO')

          setEnabledMethods(enabled)

          // Si no hay métodos habilitados, intentar auto-configurar
          if (enabled.length === 0) {
            console.warn('⚠️ No hay métodos de pago habilitados, intentando auto-configurar...')

            // Intentar configurar métodos por defecto automáticamente
            try {
              const autoConfigResponse = await fetch(`/api/payment/methods?est_id=${estId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                }
              })

              if (autoConfigResponse.ok) {
                console.log('✅ Métodos de pago auto-configurados exitosamente')
                // Recargar los métodos después de la auto-configuración
                await loadEnabledMethods()
                return
              } else {
                console.error('❌ Auto-configuración falló, usando fallback')
                setEnabledMethods(['QR']) // Al menos QR como fallback mínimo
              }
            } catch (autoConfigError) {
              console.error('❌ Error en auto-configuración de métodos:', autoConfigError)
              setEnabledMethods(['QR']) // Al menos QR como fallback mínimo
            }
          }
        } else {
          console.error('❌ Error cargando métodos de pago, usando fallback')
          // Fallback: todos habilitados si hay error
          setEnabledMethods(['Efectivo', 'Transferencia', 'MercadoPago', 'QR', 'Link de Pago'])
        }
      } catch (error) {
        console.error('Error cargando métodos de pago:', error)
        // Fallback: métodos básicos si hay error
        setEnabledMethods(['Efectivo', 'Transferencia', 'MercadoPago', 'QR', 'Link de Pago'])
      } finally {
        setLoadingMethods(false)
      }
    }

    loadEnabledMethods()
  }, [open, estId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Método de Pago</DialogTitle>
          <DialogDescription>
            Monto a pagar: {formatCurrency(fee)}
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4">
          <Label className="mb-1 block">Modalidad</Label>
          <Select value={modalidad} onValueChange={(v: any) => setModalidad(v)}>
            <SelectTrigger><SelectValue placeholder="Modalidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Hora">Hora</SelectItem>
              <SelectItem value="Diaria">Diaria</SelectItem>
              <SelectItem value="Mensual">Mensual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loadingMethods ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {PAYMENT_METHODS.map(method => (
              <PaymentMethodButton
                key={method.id}
                method={{
                  ...method,
                  enabled: enabledMethods.includes(method.name)
                }}
                onClick={onSelectMethod}
              />
            ))}
            {enabledMethods.length === 0 && !loadingMethods && (
              <div className="col-span-2 text-center py-8">
                <div className="text-blue-600 mb-2">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-gray-600 mb-2">
                  No hay métodos de pago habilitados para este estacionamiento
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Intentando configurar automáticamente...
                </p>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 