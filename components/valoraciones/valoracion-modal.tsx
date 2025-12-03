"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star, Loader2, Send, MessageSquare } from "lucide-react";
import { ValoracionesList } from "./valoraciones-list";
import { StarRating } from "./star-rating";
import { useToast } from "@/hooks/use-toast";
import { 
    ValoracionModalProps, 
    CreateValoracionRequest,
    Valoracion,
    ValoracionesResponse
} from "@/lib/types/valoraciones";

export function ValoracionModal({
    open,
    onOpenChange,
    estacionamiento,
    readOnly = false
}: ValoracionModalProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [miValoracion, setMiValoracion] = useState<Valoracion | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Estados para la valoración rápida
    const [ratingSeleccionado, setRatingSeleccionado] = useState(0);
    const [comentario, setComentario] = useState("");
    const [mostrarComentario, setMostrarComentario] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const maxComentarioLength = 500;

    // Cargar mi valoración al abrir el modal
    const fetchMiValoracion = useCallback(async () => {
        setLoadingData(true);
        try {
            const response = await fetch(`/api/valoraciones/${estacionamiento.est_id}?page=1&limit=1`);
            const data: ValoracionesResponse = await response.json();

            if (data.success && data.mi_valoracion) {
                setMiValoracion(data.mi_valoracion);
                setRatingSeleccionado(data.mi_valoracion.val_rating);
                setComentario(data.mi_valoracion.val_comentario || "");
            } else {
                setMiValoracion(null);
                setRatingSeleccionado(0);
                setComentario("");
            }
        } catch (err) {
            console.error("Error cargando mi valoración:", err);
        } finally {
            setLoadingData(false);
        }
    }, [estacionamiento.est_id]);

    useEffect(() => {
        if (open) {
            fetchMiValoracion();
            setMostrarComentario(false);
            setIsEditing(false);
        }
    }, [open, fetchMiValoracion]);

    const handleRatingChange = (newRating: number) => {
        setRatingSeleccionado(newRating);
        // No mostrar automáticamente el campo de comentario
        // El usuario puede agregarlo opcionalmente después
    };

    const handleSubmitValoracion = async () => {
        if (ratingSeleccionado < 1 || ratingSeleccionado > 5) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Selecciona una calificación entre 1 y 5 estrellas"
            });
            return;
        }

        setLoading(true);
        try {
            const method = miValoracion ? 'PUT' : 'POST';
            const response = await fetch(`/api/valoraciones/${estacionamiento.est_id}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating: ratingSeleccionado,
                    comentario: comentario.trim() || undefined
                } as CreateValoracionRequest)
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Error al guardar valoración');
            }

            toast({
                title: miValoracion ? "Valoración actualizada" : "¡Valoración publicada!",
                description: miValoracion ? "Tus cambios han sido guardados." : "Gracias por compartir tu experiencia.",
            });

            setMiValoracion(result.valoracion);
            setMostrarComentario(false);
            setIsEditing(false);
            setRefreshKey(k => k + 1);
        } catch (err: unknown) {
            const error = err as Error;
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "No se pudo guardar la valoración"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteValoracion = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/valoraciones/${estacionamiento.est_id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Error al eliminar valoración');
            }

            toast({
                title: "Valoración eliminada",
                description: "Tu valoración ha sido eliminada.",
            });

            setMiValoracion(null);
            setRatingSeleccionado(0);
            setComentario("");
            setShowDeleteDialog(false);
            setMostrarComentario(false);
            setIsEditing(false);
            setRefreshKey(k => k + 1);
        } catch (err: unknown) {
            const error = err as Error;
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "No se pudo eliminar la valoración"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleEditarValoracion = () => {
        setIsEditing(true);
        // No mostrar automáticamente el comentario, permitir que el usuario lo agregue si quiere
        setMostrarComentario(false);
    };

    const handleCancelEdit = () => {
        if (miValoracion) {
            setRatingSeleccionado(miValoracion.val_rating);
            setComentario(miValoracion.val_comentario || "");
        }
        setIsEditing(false);
        setMostrarComentario(false);
    };

    const getRatingLabel = (rating: number): string => {
        switch (rating) {
            case 1: return "Muy malo";
            case 2: return "Malo";
            case 3: return "Regular";
            case 4: return "Bueno";
            case 5: return "Excelente";
            default: return "Selecciona tu calificación";
        }
    };

    return (
        <div>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent 
                    className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                            Valoraciones - {estacionamiento.est_nombre}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {loadingData ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                <span className="ml-2 text-gray-500">Cargando...</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Sección de calificación rápida - Solo mostrar si NO es readOnly */}
                                {!readOnly && (
                                    <>
                                        <div className="bg-white rounded-xl p-5 border border-gray-200">
                                            {miValoracion && !isEditing ? (
                                                // Mostrar valoración existente
                                                <div className="text-center">
                                                    <p className="text-sm text-gray-600 mb-2">Tu valoración</p>
                                                    <div className="flex justify-center mb-2">
                                                        <StarRating
                                                            rating={miValoracion.val_rating}
                                                            readonly
                                                            size="lg"
                                                        />
                                                    </div>
                                                    <p className="text-lg font-medium text-gray-800 mb-2">
                                                        {getRatingLabel(miValoracion.val_rating)}
                                                    </p>
                                                    {miValoracion.val_comentario && (
                                                        <p className="text-sm text-gray-600 italic mb-3">
                                                            &quot;{miValoracion.val_comentario}&quot;
                                                        </p>
                                                    )}
                                                    <div className="flex justify-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleEditarValoracion}
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setShowDeleteDialog(true)}
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        >
                                                            Eliminar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Mostrar estrellas para calificar
                                                <div className="text-center">
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        {isEditing ? "Edita tu calificación" : "¿Qué te pareció este estacionamiento?"}
                                                    </p>
                                                    <div className="flex justify-center mb-2">
                                                        <StarRating
                                                            rating={ratingSeleccionado}
                                                            onRatingChange={handleRatingChange}
                                                            size="lg"
                                                        />
                                                    </div>
                                                    <p className="text-lg font-medium text-gray-800">
                                                        {getRatingLabel(ratingSeleccionado)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Botón de enviar (aparece después de seleccionar estrellas, pero no cuando se muestra el comentario) */}
                                        {ratingSeleccionado > 0 && !mostrarComentario && (miValoracion ? isEditing : true) ? (
                                            <div className="bg-white rounded-lg border p-4 space-y-3">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <span className="text-sm text-gray-600">
                                                        {miValoracion ? "Actualizar valoración" : "¿Listo para publicar?"}
                                                    </span>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setMostrarComentario(true)}
                                                            disabled={loading}
                                                        >
                                                            <MessageSquare className="mr-2 h-4 w-4" />
                                                            {isEditing ? "Editar comentario" : "Agregar comentario"}
                                                        </Button>
                                                        {isEditing && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleCancelEdit}
                                                                disabled={loading}
                                                            >
                                                                Cancelar
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={handleSubmitValoracion}
                                                            disabled={loading}
                                                            size="sm"
                                                            className="min-w-[120px]"
                                                        >
                                                            {loading ? (
                                                                <span className="flex items-center">
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    Guardando...
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center">
                                                                    <Send className="mr-2 h-4 w-4" />
                                                                    {miValoracion ? "Actualizar" : "Publicar"}
                                                                </span>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Formulario de comentario (opcional, aparece después del botón de enviar) */}
                                        {mostrarComentario && (
                                            <div className="bg-gray-50 rounded-lg border p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <MessageSquare className="h-4 w-4 text-gray-500" />
                                                        <Label className="text-sm font-medium">
                                                            Agregar comentario (opcional)
                                                        </Label>
                                                    </div>
                                                    {!isEditing && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setMostrarComentario(false);
                                                                setComentario("");
                                                            }}
                                                            disabled={loading}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            Quitar
                                                        </Button>
                                                    )}
                                                </div>
                                                <Textarea
                                                    placeholder="Comparte tu experiencia con otros usuarios..."
                                                    value={comentario}
                                                    onChange={(e) => setComentario(e.target.value)}
                                                    rows={3}
                                                    className="resize-none"
                                                    maxLength={maxComentarioLength}
                                                />
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <span className={`text-xs ${comentario.length > maxComentarioLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {comentario.length}/{maxComentarioLength}
                                                    </span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {isEditing && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={handleCancelEdit}
                                                                disabled={loading}
                                                            >
                                                                Cancelar
                                                            </Button>
                                                        )}
                                                        <Button
                                                            onClick={handleSubmitValoracion}
                                                            disabled={loading}
                                                            size="sm"
                                                            className="min-w-[120px]"
                                                        >
                                                            {loading ? (
                                                                <span className="flex items-center">
                                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    Guardando...
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center">
                                                                    <Send className="mr-2 h-4 w-4" />
                                                                    {miValoracion ? "Actualizar" : "Publicar"}
                                                                </span>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <Separator />
                                    </>
                                )}

                                {/* Lista de valoraciones de otros usuarios */}
                                <ValoracionesList
                                    key={refreshKey}
                                    estacionamientoId={estacionamiento.est_id}
                                />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog de confirmación para eliminar */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar valoración?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Tu valoración y comentario serán eliminados permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteValoracion}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {loading ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
