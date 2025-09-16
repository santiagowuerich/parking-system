import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger, createTimer } from "@/lib/logger";

export async function POST(request: NextRequest) {
    const timer = createTimer('POST /api/auth/login');
    try {
        logger.debug('Iniciando proceso de login');

        const { supabase, response } = createClient(request);
        const { email, password } = await request.json();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            logger.warn('Login fallido:', error.message);
            timer.end();
            return NextResponse.json(
                { error: error.message },
                { status: 401 }
            );
        }

        logger.info('Login exitoso para usuario:', email);
        timer.end();
        return NextResponse.json({
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        logger.error('Error interno en login:', error);
        timer.end();
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
