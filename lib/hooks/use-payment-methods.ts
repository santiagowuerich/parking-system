import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface PaymentMethod {
    method: string;
    enabled: boolean;
}

interface PaymentMethodsData {
    methods: PaymentMethod[];
    total?: number;
}

export function usePaymentMethods(estId: number | null) {
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(false);

    // Cargar métodos de pago
    const loadPaymentMethods = async () => {
        if (!estId) {
            console.log('⚠️ usePaymentMethods: estId es null');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`/api/payment/methods?est_id=${estId}`);

            if (!response.ok) {
                throw new Error('Error al cargar métodos de pago');
            }

            const data: PaymentMethodsData = await response.json();
            setPaymentMethods(data.methods || []);

            console.log('💳 Métodos de pago cargados:', data.methods);
        } catch (error: any) {
            console.error('❌ Error al cargar métodos de pago:', error);
            toast.error('Error', { description: error.message });
            setPaymentMethods([]);
        } finally {
            setLoading(false);
        }
    };

    // Habilitar/deshabilitar método de pago
    const togglePaymentMethod = async (methodName: string, enabled: boolean) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        try {
            const response = await fetch(`/api/payment/methods?est_id=${estId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: methodName,
                    enabled
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al actualizar método de pago');
            }

            // Recargar métodos después de actualizar
            await loadPaymentMethods();

            toast.success(
                enabled
                    ? `Método "${methodName}" habilitado`
                    : `Método "${methodName}" deshabilitado`
            );
        } catch (error: any) {
            console.error('❌ Error al actualizar método de pago:', error);
            toast.error('Error al actualizar método', { description: error.message });
            throw error;
        }
    };

    // Configurar métodos de pago por defecto para nuevo estacionamiento
    const setupDefaultPaymentMethods = async () => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        const defaultMethods = [
            { method: 'Efectivo', enabled: true },
            { method: 'Transferencia', enabled: true },
            { method: 'MercadoPago', enabled: true }
        ];

        try {
            const promises = defaultMethods.map(method =>
                fetch('/api/payment/methods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        est_id: estId,
                        method: method.method,
                        enabled: method.enabled
                    }),
                })
            );

            await Promise.all(promises);
            await loadPaymentMethods();

            console.log('✅ Métodos de pago por defecto configurados');
        } catch (error: any) {
            console.error('❌ Error configurando métodos por defecto:', error);
            toast.error('Error al configurar métodos por defecto', { description: error.message });
        }
    };

    // Obtener métodos habilitados
    const getEnabledMethods = (): string[] => {
        return paymentMethods.filter(m => m.enabled).map(m => m.method);
    };

    // Verificar si un método está habilitado
    const isMethodEnabled = (methodName: string): boolean => {
        return paymentMethods.some(m => m.method === methodName && m.enabled);
    };

    useEffect(() => {
        if (estId) {
            loadPaymentMethods();
        }
    }, [estId]);

    return {
        paymentMethods,
        loading,
        loadPaymentMethods,
        togglePaymentMethod,
        setupDefaultPaymentMethods,
        getEnabledMethods,
        isMethodEnabled
    };
}
