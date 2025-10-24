"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    HorarioFranja,
    DIAS_SEMANA,
    validateFranjaHoraria,
    checkOverlap,
    groupByDay,
    formatTimeDisplay
} from "@/lib/types/horarios";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HorariosEditorProps {
    estId: number;
    horarios: HorarioFranja[];
    onChange: (horarios: HorarioFranja[]) => void;
}

export default function HorariosEditor({ estId, horarios, onChange }: HorariosEditorProps) {
    const [horariosLocal, setHorariosLocal] = useState<HorarioFranja[]>(horarios);
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        setHorariosLocal(horarios);
    }, [horarios]);

    useEffect(() => {
        onChange(horariosLocal);
        validateAllHorarios();
    }, [horariosLocal]);

    const validateAllHorarios = () => {
        const newErrors: string[] = [];

        // Validar cada franja
        horariosLocal.forEach((franja, index) => {
            const validation = validateFranjaHoraria(franja);
            if (!validation.valid) {
                newErrors.push(`${DIAS_SEMANA[franja.dia_semana]} franja ${franja.orden}: ${validation.error}`);
            }
        });

        // Verificar overlaps
        const porDia = groupByDay(horariosLocal);
        Object.keys(porDia).forEach(dia => {
            const franjas = porDia[parseInt(dia)];
            for (let i = 0; i < franjas.length; i++) {
                for (let j = i + 1; j < franjas.length; j++) {
                    if (checkOverlap(franjas[i], franjas[j])) {
                        newErrors.push(`${DIAS_SEMANA[parseInt(dia)]}: las franjas ${franjas[i].orden} y ${franjas[j].orden} se solapan`);
                    }
                }
            }
        });

        setErrors(newErrors);
    };

    const agregarFranja = (diaSemana: number) => {
        const franjasDelDia = horariosLocal.filter(h => h.dia_semana === diaSemana);

        if (franjasDelDia.length >= 3) {
            return; // Máximo 3 franjas por día
        }

        const nuevoOrden = franjasDelDia.length + 1;

        // Determinar hora de apertura y cierre por defecto
        let horaApertura = "08:00";
        let horaCierre = "18:00";

        if (franjasDelDia.length > 0) {
            // Si ya hay franjas, la nueva empieza después de la última
            const ultimaFranja = franjasDelDia[franjasDelDia.length - 1];
            horaApertura = ultimaFranja.hora_cierre;

            // Calcular cierre 2 horas después
            const [h, m] = horaApertura.split(':').map(Number);
            const nuevaHora = (h + 2) % 24;
            horaCierre = `${String(nuevaHora).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        const nuevaFranja: HorarioFranja = {
            est_id: estId,
            dia_semana: diaSemana,
            hora_apertura: horaApertura,
            hora_cierre: horaCierre,
            orden: nuevoOrden
        };

        setHorariosLocal([...horariosLocal, nuevaFranja]);
    };

    const eliminarFranja = (diaSemana: number, orden: number) => {
        const nuevosHorarios = horariosLocal.filter(
            h => !(h.dia_semana === diaSemana && h.orden === orden)
        );

        // Reordenar las franjas restantes del mismo día
        const reordenados = nuevosHorarios.map(h => {
            if (h.dia_semana === diaSemana && h.orden > orden) {
                return { ...h, orden: h.orden - 1 };
            }
            return h;
        });

        setHorariosLocal(reordenados);
    };

    const actualizarFranja = (diaSemana: number, orden: number, campo: 'hora_apertura' | 'hora_cierre', valor: string) => {
        // Normalizar el formato a HH:MM (agregar ceros si es necesario)
        let valorNormalizado = valor;
        if (valor && valor.includes(':')) {
            const [horas, minutos] = valor.split(':');
            valorNormalizado = `${horas.padStart(2, '0')}:${minutos.padStart(2, '0')}`;
        }

        const nuevosHorarios = horariosLocal.map(h => {
            if (h.dia_semana === diaSemana && h.orden === orden) {
                return { ...h, [campo]: valorNormalizado };
            }
            return h;
        });

        setHorariosLocal(nuevosHorarios);
    };

    const horariosPorDia = groupByDay(horariosLocal);

    const copiarDia = (diaOrigen: number, diaDestino: number) => {
        const franjasOrigen = horariosPorDia[diaOrigen] || [];

        // Eliminar franjas existentes del día destino
        const sinDestino = horariosLocal.filter(h => h.dia_semana !== diaDestino);

        // Copiar franjas del origen al destino
        const nuevasFranjas = franjasOrigen.map(f => ({
            ...f,
            dia_semana: diaDestino,
            horario_id: undefined // No copiar el ID, será nuevo
        }));

        setHorariosLocal([...sinDestino, ...nuevasFranjas]);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Horarios de Atención
                </CardTitle>
                <p className="text-sm text-gray-500">
                    Configure hasta 3 franjas horarias por día. Por ejemplo: 8:00-12:00 y 14:00-18:00
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {errors.length > 0 && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <ul className="list-disc list-inside">
                                {errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                    {DIAS_SEMANA.map((dia, index) => {
                        const franjasDelDia = horariosPorDia[index] || [];
                        const puedeAgregar = franjasDelDia.length < 3;

                        return (
                            <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">{dia}</h4>
                                        {franjasDelDia.length === 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                Sin horarios
                                            </Badge>
                                        )}
                                        {franjasDelDia.length > 0 && (
                                            <Badge variant="default" className="text-xs bg-green-600">
                                                {franjasDelDia.length} franja{franjasDelDia.length > 1 ? 's' : ''}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {index > 0 && horariosPorDia[index - 1]?.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copiarDia(index - 1, index)}
                                                className="text-xs"
                                            >
                                                Copiar día anterior
                                            </Button>
                                        )}
                                        {puedeAgregar && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => agregarFranja(index)}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                Agregar franja
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {franjasDelDia.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">
                                        Día cerrado. Haga clic en "Agregar franja" para definir horarios.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {franjasDelDia.map((franja) => (
                                            <div
                                                key={`${franja.dia_semana}-${franja.orden}`}
                                                className="flex items-center gap-3 bg-white p-3 rounded border"
                                            >
                                                <Badge variant="outline" className="shrink-0">
                                                    {franja.orden}
                                                </Badge>

                                                <div className="flex items-center gap-2 flex-1">
                                                    <div className="flex-1">
                                                        <Label className="text-xs text-gray-600">Apertura</Label>
                                                        <Input
                                                            type="time"
                                                            value={formatTimeDisplay(franja.hora_apertura)}
                                                            onChange={(e) => actualizarFranja(franja.dia_semana, franja.orden, 'hora_apertura', e.target.value)}
                                                            className="mt-1"
                                                        />
                                                    </div>

                                                    <span className="text-gray-400 pt-6">→</span>

                                                    <div className="flex-1">
                                                        <Label className="text-xs text-gray-600">Cierre</Label>
                                                        <Input
                                                            type="time"
                                                            value={formatTimeDisplay(franja.hora_cierre)}
                                                            onChange={(e) => actualizarFranja(franja.dia_semana, franja.orden, 'hora_cierre', e.target.value)}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => eliminarFranja(franja.dia_semana, franja.orden)}
                                                    className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
