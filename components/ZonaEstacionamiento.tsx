// components/ZonaEstacionamiento.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plaza } from "./Plaza";

interface PlazaData {
    numero: number;
    ocupado: boolean;
}

interface TipoVehiculoData {
    nombre: string;
    stats: { total: number; ocupados: number; libres: number; };
    plazas: PlazaData[];
}

interface ZonaProps {
    zona: {
        nombre: string;
        stats: { total: number; ocupados: number; libres: number; };
        tiposVehiculo: {
            AUT: TipoVehiculoData;
            MOT: TipoVehiculoData;
            CAM: TipoVehiculoData;
        };
    };
    onPlazaClick: (plaza: PlazaData) => void;
}

export function ZonaEstacionamiento({ zona, onPlazaClick }: ZonaProps) {
    const renderTipoVehiculo = (tipo: TipoVehiculoData) => {
        if (tipo.stats.total === 0) return null;
        return (
            <div key={tipo.nombre}>
                <h4 className="font-semibold text-lg dark:text-zinc-200">{tipo.nombre}</h4>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                    {tipo.stats.ocupados} ocupados de {tipo.stats.total} | <span className="text-green-600 dark:text-green-400">Libres: {tipo.stats.libres}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    {tipo.plazas.map(plaza => (
                        <Plaza key={plaza.numero} {...plaza} onClick={() => onPlazaClick(plaza)} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
            <CardHeader>
                <CardTitle className="text-2xl dark:text-zinc-100">{zona.nombre}</CardTitle>
                <CardDescription className="dark:text-zinc-400">
                    Total: {zona.stats.total} espacios | Ocupados: {zona.stats.ocupados} | Libres: {zona.stats.libres}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {renderTipoVehiculo(zona.tiposVehiculo.AUT)}
                {renderTipoVehiculo(zona.tiposVehiculo.MOT)}
                {renderTipoVehiculo(zona.tiposVehiculo.CAM)}
            </CardContent>
        </Card>
    );
}




