"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, MapPin, Settings, ExternalLink, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function GoogleMapsSetupPage() {
    const [apiKey, setApiKey] = useState("");
    const [isConfigured, setIsConfigured] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Verificar si ya está configurado
        const currentApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (currentApiKey && currentApiKey !== 'TU_API_KEY_AQUI') {
            setIsConfigured(true);
            setApiKey(currentApiKey);
        }
    }, []);

    const testApiKey = async () => {
        if (!apiKey.trim()) {
            setTestResult({
                success: false,
                message: "Ingresa tu API key primero"
            });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            console.log('🧪 Probando API key:', apiKey.substring(0, 10) + '...');

            // Probar geocoding API
            const testAddress = "Av. Corrientes 1234, Buenos Aires, Argentina";
            const geocodingUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            geocodingUrl.searchParams.set('address', testAddress);
            geocodingUrl.searchParams.set('key', apiKey);

            const response = await fetch(geocodingUrl.toString());
            const data = await response.json();

            console.log('📡 Respuesta de geocoding:', data.status);

            if (data.status === 'OK') {
                setTestResult({
                    success: true,
                    message: "✅ API key funcionando correctamente!"
                });
            } else if (data.status === 'REQUEST_DENIED') {
                setTestResult({
                    success: false,
                    message: "❌ API key inválida o sin permisos"
                });
            } else if (data.status === 'OVER_QUERY_LIMIT') {
                setTestResult({
                    success: false,
                    message: "❌ Límite de consultas excedido"
                });
            } else {
                setTestResult({
                    success: false,
                    message: `❌ Error: ${data.status}`
                });
            }
        } catch (error) {
            console.error('❌ Error probando API key:', error);
            setTestResult({
                success: false,
                message: "❌ Error de conexión. Verifica tu conexión a internet."
            });
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfiguration = async () => {
        if (!apiKey.trim()) return;

        try {
            const response = await fetch('/api/google-maps/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey })
            });

            if (response.ok) {
                setTestResult({
                    success: true,
                    message: "✅ Configuración guardada! Reinicia el servidor."
                });
                setIsConfigured(true);
            } else {
                const error = await response.json();
                setTestResult({
                    success: false,
                    message: `❌ Error: ${error.message}`
                });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: "❌ Error guardando configuración"
            });
        }
    };

    if (isConfigured) {
        return (
            <div className="min-h-screen bg-zinc-950 p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card className="bg-zinc-900/50 border-zinc-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <CheckCircle className="h-6 w-6 text-green-500" />
                                Google Maps Configurado
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-green-900/50 text-green-300">
                                    Configurado
                                </Badge>
                                <span className="text-zinc-300">
                                    API Key: {apiKey.substring(0, 10)}...
                                </span>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-white font-medium">¿Qué puedes hacer ahora?</h3>
                                <ul className="text-zinc-400 space-y-1 text-sm">
                                    <li>✅ Configurar direcciones de estacionamientos</li>
                                    <li>✅ Ver mapas interactivos con ubicación exacta</li>
                                    <li>✅ Buscar direcciones en Argentina</li>
                                    <li>✅ Geocodificar coordenadas automáticamente</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => router.push('/')}
                                    className="flex-1"
                                >
                                    Ir al Sistema
                                </Button>
                                <Button
                                    onClick={() => router.push('/google-maps-setup')}
                                    variant="outline"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Reconfigurar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <Card className="bg-zinc-900/50 border-zinc-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Settings className="h-6 w-6" />
                            Configuración de Google Maps
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="apiKey" className="text-zinc-300">
                                    Google Maps API Key
                                </Label>
                                <Input
                                    id="apiKey"
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Ingresa tu API key de Google Maps"
                                    className="bg-zinc-800 border-zinc-600"
                                />
                                <p className="text-xs text-zinc-500">
                                    Tu API key se guarda localmente y nunca se envía a servidores externos.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={testApiKey}
                                    disabled={!apiKey.trim() || isTesting}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    {isTesting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Probando...
                                        </>
                                    ) : (
                                        <>
                                            <MapPin className="h-4 w-4 mr-2" />
                                            Probar API Key
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={saveConfiguration}
                                    disabled={!apiKey.trim() || !testResult?.success}
                                >
                                    Guardar Configuración
                                </Button>
                            </div>

                            {testResult && (
                                <div className={`p-4 rounded-lg border ${testResult.success
                                        ? 'bg-green-900/20 border-green-700 text-green-300'
                                        : 'bg-red-900/20 border-red-700 text-red-300'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        {testResult.success ? (
                                            <CheckCircle className="h-5 w-5" />
                                        ) : (
                                            <AlertCircle className="h-5 w-5" />
                                        )}
                                        <span className="font-medium">
                                            {testResult.success ? 'Éxito' : 'Error'}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1">{testResult.message}</p>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-zinc-700 pt-6 space-y-4">
                            <h3 className="text-white font-medium">¿Cómo obtener tu API key?</h3>

                            <div className="space-y-3 text-sm text-zinc-400">
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</div>
                                    <div>
                                        <p className="font-medium text-zinc-300">Crear cuenta en Google Cloud</p>
                                        <p>Ve a <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a></p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</div>
                                    <div>
                                        <p className="font-medium text-zinc-300">Crear proyecto</p>
                                        <p>Crea un nuevo proyecto o selecciona uno existente</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</div>
                                    <div>
                                        <p className="font-medium text-zinc-300">Habilitar APIs</p>
                                        <p>Habilita: Maps JavaScript API, Geocoding API, Places API</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">4</div>
                                    <div>
                                        <p className="font-medium text-zinc-300">Crear API Key</p>
                                        <p>Ve a APIs & Services → Credentials → Create Credentials → API Key</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">5</div>
                                    <div>
                                        <p className="font-medium text-zinc-300">Configurar restricciones</p>
                                        <p>Agrega restricciones de dominio: localhost:3000, tu-dominio.com</p>
                                    </div>
                                </div>
                            </div>

                            <Button
                                onClick={() => window.open('https://console.cloud.google.com/google/maps-apis', '_blank')}
                                variant="outline"
                                className="w-full gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                Ir a Google Cloud Console
                            </Button>
                        </div>

                        <div className="border-t border-zinc-700 pt-6">
                            <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-lg">
                                <h4 className="text-blue-300 font-medium mb-2">💡 Información importante</h4>
                                <ul className="text-blue-200 text-sm space-y-1">
                                    <li>• Google Maps tiene $200 USD de crédito gratuito por mes</li>
                                    <li>• Puedes configurar alertas de facturación para evitar cargos inesperados</li>
                                    <li>• Las restricciones de dominio son importantes por seguridad</li>
                                    <li>• Si tienes problemas, verifica la consola del navegador (F12)</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}




