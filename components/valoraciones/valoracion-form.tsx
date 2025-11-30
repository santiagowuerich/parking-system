"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { StarRating } from "./star-rating";
import { ValoracionFormProps, CreateValoracionRequest } from "@/lib/types/valoraciones";

export function ValoracionForm({
    estacionamientoId,
    valoracionExistente,
    onSubmit,
    onCancel,
    loading = false
}: ValoracionFormProps) {
    const [rating, setRating] = useState<number>(valoracionExistente?.val_rating || 0);
    const [comentario, setComentario] = useState<string>(valoracionExistente?.val_comentario || "");
    const [error, setError] = useState<string>("");

    const maxComentarioLength = 500;
    const isEditing = !!valoracionExistente;

    // Actualizar formulario si cambia la valoración existente
    useEffect(() => {
        if (valoracionExistente) {
            setRating(valoracionExistente.val_rating);
            setComentario(valoracionExistente.val_comentario || "");
        }
    }, [valoracionExistente]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validaciones
        if (rating < 1 || rating > 5) {
            setError("Debes seleccionar una calificación entre 1 y 5 estrellas");
            return;
        }

        if (comentario.length > maxComentarioLength) {
            setError(`El comentario no puede exceder ${maxComentarioLength} caracteres`);
            return;
        }

        const data: CreateValoracionRequest = {
            rating,
            comentario: comentario.trim() || undefined
        };

        try {
            await onSubmit(data);
        } catch (err: any) {
            setError(err.message || "Error al guardar la valoración");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de Rating */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    Tu calificación <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                    <StarRating
                        rating={rating}
                        onRatingChange={setRating}
                        size="lg"
                    />
                    {rating > 0 && (
                        <span className="text-sm text-gray-500">
                            {rating === 1 && "Muy malo"}
                            {rating === 2 && "Malo"}
                            {rating === 3 && "Regular"}
                            {rating === 4 && "Bueno"}
                            {rating === 5 && "Excelente"}
                        </span>
                    )}
                </div>
            </div>

            {/* Campo de Comentario */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="comentario" className="text-sm font-medium">
                        Comentario (opcional)
                    </Label>
                    <span className={`text-xs ${comentario.length > maxComentarioLength ? 'text-red-500' : 'text-gray-400'}`}>
                        {comentario.length}/{maxComentarioLength}
                    </span>
                </div>
                <Textarea
                    id="comentario"
                    placeholder="Comparte tu experiencia con otros usuarios..."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={4}
                    className="resize-none"
                    maxLength={maxComentarioLength + 50} // Un poco más para mostrar el error
                />
            </div>

            {/* Mensaje de Error */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Botones de Acción */}
            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={loading || rating === 0}
                    className="min-w-[100px]"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        isEditing ? "Actualizar" : "Publicar"
                    )}
                </Button>
            </div>
        </form>
    );
}

