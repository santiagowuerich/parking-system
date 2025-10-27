import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const { preference_id, res_codigo } = await request.json();
        const supabase = await createAuthenticatedSupabaseClient();

        console.log(`🔍 [VERIFICAR-ESTADO] Verificando estado - preference_id: ${preference_id}, res_codigo: ${res_codigo}`);

        let reserva: any = null;

        if (res_codigo) {
            // Búsqueda por código directo
            const { data, error } = await supabase
                .from('reservas')
                .select('*')
                .eq('res_codigo', res_codigo)
                .single();

            if (error) {
                console.error('❌ [VERIFICAR-ESTADO] Error buscando por res_codigo:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Error buscando reserva'
                }, { status: 500 });
            }
            reserva = data;
        } else if (preference_id) {
            // Búsqueda por preference_id en payment_info (búsqueda en memoria)
            const { data: allReservas, error } = await supabase
                .from('reservas')
                .select('*');

            if (error) {
                console.error('❌ [VERIFICAR-ESTADO] Error buscando reservas:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Error buscando reserva'
                }, { status: 500 });
            }

            // Filtrar por preference_id en payment_info
            reserva = allReservas?.find((r: any) =>
                r.payment_info?.preference_id === preference_id
            );
        }

        if (!reserva) {
            console.log('⚠️ [VERIFICAR-ESTADO] Reserva no encontrada');
            return NextResponse.json({
                success: false,
                error: 'Reserva no encontrada'
            }, { status: 404 });
        }

        console.log(`✅ [VERIFICAR-ESTADO] Reserva encontrada: ${reserva.res_codigo}, estado: ${reserva.res_estado}`);

        return NextResponse.json({
            success: true,
            reserva: reserva
        });

    } catch (error) {
        console.error('❌ [VERIFICAR-ESTADO] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}


