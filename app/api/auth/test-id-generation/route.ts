import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        console.log("🧪 PRUEBA DE DIAGNÓSTICO - Generación de IDs");

        // 1. Verificar IDs existentes
        const { data: existingIds, error: existingError } = await supabase
            .from('estacionamientos')
            .select('est_id')
            .order('est_id');

        if (existingError) {
            console.error("❌ Error obteniendo IDs existentes:", existingError);
            return NextResponse.json({ error: "Error consultando IDs existentes" }, { status: 500 });
        }

        const ids = existingIds?.map(item => item.est_id) || [];
        const maxId = ids.length > 0 ? Math.max(...ids) : 0;
        const nextId = maxId + 1;

        console.log("📊 IDs existentes:", ids);
        console.log("📍 ID máximo actual:", maxId);
        console.log("🎯 Próximo ID calculado:", nextId);

        // 2. Intentar insertar con el ID calculado
        console.log("🔧 Intentando insertar estacionamiento de prueba...");

        const { data: testData, error: testError } = await supabase
            .from('estacionamientos')
            .insert({
                est_id: nextId,
                est_prov: 'TEST',
                est_locali: 'TEST',
                est_direc: 'TEST',
                est_nombre: 'TEST - ESTACIONAMIENTO DIAGNOSTICO',
                est_capacidad: 0,
                due_id: 1, // Usar un due_id existente para la prueba
                est_cantidad_espacios_disponibles: 0,
                est_horario_funcionamiento: 24,
                est_tolerancia_min: 15
            })
            .select();

        if (testError) {
            console.error("❌ Error en inserción de prueba:", testError);
            return NextResponse.json({
                error: "Error en inserción de prueba",
                details: testError,
                calculated_next_id: nextId,
                existing_ids: ids
            }, { status: 500 });
        }

        console.log("✅ Inserción de prueba exitosa:", testData);

        // 3. Limpiar el registro de prueba
        console.log("🧹 Limpiando registro de prueba...");
        const { error: deleteError } = await supabase
            .from('estacionamientos')
            .delete()
            .eq('est_id', nextId)
            .eq('est_nombre', 'TEST - ESTACIONAMIENTO DIAGNOSTICO');

        if (deleteError) {
            console.warn("⚠️ No se pudo limpiar el registro de prueba:", deleteError);
        }

        return NextResponse.json({
            success: true,
            diagnosis: {
                existing_ids: ids,
                max_id: maxId,
                calculated_next_id: nextId,
                test_insertion_successful: true,
                test_cleanup_successful: !deleteError
            },
            message: "Diagnóstico completado exitosamente"
        });

    } catch (error) {
        console.error("❌ Error en diagnóstico:", error);
        return NextResponse.json(
            { error: "Error interno en diagnóstico" },
            { status: 500 }
        );
    }
}

