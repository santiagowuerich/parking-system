import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint para guardar el vehículo seleccionado por el conductor
 * POST /api/conductor/select-vehicle
 */
export async function POST(request: NextRequest) {
    try {
        const { vehicleId } = await request.json();
        const { supabase } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        console.log(`🚗 Actualizando vehículo seleccionado para ${user.email}: ${vehicleId || 'ninguno'}`);

        // Actualizar vehículo seleccionado en la BD
        const { error } = await supabase
            .from('usuario')
            .update({ selected_vehicle_id: vehicleId })
            .eq('auth_user_id', user.id);

        if (error) {
            console.error('❌ Error actualizando vehículo seleccionado:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        console.log(`✅ Vehículo seleccionado actualizado correctamente`);
        return NextResponse.json({
            success: true,
            vehicleId
        });

    } catch (error) {
        console.error("❌ Error en select-vehicle:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

/**
 * Obtener el vehículo seleccionado del conductor
 * GET /api/conductor/select-vehicle
 */
export async function GET(request: NextRequest) {
    try {
        const { supabase } = createClient(request);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        // Obtener usuario con vehículo seleccionado
        const { data: usuario, error: usuarioError } = await supabase
            .from('usuario')
            .select('selected_vehicle_id')
            .eq('auth_user_id', user.id)
            .single();

        if (usuarioError || !usuario) {
            return NextResponse.json({ vehicleId: null });
        }

        // Si hay vehículo seleccionado, obtener sus datos
        if (usuario.selected_vehicle_id) {
            const { data: vehicle, error: vehicleError } = await supabase
                .from('vehiculos')
                .select(`
                    veh_patente,
                    veh_marca,
                    veh_modelo,
                    veh_color,
                    catv_segmento,
                    cat_vehiculo(catv_descripcion)
                `)
                .eq('veh_patente', usuario.selected_vehicle_id)
                .single();

            if (!vehicleError && vehicle) {
                return NextResponse.json({
                    vehicle: {
                        id: vehicle.veh_patente,
                        patente: vehicle.veh_patente,
                        tipo: vehicle.catv_segmento,
                        marca: vehicle.veh_marca || '',
                        modelo: vehicle.veh_modelo || '',
                        color: vehicle.veh_color || ''
                    }
                });
            }
        }

        return NextResponse.json({ vehicleId: null });

    } catch (error) {
        console.error("❌ Error obteniendo vehículo seleccionado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
