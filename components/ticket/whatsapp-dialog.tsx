'use client';

// components/ticket/whatsapp-dialog.tsx
// Diálogo para pedir número de WhatsApp y enviar el ticket

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface WhatsAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (phoneNumber: string) => Promise<void>;
  loading?: boolean;
}

export function WhatsAppDialog({
  isOpen,
  onClose,
  onSend,
  loading = false,
}: WhatsAppDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Validar formato de número de teléfono
  const validatePhone = (phone: string) => {
    // Remover espacios, guiones y paréntesis
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Validar que tenga entre 10 y 15 dígitos (con código de país opcional)
    const phoneRegex = /^(\+?54)?9?\d{10}$/;
    const isValidFormat = phoneRegex.test(cleaned) || /^\d{10,15}$/.test(cleaned);
    
    setIsValid(isValidFormat && cleaned.length >= 10);
    return isValidFormat && cleaned.length >= 10;
  };

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
    validatePhone(value);
  };

  const handleSend = async () => {
    if (!isValid || !phoneNumber.trim()) {
      toast({
        variant: 'destructive',
        title: 'Número inválido',
        description: 'Por favor ingrese un número de teléfono válido',
      });
      return;
    }

    // Limpiar el número (remover espacios, guiones, etc.)
    const cleanedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Asegurar formato internacional para Argentina
    let formattedPhone = cleanedPhone;
    if (!formattedPhone.startsWith('+')) {
      // Si no tiene código de país, asumir Argentina (+54)
      if (formattedPhone.startsWith('54')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('9')) {
        // Si empieza con 9, agregar código de país
        formattedPhone = '+54' + formattedPhone;
      } else {
        // Si es número local, agregar código de país y 9
        formattedPhone = '+549' + formattedPhone;
      }
    }

    try {
      await onSend(formattedPhone);
      setPhoneNumber('');
      setIsValid(false);
      
      // Mostrar mensaje informativo
      toast({
        title: 'WhatsApp abierto',
        description: 'El PDF se descargó automáticamente. Adjúntelo al chat desde su carpeta de descargas.',
      });
    } catch (error) {
      console.error('Error enviando por WhatsApp:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar el ticket. Por favor, intente nuevamente.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar por WhatsApp
          </DialogTitle>
          <DialogDescription>
            Se abrirá WhatsApp con el mensaje del ticket y se descargará el PDF automáticamente.
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              Adjunte el PDF desde su carpeta de descargas al chat de WhatsApp.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-phone">Número de teléfono</Label>
            <Input
              id="whatsapp-phone"
              type="tel"
              placeholder="+54 9 11 1234-5678 o 11 1234-5678"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={loading}
              className={!isValid && phoneNumber ? 'border-red-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Formato: +54 9 11 1234-5678 o 11 1234-5678
            </p>
            {!isValid && phoneNumber && (
              <p className="text-xs text-red-500">
                Por favor ingrese un número válido
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !isValid}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WhatsAppDialog;

