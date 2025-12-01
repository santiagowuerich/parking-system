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

        // Buscar el usuario en la tabla tradicional por email
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', user.email)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        // Obtener el estacionamiento y su dueño
        const { data: estacionamiento, error: estError } = await supabase
            .from('estacionamientos')
            .select('est_id, due_id')
            .eq('est_id', estId)
            .single();

        if (estError || !estacionamiento) {
            return NextResponse.json({ error: "Estacionamiento no encontrado" }, { status: 404 });
        }

        // Verificar si el usuario es dueño del estacionamiento
        const esDueno = estacionamiento.due_id === usuarioData.usu_id;

        // Si no es dueño, verificar si es empleado activo del estacionamiento
        let esEmpleado = false;
        if (!esDueno) {
            const { data: empleadoData } = await supabase
                .from('empleados_estacionamiento')
                .select('play_id')
                .eq('est_id', estId)
                .eq('play_id', usuarioData.usu_id)
                .eq('activo', true)
                .maybeSingle();
            
            esEmpleado = !!empleadoData;
        }

        // Si no es dueño ni empleado, denegar acceso
        if (!esDueno && !esEmpleado) {
            return NextResponse.json({ error: "No tienes permisos para acceder a esta configuración" }, { status: 403 });
        }

        // Obtener el auth_user_id del dueño para buscar su configuración
        const { data: duenoData, error: duenoError } = await supabase
            .from('usuario')
            .select('auth_user_id')
            .eq('usu_id', estacionamiento.due_id)
            .single();

        if (duenoError || !duenoData?.auth_user_id) {
            return NextResponse.json({ error: "No se pudo obtener la configuración del dueño" }, { status: 500 });
        }

        // Obtener configuraciones del DUEÑO del estacionamiento (user_settings)
        const { data, error } = await supabase
            .from("user_settings")
            .select("mercadopago_api_key, bank_account_holder, bank_account_cbu, bank_account_alias")
            .eq("user_id", duenoData.auth_user_id)
            .maybeSingle();

        if (error) {
            logger.error("Error fetching user settings:", error);
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

        // Buscar el usuario en la tabla tradicional por email
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', user.email)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        // Verificar que el usuario sea dueño del estacionamiento
        const { data: estacionamiento, error: estError } = await supabase
            .from('estacionamientos')
            .select('est_id, due_id')
            .eq('est_id', estId)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estacionamiento) {
            return NextResponse.json({ error: "No tienes permisos para modificar esta configuración" }, { status: 403 });
        }

        // Verificar si existe un registro
        const { data: existing } = await supabase
            .from("user_settings")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (existing) {
            // Update existing record
            const dataToUpdate: any = {};
            if (mercadopagoApiKey !== undefined) dataToUpdate.mercadopago_api_key = mercadopagoApiKey;
            if (bankAccountHolder !== undefined) dataToUpdate.bank_account_holder = bankAccountHolder;
            if (bankAccountCbu !== undefined) dataToUpdate.bank_account_cbu = bankAccountCbu;
            if (bankAccountAlias !== undefined) dataToUpdate.bank_account_alias = bankAccountAlias;

            logger.info("Updating user_settings with data:", JSON.stringify(dataToUpdate));

            const { error: updateError } = await supabase
                .from("user_settings")
                .update(dataToUpdate)
                .eq("user_id", user.id);

            if (updateError) {
                logger.error("Error updating user settings:", JSON.stringify(updateError));
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        } else {
            // Insert new record
            const dataToInsert: any = {
                user_id: user.id
            };
            if (mercadopagoApiKey !== undefined) dataToInsert.mercadopago_api_key = mercadopagoApiKey;
            if (bankAccountHolder !== undefined) dataToInsert.bank_account_holder = bankAccountHolder;
            if (bankAccountCbu !== undefined) dataToInsert.bank_account_cbu = bankAccountCbu;
            if (bankAccountAlias !== undefined) dataToInsert.bank_account_alias = bankAccountAlias;

            logger.info("Inserting user_settings with data:", JSON.stringify(dataToInsert));

            const { error: insertError } = await supabase
                .from("user_settings")
                .insert(dataToInsert);

            if (insertError) {
                logger.error("Error inserting user settings:", JSON.stringify(insertError));
                return NextResponse.json({ error: insertError.message }, { status: 500 });
            }
        }

        const jsonResponse = NextResponse.json({
            success: true,
            message: "Configuración guardada correctamente"
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Unexpected error updating user settings:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
