'use client'

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

interface TransferInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined; // Changed from null to undefined to match session?.user?.id
  onConfirmTransfer: () => void; // Add confirmation callback prop
}

interface UserSettings {
  bankAccountHolder: string | null;
  bankAccountCbu: string | null;
  bankAccountAlias: string | null;
}

export function TransferInfoDialog({ isOpen, onClose, userId, onConfirmTransfer }: TransferInfoDialogProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Only fetch if the dialog is open and we have a userId
    if (isOpen && userId) {
      setIsLoading(true);
      setError(null);
      setSettings(null); // Clear previous settings

      fetch(`/api/user/settings?userId=${userId}`)
        .then(async res => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Error desconocido al cargar datos.' }));
            throw new Error(errorData.error || 'No se pudo cargar la información de transferencia.');
          }
          return res.json();
        })
        .then((data: UserSettings) => {
          // Basic validation or default setting
          if (!data.bankAccountHolder && !data.bankAccountCbu && !data.bankAccountAlias) {
            setSettings({ bankAccountHolder: 'No configurado', bankAccountCbu: 'No configurado', bankAccountAlias: 'No configurado' });
          } else {
            setSettings(data);
          }
        })
        .catch(err => {
          console.error("Error fetching transfer info:", err);
          setError(err.message || 'Error al cargar datos.');
          toast({ title: "Error", description: err.message || 'Error al cargar datos.', variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    } else if (!isOpen) {
        // Reset state when dialog closes
        setSettings(null);
        setError(null);
        setIsLoading(false);
    }
  }, [isOpen, userId, toast]);

  const copyToClipboard = (text: string | null | undefined) => {
    if (!text || text === 'No configurado') return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copiado", description: `${text.substring(0, 20)}... copiado al portapapeles.` }))
      .catch(() => toast({ title: "Error", description: "No se pudo copiar.", variant: "destructive" }));
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      );
    }
    if (error) {
      return <p className="text-red-500 text-center">{error}</p>;
    }
    if (settings) {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Titular</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.bankAccountHolder || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CBU/CVU</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-all">{settings.bankAccountCbu || '-'}</p>
              {settings.bankAccountCbu && settings.bankAccountCbu !== 'No configurado' && (
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(settings.bankAccountCbu)} aria-label="Copiar CBU/CVU">
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Alias</p>
             <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{settings.bankAccountAlias || '-'}</p>
                 {settings.bankAccountAlias && settings.bankAccountAlias !== 'No configurado' && (
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(settings.bankAccountAlias)} aria-label="Copiar Alias">
                       <Copy className="w-4 h-4" />
                    </Button>
                )}
            </div>
          </div>
        </div>
      );
    }
    return <p className="text-center text-gray-500">No se pudo cargar la información.</p>; // Fallback
  };

  // Handle confirmation button click
  const handleConfirm = () => {
    onConfirmTransfer();
    // Don't call onClose here, let the parent handle closing via state change triggered by onConfirmTransfer
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}> {/* Call onClose only when closing */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Datos para Transferencia Bancaria</DialogTitle>
          <DialogDescription>
            Realiza la transferencia a la siguiente cuenta para completar el pago.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {renderContent()}
        </div>
         {/* Replace single Close button with Cancel and Confirm */}
         {/* <Button onClick={onClose} className="mt-6 w-full">Cerrar</Button> */}
         <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={onClose}> {/* Calls onClose directly */}
                Cancelar
            </Button>
            <Button onClick={handleConfirm}> {/* Calls the new handler */}
                Confirmar Pago
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 