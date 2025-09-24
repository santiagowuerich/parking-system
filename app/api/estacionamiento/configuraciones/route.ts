import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const estId = Number(url.searchParams.get('est_id'));

        if (!estId || estId <= 0) {
            return NextResponse.json({ error: "ID de estacionamiento inválido" }, { status: 400 });
        }

        // Verificar que el usuario tenga acceso al estacionamiento
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Verificar que el usuario sea owner del estacionamiento
        const { data: empleado, error: empleadoError } = await supabase
            .from('empleados')
            .select('emp_rol')
            .eq('user_id', user.id)
            .eq('est_id', estId)
            .single();

        if (empleadoError || !empleado || empleado.emp_rol !== 'owner') {
            return NextResponse.json({ error: "No tienes permisos para acceder a esta configuración" }, { status: 403 });
        }

        // Obtener configuraciones del estacionamiento
        const { data, error } = await supabase
            .from("estacionamiento_configuraciones")
            .select("*")
            .eq("est_id", estId)
            .maybeSingle();

        if (error) {
            logger.error("Error fetching estacionamiento configuraciones:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Devolver configuraciones o valores por defecto
        const responseData = {
            mercadopagoApiKey: data?.mercadopago_api_key || null,
            bankAccountHolder: data?.bank_account_holder || null,
            bankAccountCbu: data?.bank_account_cbu || null,
            bankAccountAlias: data?.bank_account_alias || null,
        };

        const jsonResponse = NextResponse.json(responseData);
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Unexpected error fetching estacionamiento configuraciones:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const {
            estId,
            mercadopagoApiKey,
            bankAccountHolder,
            bankAccountCbu,
            bankAccountAlias
        } = await request.json();

        if (!estId || estId <= 0) {
            return NextResponse.json({ error: "ID de estacionamiento inválido" }, { status: 400 });
        }

        // Verificar que el usuario tenga acceso al estacionamiento
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Verificar que el usuario sea owner del estacionamiento
        const { data: empleado, error: empleadoError } = await supabase
            .from('empleados')
            .select('emp_rol')
            .eq('user_id', user.id)
            .eq('est_id', estId)
            .single();

        if (empleadoError || !empleado || empleado.emp_rol !== 'owner') {
            return NextResponse.json({ error: "No tienes permisos para modificar esta configuración" }, { status: 403 });
        }

        // Construir el objeto de datos a actualizar/insertar
        const dataToUpsert: any = {
            est_id: estId,
            updated_at: new Date().toISOString()
        };

        if (mercadopagoApiKey !== undefined) dataToUpsert.mercadopago_api_key = mercadopagoApiKey;
        if (bankAccountHolder !== undefined) dataToUpsert.bank_account_holder = bankAccountHolder;
        if (bankAccountCbu !== undefined) dataToUpsert.bank_account_cbu = bankAccountCbu;
        if (bankAccountAlias !== undefined) dataToUpsert.bank_account_alias = bankAccountAlias;

        const { error: upsertError } = await supabase
            .from("estacionamiento_configuraciones")
            .upsert(dataToUpsert, { onConflict: 'est_id' });

        if (upsertError) {
            logger.error("Error updating estacionamiento configuraciones:", upsertError);
            return NextResponse.json({ error: upsertError.message }, { status: 500 });
        }

        const jsonResponse = NextResponse.json({
            success: true,
            message: "Configuración del estacionamiento guardada correctamente"
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Unexpected error updating estacionamiento configuraciones:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
