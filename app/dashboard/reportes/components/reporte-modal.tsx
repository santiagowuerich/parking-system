"use client";

import { ReactNode, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";

interface ReporteModalProps {
    isOpen: boolean;
    onClose: () => void;
    titulo: string;
    children: ReactNode;
}

export function ReporteModal({ isOpen, onClose, titulo, children }: ReporteModalProps) {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: titulo,
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] p-0 gap-0 [&>button]:hidden overflow-hidden flex flex-col">
                {/* Header fijo */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-slate-950 shrink-0">
                    <DialogTitle className="text-lg font-semibold">
                        {titulo}
                    </DialogTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="gap-2"
                        >
                            <Printer className="h-4 w-4" />
                            Exportar PDF
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-9 w-9 p-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Contenido scrolleable */}
                <div
                    ref={componentRef}
                    className="flex-1 overflow-auto p-5 bg-slate-50 dark:bg-slate-900"
                >
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
}
