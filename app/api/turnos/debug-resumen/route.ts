import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const turId = url.searchParams.get('tur_id');

        if (!turId) {
            return NextResponse.json({ error: "tur_id es requerido" }, { status: 400 });
        }

        // Test 1: Get turno
        const { data: turno, error: turnoError } = await supabase
            .from('turnos_empleados')
            .select('*')
            .eq('tur_id', turId)
            .single();

        // Test 2: Get empleado (play_id references usuario.usu_id directly)
        const { data: empleado, error: empleadoError } = await supabase
            .from('usuario')
            .select('usu_nom, usu_ape')
            .eq('usu_id', turno?.play_id)
            .single();

        // Test 3: Count movements
        const { count: ingresos, error: ingresosError } = await supabase
            .from('ocupacion')
            .select('*', { count: 'exact', head: true })
            .eq('est_id', turno?.est_id);

        // Test 4: Get egresos with payments
        const { data: egresos, error: egresosError } = await supabase
            .from('ocupacion')
            .select(`
                ocu_id,
                veh_patente,
                ocu_precio_acordado,
                pag_nro,
                pagos(
                    pag_monto,
                    mepa_metodo
                )
            `)
            .eq('est_id', turno?.est_id)
            .not('ocu_fh_salida', 'is', null)
            .limit(5);

        return NextResponse.json({
            turno: { data: turno, error: turnoError },
            empleado: { data: empleado, error: empleadoError },
            ingresos: { count: ingresos, error: ingresosError },
            egresos: { data: egresos, error: egresosError }
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
