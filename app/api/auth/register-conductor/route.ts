import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            email,
            password,
            nombre,
            apellido,
            dni,
            telefono
        } = body || {};

        if (!email || !password || !nombre || !apellido || !dni) {
            return NextResponse.json(
                { error: "Campos requeridos: email, password, nombre, apellido, dni" },
                { status: 400 }
            );
        }

        // 1) Crear usuario en Supabase Auth (confirmación inmediata)
        const { data: created, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: `${nombre} ${apellido}` }
        });

        if (createUserError || !created.user) {
            return NextResponse.json(
                { error: createUserError?.message || "No se pudo crear el usuario de autenticación" },
                { status: 400 }
            );
        }

        const authUserId = created.user.id;
        console.log('✅ Usuario creado en Supabase Auth con ID:', authUserId);

        // 2) Crear/asegurar fila en tabla `usuario`
        const { data: usuarioData, error: usuarioError } = await supabaseAdmin
            .from('usuario')
            .insert({
                usu_nom: nombre,
                usu_ape: apellido,
                usu_dni: dni,
                usu_tel: telefono || null,
                usu_email: email,
                usu_fechareg: new Date().toISOString(),
                usu_contrasena: 'supabase_auth',
                auth_user_id: authUserId
            })
            .select('usu_id, auth_user_id')
            .single();

        if (usuarioError) {
            console.error('❌ Error creando usuario en BD:', usuarioError);
            return NextResponse.json(
                { error: usuarioError.message || "No se pudo crear el usuario en la base de datos" },
                { status: 400 }
            );
        }

        console.log('✅ Usuario creado en BD con usu_id:', usuarioData.usu_id);
        console.log('✅ auth_user_id vinculado:', usuarioData.auth_user_id);

        // 3) Crear rol de conductor enlazado (en lugar de dueno)
        console.log('🚗 Asignando rol de conductor con con_id:', usuarioData.usu_id);
        const { error: conductorError } = await supabaseAdmin
            .from('conductores')
            .insert({ con_id: usuarioData.usu_id });

        if (conductorError && !conductorError.message?.includes('duplicate')) {
            console.error('❌ Error asignando rol de conductor:', conductorError);
            return NextResponse.json(
                { error: conductorError.message || "No se pudo asignar rol de conductor" },
                { status: 400 }
            );
        }

        console.log('✅ Rol de conductor asignado exitosamente');

        console.log('🎉 Registro de conductor completado exitosamente para usuario:', {
            email,
            auth_user_id: authUserId,
            usu_id: usuarioData.usu_id,
            rol: 'conductor'
        });

        return NextResponse.json({
            success: true,
            auth_user_id: authUserId,
            usu_id: usuarioData.usu_id,
            rol: 'conductor'
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
