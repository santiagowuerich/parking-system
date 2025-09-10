"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the new configuration page
        router.replace("/dashboard/configuracion-pagos");
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Redirigiendo a Configuración de Pagos...</p>
            </div>
        </div>
    );
}
