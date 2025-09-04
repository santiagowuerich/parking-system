import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await request.json();

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            return NextResponse.json(
                { error: "API key es requerida" },
                { status: 400 }
            );
        }

        // Validar formato básico de API key
        if (!/^[A-Za-z0-9_-]{39}$/.test(apiKey.trim())) {
            return NextResponse.json(
                { error: "Formato de API key inválido" },
                { status: 400 }
            );
        }

        // Aquí podrías guardar en una base de datos si quisieras
        // Por ahora, solo validamos que llegue correctamente

        console.log('✅ API key de Google Maps configurada correctamente');

        return NextResponse.json({
            success: true,
            message: "API key configurada correctamente",
            apiKey: apiKey.substring(0, 10) + "..."
        });

    } catch (error) {
        console.error("❌ Error configurando API key:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        // Verificar estado de configuración
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        const isConfigured = apiKey && apiKey !== 'TU_API_KEY_AQUI';

        return NextResponse.json({
            isConfigured,
            apiKey: isConfigured ? apiKey.substring(0, 10) + "..." : null
        });

    } catch (error) {
        console.error("❌ Error obteniendo estado de configuración:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
