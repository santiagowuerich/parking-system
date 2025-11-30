"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { ValoracionModal } from "./valoracion-modal";
import { ValoracionButtonProps } from "@/lib/types/valoraciones";

export function ValoracionButton({ estacionamiento }: ValoracionButtonProps) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <Button
                onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(true);
                }}
                className="flex-1 max-w-[200px] h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-lg shadow-lg"
            >
                <Star className="w-5 h-5 mr-2 fill-white text-white" />
                Valoraciones
            </Button>

            <ValoracionModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                estacionamiento={estacionamiento}
            />
        </>
    );
}

