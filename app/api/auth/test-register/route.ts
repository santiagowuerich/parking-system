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

        console.log('🧪 Probando registro de usuario de prueba:', email);

        // 1) Crear usuario en Supabase Auth
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

        // 3) Crear rol de dueño enlazado
        console.log('👑 Asignando rol de dueño con due_id:', usuarioData.usu_id);
        const { data: duenoData, error: duenoError } = await supabaseAdmin
            .from('dueno')
            .insert({ due_id: usuarioData.usu_id })
            .select()
            .single();

        if (duenoError && !duenoError.message?.includes('duplicate')) {
            console.error('❌ Error asignando rol de dueño:', duenoError);

            // Intentar rollback: eliminar usuario creado
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            await supabaseAdmin.from('usuario').delete().eq('usu_id', usuarioData.usu_id);

            return NextResponse.json(
                { error: duenoError.message || "No se pudo asignar rol de dueño" },
                { status: 400 }
            );
        }

        console.log('✅ Rol de dueño asignado exitosamente:', duenoData);

        // 4) Verificar el rol consultando la API
        console.log('🔍 Verificando rol asignado...');
        const { data: roleCheck, error: roleError } = await supabaseAdmin
            .from('usuario')
            .select(`
        usu_id,
        dueno!left(due_id)
      `)
            .eq('auth_user_id', authUserId)
            .single();

        let role = 'unknown';
        if (roleCheck?.dueno && roleCheck.dueno.length > 0) {
            role = 'owner';
        }

        console.log('🎯 Rol verificado:', role);

        return NextResponse.json({
            success: true,
            message: 'Usuario de prueba creado exitosamente',
            user: {
                auth_user_id: authUserId,
                usu_id: usuarioData.usu_id,
                email,
                nombre: `${nombre} ${apellido}`,
                rol_asignado: 'owner',
                rol_verificado: role,
                dueno_record: duenoData
            }
        });

    } catch (error: any) {
        console.error('❌ Error en test-register:', error);
        return NextResponse.json(
            { error: error?.message || 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
