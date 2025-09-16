import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email requerido" },
                { status: 400 }
            );
        }

        console.log(`🔧 Arreglando rol para usuario: ${email}`);

        // 1. Buscar usuario por email
        const { data: usuario, error: userError } = await supabaseAdmin
            .from('usuario')
            .select('usu_id, usu_email')
            .eq('usu_email', email)
            .single();

        if (userError || !usuario) {
            return NextResponse.json(
                { error: `Usuario ${email} no encontrado` },
                { status: 404 }
            );
        }

        console.log(`✅ Usuario encontrado: ID ${usuario.usu_id}`);

        // 2. Verificar si ya tiene registro como dueño
        const { data: duenoExistente, error: duenoCheckError } = await supabaseAdmin
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
            console.error('❌ Error creando registro de dueño:', createError);
            return NextResponse.json(
                { error: `Error creando registro de dueño: ${createError.message}` },
                { status: 500 }
            );
        }

        console.log('✅ Registro de dueño creado exitosamente');

        return NextResponse.json({
            success: true,
            message: 'Rol de dueño asignado exitosamente',
            user_id: usuario.usu_id,
            dueno_record: nuevoDueno,
            role: 'owner'
        });

    } catch (error: any) {
        console.error('❌ Error en fix-user-role:', error);
        return NextResponse.json(
            { error: error?.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
