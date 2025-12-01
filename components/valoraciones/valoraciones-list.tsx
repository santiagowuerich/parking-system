"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Loader2, ChevronLeft, ChevronRight, MessageSquare, User } from "lucide-react";
import { StarRating, StarRatingDisplay } from "./star-rating";
import { 
    ValoracionesListProps, 
    ValoracionesResponse, 
    ValoracionConUsuario
} from "@/lib/types/valoraciones";

export function ValoracionesList({
    estacionamientoId
}: ValoracionesListProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ValoracionesResponse | null>(null);
    const [paginaActual, setPaginaActual] = useState(1);
    const elementosPorPagina = 5;

    const fetchValoraciones = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/valoraciones/${estacionamientoId}?page=${paginaActual}&limit=${elementosPorPagina}`
            );
            const result: ValoracionesResponse = await response.json();

            if (!result.success) {
                throw new Error("Error al cargar valoraciones");
            }

            setData(result);
        } catch (err: any) {
            console.error("Error cargando valoraciones:", err);
            setError(err.message || "Error al cargar valoraciones");
        } finally {
            setLoading(false);
        }
    }, [estacionamientoId, paginaActual, elementosPorPagina]);

    useEffect(() => {
        fetchValoraciones();
    }, [fetchValoraciones]);

    // Función para anonimizar nombres
    const anonimizarNombre = (nombre: string, apellido: string): string => {
        const nombreCapitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
        const inicialApellido = apellido.charAt(0).toUpperCase();
        return `${nombreCapitalizado} ${inicialApellido}.`;
    };

    // Función para formatear fecha
    const formatearFecha = (fecha: string): string => {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500 text-sm">Cargando valoraciones...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-6">
                <p className="text-red-500 text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={fetchValoraciones} className="mt-2">
                    Reintentar
                </Button>
            </div>
        );
    }

    if (!data) return null;

    const { valoraciones, estadisticas, paginacion, mi_valoracion } = data;
    const tieneValoraciones = estadisticas.total_valoraciones > 0;

    // Filtrar la valoración del usuario actual de la lista
    const valoracionesOtros = valoraciones.filter(
        (v: ValoracionConUsuario) => !mi_valoracion || v.val_id !== mi_valoracion.val_id
    );

    return (
        <div className="space-y-4">
            {/* Estadísticas */}
            {tieneValoraciones && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                        {/* Promedio */}
                        <div className="text-center min-w-[80px]">
                            <div className="text-3xl font-bold text-gray-900">
                                {estadisticas.promedio_rating.toFixed(1)}
                            </div>
                            <StarRatingDisplay 
                                rating={estadisticas.promedio_rating} 
                                size="sm" 
                                showValue={false} 
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {estadisticas.total_valoraciones} valoración{estadisticas.total_valoraciones !== 1 ? 'es' : ''}
                            </p>
                        </div>

                        {/* Distribución de estrellas */}
                        <div className="flex-1 space-y-1">
                            {[5, 4, 3, 2, 1].map((stars) => {
                                const count = estadisticas.distribucion[stars as keyof typeof estadisticas.distribucion];
                                const percentage = tieneValoraciones 
                                    ? (count / estadisticas.total_valoraciones) * 100 
                                    : 0;

                                return (
                                    <div key={stars} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600 w-3">{stars}</span>
                                        <Progress value={percentage} className="h-1.5 flex-1" />
                                        <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de valoraciones de otros usuarios */}
            {valoracionesOtros.length > 0 ? (
                <div className="space-y-3">
                    <h4 className="font-medium text-gray-700 text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comentarios de otros usuarios
                    </h4>

                    {valoracionesOtros.map((valoracion: ValoracionConUsuario) => (
                        <Card key={valoracion.val_id} className="border-gray-100">
                            <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <User className="h-4 w-4 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-medium text-gray-800 text-sm">
                                                {anonimizarNombre(
                                                    valoracion.usuario.usu_nom,
                                                    valoracion.usuario.usu_ape
                                                )}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                {formatearFecha(valoracion.val_created_at)}
                                            </Badge>
                                        </div>
                                        <StarRating rating={valoracion.val_rating} readonly size="sm" />
                                        {valoracion.val_comentario && (
                                            <p className="text-sm text-gray-600 mt-1.5">
                                                {valoracion.val_comentario}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Paginación */}
                    {paginacion.total_paginas > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-gray-500">
                                Página {paginacion.pagina_actual} de {paginacion.total_paginas}
                            </p>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                    disabled={paginaActual === 1 || loading}
                                    className="h-7 w-7 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPaginaActual(p => Math.min(paginacion.total_paginas, p + 1))}
                                    disabled={paginaActual === paginacion.total_paginas || loading}
                                    className="h-7 w-7 p-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : !tieneValoraciones ? (
                <div className="text-center py-6">
                    <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aún no hay valoraciones</p>
                    <p className="text-xs text-gray-400">Sé el primero en valorar este estacionamiento</p>
                </div>
            ) : null}
        </div>
    );
}
