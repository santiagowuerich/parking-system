"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PaymentHistory {
    id: string;
    license_plate: string;
    type: string;
    entry_time: string;
    exit_time: string;
    duration: number;
    fee: number;
    payment_method: string;
}

export default function PaymentsDashboardPage() {
    const { estId } = useAuth();
    const [payments, setPayments] = useState<PaymentHistory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPayments();
    }, [estId]);

    const loadPayments = async () => {
        if (!estId) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/parking/history?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                setPayments(data.history || []);
            }
        } catch (error) {
            console.error('Error loading payments:', error);
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

    const formatDuration = (duration: number) => {
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const getPaymentMethodBadge = (method: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
            'Efectivo': 'default',
            'Transferencia': 'secondary',
            'MercadoPago': 'outline',
            'QR': 'outline'
        };
        return variants[method] || 'default';
    };

    return (
        <DashboardLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Historial de Pagos</h1>
                    <p className="text-gray-600 mt-1">
                        Revisa todos los pagos realizados en tu estacionamiento
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Pagos Recientes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    <p className="text-sm text-muted-foreground mt-2">Cargando pagos...</p>
                                </div>
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No hay pagos registrados aún</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Patente</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Duración</TableHead>
                                            <TableHead>Método de Pago</TableHead>
                                            <TableHead className="text-right">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payments.map((payment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>
                                                    {format(new Date(payment.exit_time), "dd/MM/yyyy HH:mm", { locale: es })}
                                                </TableCell>
                                                <TableCell className="font-medium">{payment.license_plate}</TableCell>
                                                <TableCell>{payment.type}</TableCell>
                                                <TableCell>{formatDuration(payment.duration)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getPaymentMethodBadge(payment.payment_method)}>
                                                        {payment.payment_method}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(payment.fee)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
