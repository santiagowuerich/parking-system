"use client";


import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { RouteGuard } from "@/components/route-guard";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { toast } from "@/components/ui/use-toast";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { Loader2, CreditCard, Settings, FileText, Wallet, Banknote, QrCode, Link } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PaymentMethod {
    method: string;
    description: string;
    enabled: boolean;
}

interface TariffHistory {
    [segment: string]: Array<{
        fecha_desde: string;
        precio: number;
        modalidad: string;
        plantilla: string;
    }>;
}

interface UserSettings {
    mercadopagoApiKey: string | null;
    bankAccountHolder: string | null;
    bankAccountCbu: string | null;
    bankAccountAlias: string | null;
}

export default function ConfiguracionPagosPage() {
    const { estId, user } = useAuth();
    const { role, isOwner, loading: roleLoading } = useUserRole();
    const { paymentMethods, loading: methodsLoading, togglePaymentMethod } = usePaymentMethods(estId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados para historial de tarifas
    const [tariffHistory, setTariffHistory] = useState<TariffHistory>({});
    const [historyLoading, setHistoryLoading] = useState(false);

    // Estados para configuraciones
    const [userSettings, setUserSettings] = useState<UserSettings>({
        mercadopagoApiKey: null,
        bankAccountHolder: null,
        bankAccountCbu: null,
        bankAccountAlias: null,
    });

    const [mercadoPagoKey, setMercadoPagoKey] = useState("");
    const [bankHolder, setBankHolder] = useState("");
    const [bankCbu, setBankCbu] = useState("");
    const [bankAlias, setBankAlias] = useState("");

    useEffect(() => {
        loadAllData();
    }, [estId]);

    const loadAllData = async () => {
        if (!estId) return;

        try {
            setLoading(true);
            await Promise.all([
                loadTariffHistory(),
                loadUserSettings()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar los datos"
            });
        } finally {
            setLoading(false);
        }
    };

    // Los métodos de pago se cargan automáticamente con el hook usePaymentMethods

    const loadTariffHistory = async () => {
        try {
            setHistoryLoading(true);
            const response = await fetch(`/api/tarifas?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                // Agrupar por segmento
                const grouped: TariffHistory = {};
                data.tarifas?.forEach((plantilla: any) => {
                    const segmento = plantilla.catv_segmento;
                    if (!grouped[segmento]) {
                        grouped[segmento] = [];
                    }

                    // Agregar cada tarifa de la plantilla
                    Object.entries(plantilla.tarifas || {}).forEach(([tipoId, tarifa]: [string, any]) => {
                        const modalidad = tipoId === '1' ? 'Hora' :
                            tipoId === '2' ? 'Día' :
                                tipoId === '3' ? 'Mes' : 'Semana';

                        grouped[segmento].push({
                            fecha_desde: new Date().toISOString(), // Usar fecha actual por ahora
                            precio: tarifa.precio,
                            modalidad,
                            plantilla: plantilla.nombre_plantilla
                        });
                    });
                });
                setTariffHistory(grouped);
            }
        } catch (error) {
            console.error('Error loading tariff history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadUserSettings = async () => {
        try {
            // Solo los owners pueden cargar configuraciones de estacionamiento
            if (!isOwner) {
                console.log('Usuario no es owner, saltando carga de configuraciones');
                return;
            }

            const response = await fetch(`/api/estacionamiento/configuraciones?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                setUserSettings(data);
                setMercadoPagoKey(data.mercadopagoApiKey || "");
                setBankHolder(data.bankAccountHolder || "");
                setBankCbu(data.bankAccountCbu || "");
                setBankAlias(data.bankAccountAlias || "");
            } else if (response.status === 403) {
                console.log('Usuario no tiene permisos para ver configuraciones');
            }
        } catch (error) {
            console.error('Error loading estacionamiento settings:', error);
        }
    };

    const handleTogglePaymentMethod = async (methodName: string) => {
        const currentMethod = paymentMethods.find(m => m.method === methodName);
        if (!currentMethod) return;

        try {
            await togglePaymentMethod(methodName, !currentMethod.enabled);
        } catch (error) {
            // El hook ya maneja los toasts de error
        }
    };

    const saveMercadoPagoKey = async () => {
        try {
            setSaving(true);
            const response = await fetch('/api/estacionamiento/configuraciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estId: estId,
                    mercadopagoApiKey: mercadoPagoKey
                })
            });

            if (response.ok) {
                await loadUserSettings();
                toast({
                    title: "Éxito",
                    description: "API Key de MercadoPago guardada correctamente"
                });
            } else {
                throw new Error('Error al guardar API Key');
            }
        } catch (error) {
            console.error('Error saving MercadoPago key:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al guardar la API Key"
            });
        } finally {
            setSaving(false);
        }
    };

    const saveBankData = async () => {
        try {
            setSaving(true);
            const response = await fetch('/api/estacionamiento/configuraciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estId: estId,
                    bankAccountHolder: bankHolder,
                    bankAccountCbu: bankCbu,
                    bankAccountAlias: bankAlias
                })
            });

            if (response.ok) {
                await loadUserSettings();
                toast({
                    title: "Éxito",
                    description: "Datos bancarios guardados correctamente"
                });
            } else {
                throw new Error('Error al guardar datos bancarios');
            }
        } catch (error) {
            console.error('Error saving bank data:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al guardar los datos bancarios"
            });
        } finally {
            setSaving(false);
        }
    };

    const getSegmentName = (segment: string) => {
        switch (segment) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return segment;
        }
    };

    const hasMercadoPagoKey = userSettings.mercadopagoApiKey && userSettings.mercadopagoApiKey.trim() !== "";

    if (loading) {
        return (
            <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
                <DashboardLayout>
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Cargando configuración de pagos...</p>
                        </div>
                    </div>
                </DashboardLayout>
            </RouteGuard>
        );
    }

    // Si el usuario no es owner, mostrar vista limitada
    if (!roleLoading && !isOwner) {
        return (
            <RouteGuard allowedRoles={['playero']} redirectTo="/dashboard/operador-simple">
                <DashboardLayout>
                    <div className="p-6 max-w-7xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900">Configuración de Pagos</h1>
                            <p className="text-gray-600 mt-2">
                                Vista de métodos de pago disponibles para este estacionamiento
                            </p>
                        </div>

                        <div className="space-y-8">
                            {/* Solo mostrar métodos de pago habilitados */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="h-5 w-5" />
                                        Métodos de Pago Disponibles
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {methodsLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {paymentMethods.map((method) => (
                                                <div key={method.method} className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full ${method.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                        <span className="font-medium">{method.method}</span>
                                                        <span className="text-sm text-gray-500">{method.description}</span>
                                                    </div>
                                                    <Badge variant={method.enabled ? "default" : "secondary"}>
                                                        {method.enabled ? "Habilitado" : "Deshabilitado"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Información
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-blue-800">
                                            <strong>Nota:</strong> Solo el dueño del estacionamiento puede modificar los métodos de pago y configurar las credenciales de API.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </DashboardLayout>
            </RouteGuard>
        );
    }

    return (
        <RouteGuard allowedRoles={['owner']} redirectTo="/dashboard/operador-simple">
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Configuración de Pagos</h1>
                        <p className="text-gray-600 mt-2">
                            Gestiona métodos de pago, visualiza historial de tarifas y configura tus credenciales
                        </p>
                    </div>

                    <div className="space-y-8">
                        {/* SECCIÓN 1: MÉTODOS DE PAGO */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Métodos de Pago
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {paymentMethods.map((method) => (
                                        <div key={method.method} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                {method.method === 'Efectivo' && <Banknote className="h-5 w-5 text-green-600" />}
                                                {method.method === 'Transferencia' && <Wallet className="h-5 w-5 text-blue-600" />}
                                                {method.method === 'QR' && <QrCode className="h-5 w-5 text-purple-600" />}
                                                {method.method === 'Link de Pago' && <Link className="h-5 w-5 text-orange-600" />}
                                                <div>
                                                    <p className="font-medium">{method.method}</p>
                                                    <p className="text-sm text-gray-500">{method.description}</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={method.enabled}
                                                onCheckedChange={() => handleTogglePaymentMethod(method.method)}
                                                disabled={methodsLoading || ((method.method === 'QR' || method.method === 'Link de Pago') && !hasMercadoPagoKey)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {!hasMercadoPagoKey && (
                                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <p className="text-sm text-yellow-800">
                                            ⚠️ Para habilitar QR y Link de Pago, primero configura tu API Key de MercadoPago en la sección de configuraciones.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* SECCIÓN 2: HISTORIAL DE TARIFAS */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Historial de Tarifas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {Object.keys(tariffHistory).length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                        <p>Sin tarifas cargadas</p>
                                    </div>
                                ) : (
                                    Object.entries(tariffHistory).map(([segment, tariffs]) => (
                                        <div key={segment} className="mb-6">
                                            <h3 className="text-lg font-semibold mb-4 text-gray-900">
                                                {getSegmentName(segment)}
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Fecha desde</TableHead>
                                                            <TableHead>Precio</TableHead>
                                                            <TableHead>Modalidad</TableHead>
                                                            <TableHead>Plaza</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {tariffs.map((tariff, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell>
                                                                    {format(new Date(tariff.fecha_desde), "dd/MM/yyyy", { locale: es })}
                                                                </TableCell>
                                                                <TableCell className="font-medium">
                                                                    ${tariff.precio.toFixed(2)}
                                                                </TableCell>
                                                                <TableCell>{tariff.modalidad}</TableCell>
                                                                <TableCell>{tariff.plantilla}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* SECCIÓN 3: CONFIGURACIONES */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* CONFIGURACIÓN MERCADOPAGO */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        MercadoPago
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="mp-key">API Key</Label>
                                        <Input
                                            id="mp-key"
                                            type="password"
                                            placeholder="APP_USR-xxxxxxxxxxxxxxxxxx"
                                            value={mercadoPagoKey}
                                            onChange={(e) => setMercadoPagoKey(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Obtén tu API Key en el panel de MercadoPago → Credenciales
                                        </p>
                                    </div>
                                    <Button
                                        onClick={saveMercadoPagoKey}
                                        disabled={saving}
                                        className="w-full"
                                    >
                                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Guardar API Key
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* CONFIGURACIÓN TRANSFERENCIA */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Transferencia Bancaria
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="bank-holder">Titular de la cuenta</Label>
                                        <Input
                                            id="bank-holder"
                                            placeholder="Nombre completo del titular"
                                            value={bankHolder}
                                            onChange={(e) => setBankHolder(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bank-cbu">CBU/CVU</Label>
                                        <Input
                                            id="bank-cbu"
                                            placeholder="22 dígitos"
                                            value={bankCbu}
                                            onChange={(e) => setBankCbu(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Número de 22 dígitos de tu cuenta bancaria
                                        </p>
                                    </div>
                                    <div>
                                        <Label htmlFor="bank-alias">Alias</Label>
                                        <Input
                                            id="bank-alias"
                                            placeholder="ej: juan.perez.001"
                                            value={bankAlias}
                                            onChange={(e) => setBankAlias(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Alias de tu cuenta (opcional)
                                        </p>
                                    </div>
                                    <Button
                                        onClick={saveBankData}
                                        disabled={saving}
                                        className="w-full"
                                    >
                                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Guardar Datos Bancarios
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </RouteGuard>
    );
}
