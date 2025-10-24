import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Obtener est_id del query string
        const url = new URL(request.url);
        const estId = url.searchParams.get('est_id');

        if (!estId) {
            return NextResponse.json(
                { error: "ID del estacionamiento es requerido" },
                { status: 400 }
            );
        }

        const estIdNumber = parseInt(estId);
        logger.info(`🗑️ Iniciando eliminación del estacionamiento ${estIdNumber} por usuario ${user.email}`);

        // Obtener el usu_id del usuario autenticado
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', user.email)
            .single();

        if (usuarioError || !usuarioData) {
            logger.error(`❌ Usuario ${user.email} no encontrado en la base de datos:`, usuarioError);
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        // Verificar que el usuario sea dueño del estacionamiento
        const { data: estacionamiento, error: estError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, due_id')
            .eq('est_id', estIdNumber)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estacionamiento) {
            logger.error(`❌ Estacionamiento ${estIdNumber} no encontrado o usuario no autorizado:`, estError);
            return NextResponse.json(
                { error: "Estacionamiento no encontrado o no tienes permiso para eliminarlo" },
                { status: 404 }
            );
        }

        logger.info(`✅ Usuario ${user.email} verificado como dueño del estacionamiento ${estIdNumber} (${estacionamiento.est_nombre})`);

        // Eliminar datos asociados en orden de dependencias (de más específico a más general)

        // 1. Eliminar horarios
        const { error: horariosError } = await supabase
            .from('horarios_estacionamiento')
            .delete()
            .eq('est_id', estIdNumber);

        if (horariosError) {
            logger.error(`❌ Error eliminando horarios:`, horariosError);
        } else {
            logger.debug(`✅ Horarios eliminados para estacionamiento ${estIdNumber}`);
        }

        // 2. Eliminar métodos de pago
        const { error: metodosError } = await supabase
            .from('est_acepta_metodospago')
            .delete()
            .eq('est_id', estIdNumber);

        if (metodosError) {
            logger.error(`❌ Error eliminando métodos de pago:`, metodosError);
        } else {
            logger.debug(`✅ Métodos de pago eliminados para estacionamiento ${estIdNumber}`);
        }

        // 3. Eliminar tarifas
        const { error: tarifasError } = await supabase
            .from('tarifas')
            .delete()
            .eq('est_id', estIdNumber);

        if (tarifasError) {
            logger.error(`❌ Error eliminando tarifas:`, tarifasError);
        } else {
            logger.debug(`✅ Tarifas eliminadas para estacionamiento ${estIdNumber}`);
        }

        // 4. Eliminar historial de vehículos (si existe tabla de historial)
        const { error: historialError } = await supabase
            .from('historial_vehiculos')
            .delete()
            .eq('est_id', estIdNumber);

        if (historialError && historialError.code !== '42P01') {
            // 42P01 = tabla no existe, lo cual está bien
            logger.error(`❌ Error eliminando historial de vehículos:`, historialError);
        } else {
            logger.debug(`✅ Historial de vehículos eliminado para estacionamiento ${estIdNumber}`);
        }

        // 5. Eliminar plazas
        const { error: plazasError } = await supabase
            .from('plazas')
            .delete()
            .eq('est_id', estIdNumber);

        if (plazasError) {
            logger.error(`❌ Error eliminando plazas:`, plazasError);
            // Si falla eliminar plazas, no continuar (es crítico)
            return NextResponse.json(
                { error: "Error eliminando las plazas del estacionamiento" },
                { status: 500 }
            );
        } else {
            logger.debug(`✅ Plazas eliminadas para estacionamiento ${estIdNumber}`);
        }

        // 6. Eliminar asignaciones de empleados (si existen)
        const { error: empleadosError } = await supabase
            .from('empleados_estacionamiento')
            .delete()
            .eq('est_id', estIdNumber);

        if (empleadosError && empleadosError.code !== '42P01') {
            logger.error(`❌ Error eliminando asignaciones de empleados:`, empleadosError);
        } else {
            logger.debug(`✅ Asignaciones de empleados eliminadas para estacionamiento ${estIdNumber}`);
        }

        // 7. Finalmente, eliminar el estacionamiento
        const { error: deleteError } = await supabase
            .from('estacionamientos')
            .delete()
            .eq('est_id', estIdNumber);

        if (deleteError) {
            logger.error(`❌ Error eliminando estacionamiento:`, deleteError);
            return NextResponse.json(
                { error: "Error eliminando el estacionamiento" },
                { status: 500 }
            );
        }

        logger.info(`✅ Estacionamiento ${estIdNumber} (${estacionamiento.est_nombre}) eliminado exitosamente por ${user.email}`);

        return NextResponse.json({
            success: true,
            message: `Estacionamiento "${estacionamiento.est_nombre}" eliminado correctamente`,
            estacionamiento_id: estIdNumber
        });

    } catch (error) {
        logger.error("❌ Error general eliminando estacionamiento:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
