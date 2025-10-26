import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const estId = parseInt(params.id);

        if (isNaN(estId)) {
            return NextResponse.json({
                success: false,
                error: 'ID de estacionamiento inválido'
            }, { status: 400 });
        }

        const supabase = await createAuthenticatedSupabaseClient();

        // Obtener el due_id del estacionamiento
        const { data: estData, error: estError } = await supabase
            .from("estacionamientos")
            .select("due_id")
            .eq("est_id", estId)
            .single();

        if (estError || !estData) {
            return NextResponse.json({
                success: false,
                error: 'Estacionamiento no encontrado'
            }, { status: 404 });
        }

        // Obtener el user_id del dueño
        const { data: usuarioData, error: usuarioError } = await supabase
            .from("usuario")
            .select("auth_user_id")
            .eq("usu_id", estData.due_id)
            .single();

        if (usuarioError || !usuarioData?.auth_user_id) {
            return NextResponse.json({
                success: false,
                error: 'Usuario del dueño no encontrado'
            }, { status: 404 });
        }

        // Obtener datos bancarios de user_settings
        const { data: configData, error: configError } = await supabase
            .from('user_settings')
            .select('bank_account_holder, bank_account_cbu, bank_account_alias')
            .eq('user_id', usuarioData.auth_user_id)
            .single();

        if (configError || !configData) {
            return NextResponse.json({
                success: false,
                error: 'No se encontraron datos bancarios configurados'
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: {
                cbu: configData.bank_account_cbu,
                alias: configData.bank_account_alias,
                accountHolder: configData.bank_account_holder,
                bank: 'Transferencia Bancaria'
            }
        });

    } catch (error) {
        console.error('Error obteniendo datos bancarios:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
