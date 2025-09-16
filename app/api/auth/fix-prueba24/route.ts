import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
    try {
        console.log('🔧 Arreglando usuario prueba24@gmail.com...');

        // 1. Buscar usuario
        const { data: usuario, error: userError } = await supabaseAdmin
            .from('usuario')
            .select('*')
            .eq('usu_email', 'prueba24@gmail.com')
            .single();

        if (userError || !usuario) {
            return NextResponse.json({
                error: 'Usuario no encontrado',
                details: userError?.message
            }, { status: 404 });
        }

        console.log(`✅ Usuario encontrado - ID: ${usuario.usu_id}`);

        // 2. Verificar si ya tiene registro como dueño
        const { data: duenoExistente, error: duenoError } = await supabaseAdmin
            .from('dueno')
            .select('*')
            .eq('due_id', usuario.usu_id)
            .single();

        if (duenoExistente) {
            console.log('✅ Usuario ya es dueño');
            return NextResponse.json({
                success: true,
                message: 'Usuario ya tiene rol de dueño',
                user_id: usuario.usu_id,
                role: 'owner'
            });
        }

        // 3. Crear registro como dueño
        console.log('👑 Creando registro de dueño...');
        const { data: nuevoDueno, error: createError } = await supabaseAdmin
            .from('dueno')
            .insert({ due_id: usuario.usu_id })
            .select()
            .single();

        if (createError) {
            console.log('❌ Error creando registro de dueño:', createError);
            return NextResponse.json({
                error: 'Error creando registro de dueño',
                details: createError.message
            }, { status: 500 });
        }

        console.log('✅ Registro de dueño creado exitosamente');

        // 4. Verificar rol
        const { data: roleCheck, error: roleError } = await supabaseAdmin
            .from('usuario')
            .select(`
        usu_id,
        dueno!left(due_id)
      `)
            .eq('usu_id', usuario.usu_id)
            .single();

        const hasRole = roleCheck?.dueno && roleCheck.dueno.length > 0;
        const role = hasRole ? 'owner' : 'unknown';

        return NextResponse.json({
            success: true,
            message: 'Usuario arreglado exitosamente',
            user: {
                user_id: usuario.usu_id,
                email: usuario.usu_email,
                dueno_record: nuevoDueno,
                role: role,
                has_role: hasRole
            }
        });

    } catch (error: any) {
        console.error('❌ Error en fix-prueba24:', error);
        return NextResponse.json(
            { error: error?.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
