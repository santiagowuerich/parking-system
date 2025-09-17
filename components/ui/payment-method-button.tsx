import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface PaymentMethodButtonProps {
  method: PaymentMethod;
  onClick: (methodId: string) => void;
  className?: string;
}

export const PaymentMethodButton: React.FC<PaymentMethodButtonProps> = ({
  method,
  onClick,
  className = ''
}) => {
  if (!method.enabled) return null;

  return (
    <Button
      variant="outline"
      onClick={() => onClick(method.id)}
      className={cn(
        'h-24 flex items-center justify-center',
        className
      )}
    >
      <div className="flex flex-col items-center">
        <span className="text-2xl mb-2">{method.icon}</span>
        <span>{method.name}</span>
      </div>
    </Button>
  );
};

// Métodos de pago predefinidos
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'efectivo',
    name: 'Efectivo',
    icon: '💵',
    enabled: true
  },
  {
    id: 'transferencia',
    name: 'Transferencia',
    icon: '🏦',
    enabled: true
  },
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    icon: '💳',
    enabled: true
  },
  {
    id: 'qr',
    name: 'QR',
    icon: '📱',
    enabled: true
  },
  {
    id: 'link_pago',
    name: 'Link de Pago',
    icon: '🔗',
    enabled: true
  }
];