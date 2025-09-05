"use client";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DuplicateTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    duplicateType: 'name' | 'config';
    existingTemplate: {
        plantilla_id: number;
        nombre_plantilla: string;
    };
    newTemplateName: string;
}

export function DuplicateTemplateDialog({
    isOpen,
    onClose,
    duplicateType,
    existingTemplate,
    newTemplateName
}: DuplicateTemplateDialogProps) {
    const getDialogContent = () => {
        if (duplicateType === 'name') {
            return {
                title: "🚫 Nombre de plantilla duplicado",
                description: `Ya existe una plantilla llamada "${existingTemplate.nombre_plantilla}" en este estacionamiento. Por favor, elige un nombre diferente para evitar confusiones.`,
                actionText: "Cambiar nombre"
            };
        } else {
            return {
                title: "🚫 Configuración duplicada no permitida",
                description: `Ya existe la plantilla "${existingTemplate.nombre_plantilla}" con exactamente la misma configuración (tipo de vehículo y características). No se permiten plantillas duplicadas.`,
                actionText: "Revisar configuración"
            };
        }
    };

    const content = getDialogContent();

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent className="max-w-lg border-red-200 bg-gradient-to-br from-red-50 to-blue-50">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <AlertDialogTitle className="text-left text-lg font-semibold text-red-900">
                                {content.title}
                            </AlertDialogTitle>
                        </div>
                    </div>
                    <AlertDialogDescription className="text-left text-red-800 leading-relaxed">
                        {content.description}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-sm text-red-800">
                            <strong>Plantilla existente:</strong> {existingTemplate.nombre_plantilla}
                            <br />
                            <strong>Intento de crear:</strong> {newTemplateName}
                        </div>
                    </div>
                </div>

                <AlertDialogFooter className="flex justify-end pt-4">
                    <AlertDialogCancel className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300">
                        {content.actionText}
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
