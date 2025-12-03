import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { logger } from '@/lib/logger';

// GET - Obtener empleados de un estacionamiento
export async function GET(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();
        const { searchParams } = new URL(request.url);
        const estId = searchParams.get('est_id');

        // Obtener el usuario autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Obtener el usu_id del usuario autenticado
        const { data: usuario, error: userError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', user.email)
            .single();

        if (userError || !usuario) {
            return NextResponse.json(
                { error: "Usuario no encontrado en la base de datos" },
                { status: 404 }
            );
        }

        const userId = usuario.usu_id;

        // Verificar si el usuario es un DUEÑO o un EMPLEADO
        const { data: duenoCheck, error: duenoError } = await supabaseAdmin
            .from('dueno')
            .select('due_id')
            .eq('due_id', userId)
            .single();

        const isDueno = !duenoError && duenoCheck !== null;

        // Si no se especifica est_id, obtener empleados según el rol del usuario
        let query = supabase
            .from('empleados_estacionamiento')
            .select(`
                *,
                playeros (
                    *,
                    usuario (*)
                ),
                estacionamientos (
                    est_id,
                    est_nombre,
                    est_locali
                )
            `)
            .eq('activo', true);

        // Si se especifica est_id, filtrar por ese estacionamiento
        if (estId) {
            query = query.eq('est_id', parseInt(estId));
        } else {
            if (isDueno) {
                // DUEÑO: obtener empleados de sus estacionamientos usando consulta directa

                // Para dueños, obtener todos los empleados de sus estacionamientos
                // La política RLS se encargará de filtrar automáticamente

            } else {
                // EMPLEADO: obtener solo su propia asignación
                query = query.eq('play_id', userId);
            }
        }

        // Ejecutar la consulta

        const { data: empleados, error } = await query;


        if (error) {
            console.log('❌ GET /api/empleados - Error en consulta:', error);
            return NextResponse.json(
                { error: "Error al obtener empleados" },
                { status: 500 }
            );
        }

        // Obtener disponibilidad para todos los empleados encontrados
        const empleadosIds = empleados?.map(emp => emp.play_id) || [];
        console.log('🔍 GET /api/empleados - IDs de empleados:', empleadosIds);

        let disponibilidadData: any[] = [];
        if (empleadosIds.length > 0) {
            const { data: disponibilidad, error: dispError } = await supabase
                .from('disponibilidad_empleado')
                .select(`
                    play_id,
                    dia_semana,
                    turno_id,
                    turnos_catalogo (
                        nombre_turno
                    )
                `)
                .in('play_id', empleadosIds);

            if (dispError) {
                // mantén silencio en prod
            } else {
                disponibilidadData = disponibilidad || [];
                console.log('📅 GET /api/empleados - Disponibilidad obtenida:', disponibilidadData.length, 'registros');
            }
        }

        // Obtener usuarios faltantes si la relación viene null
        const missingUserIds = (empleados || [])
            .filter(emp => !emp.playeros || !emp.playeros.usuario)
            .map(emp => emp.play_id);

        let missingUsersMap: Record<number, any> = {};
        if (missingUserIds.length > 0) {
            const { data: missingUsers, error: missingUsersError } = await supabaseAdmin
                .from('usuario')
                .select('usu_id, usu_nom, usu_ape, usu_dni, usu_email, usu_estado, requiere_cambio_contrasena')
                .in('usu_id', missingUserIds);

            if (!missingUsersError && Array.isArray(missingUsers)) {
                missingUsers.forEach(u => { missingUsersMap[u.usu_id] = u; });
            } else {
                console.log('⚠️ GET /api/empleados - No se pudo obtener usuarios faltantes:', missingUsersError);
            }
        }

        // Transformar los datos para un formato más amigable
        const empleadosFormateados = empleados?.map(emp => {
            const usuario = emp.playeros?.usuario || missingUsersMap[emp.play_id] || null;
            const estacionamiento = emp.estacionamientos;

            // Filtrar disponibilidad para este empleado
            const disponibilidadEmpleado = disponibilidadData
                .filter(d => d.play_id === emp.play_id)
                .map(d => ({
                    dia_semana: d.dia_semana,
                    turno: d.turnos_catalogo?.nombre_turno || 'Sin turno',
                    turno_id: d.turno_id
                }));

            // Si no se pudo obtener el usuario, devolver un objeto mínimo para no romper UI
            if (!usuario) {
                return {
                    usu_id: emp.play_id,
                    nombre: 'Desconocido',
                    apellido: '',
                    dni: '',
                    email: '',
                    estado: 'Activo',
                    requiere_cambio_contrasena: false,
                    disponibilidad: disponibilidadEmpleado,
                    estacionamiento: {
                        est_id: estacionamiento?.est_id || null,
                        est_nombre: estacionamiento?.est_nombre || 'N/A',
                        est_locali: estacionamiento?.est_locali || 'N/A'
                    },
                    fecha_asignacion: emp.fecha_asignacion,
                    activo: emp.activo
                };
            }

            return {
                usu_id: usuario.usu_id,
                nombre: usuario.usu_nom,
                apellido: usuario.usu_ape,
                dni: usuario.usu_dni,
                email: usuario.usu_email,
                estado: usuario.usu_estado,
                requiere_cambio_contrasena: usuario.requiere_cambio_contrasena,
                disponibilidad: disponibilidadEmpleado,
                estacionamiento: {
                    est_id: estacionamiento.est_id,
                    est_nombre: estacionamiento.est_nombre,
                    est_locali: estacionamiento.est_locali
                },
                fecha_asignacion: emp.fecha_asignacion,
                activo: emp.activo
            };
        }) || [];

        console.log('✅ GET /api/empleados - Empleados formateados:', empleadosFormateados.length);
        console.log('👥 GET /api/empleados - Lista formateada:', empleadosFormateados);

        // Verificar que los empleados tienen disponibilidad
        empleadosFormateados.forEach((emp, index) => {
            console.log(`👤 Empleado ${index + 1} (${emp.nombre} ${emp.apellido}): ${emp.disponibilidad.length} turnos`);
        });

        return NextResponse.json({
            empleados: empleadosFormateados
        });

    } catch (error) {
        console.error('Error en GET /api/empleados:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// POST - Crear nuevo empleado
export async function POST(request: NextRequest) {
    try {
        logger.debug('Iniciando creación de empleado');
        const supabase = await createAuthenticatedSupabaseClient();
        const body = await request.json();
        logger.debug(`Creando empleado para: ${body?.email || 'email no especificado'}`);

        // Obtener el usuario autenticado
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        logger.debug(`Usuario autenticado: ${user ? user.email : 'null'}`);

        if (authError || !user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const {
            nombre,
            apellido,
            dni,
            email,
            contrasena,
            estado = 'Activo',
            est_id,
            disponibilidad = [] // Array de {dia_semana, turno_id}
        } = body;

        // Validaciones básicas
        console.log('✅ Campos extraídos:', { nombre, apellido, dni, email, contrasena: contrasena ? '***' : null, est_id, disponibilidad });

        if (!nombre || !apellido || !dni || !email || !contrasena || !est_id) {
            console.log('❌ Faltan campos requeridos');
            return NextResponse.json(
                { error: "Faltan campos requeridos" },
                { status: 400 }
            );
        }
        console.log('✅ Validaciones básicas pasaron');

        // Validar DNI: solo números, entre 7 y 9 dígitos
        if (!/^\d{7,9}$/.test(dni)) {
            console.log('❌ DNI inválido:', dni);
            return NextResponse.json(
                { error: "El DNI debe contener solo números y tener entre 7 y 9 dígitos" },
                { status: 400 }
            );
        }
        console.log('✅ Validación de DNI pasada');

        // Verificar que el estacionamiento existe y pertenece al usuario autenticado
        const { data: usuarioAutenticado, error: userAuthError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', user.email)
            .single();

        if (userAuthError || !usuarioAutenticado) {
            return NextResponse.json(
                { error: "Usuario no encontrado en la base de datos" },
                { status: 404 }
            );
        }

        // VALIDACIÓN DE SEGURIDAD: Verificar que el usuario autenticado es DUEÑO del estacionamiento
        const { data: duenoValidation, error: duenoError } = await supabaseAdmin
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioAutenticado.usu_id)
            .single();

        if (duenoError || !duenoValidation) {
            console.log('🚫 Usuario no es dueño:', usuarioAutenticado.usu_id);
            return NextResponse.json(
                { error: "Solo los dueños pueden crear empleados" },
                { status: 403 }
            );
        }

        console.log('✅ Validación de seguridad: Usuario es dueño del sistema');

        const { data: estacionamiento, error: estError } = await supabaseAdmin
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('est_id', est_id)
            .eq('due_id', usuarioAutenticado.usu_id)
            .single();

        if (estError || !estacionamiento) {
            return NextResponse.json(
                { error: "Estacionamiento no encontrado o no tienes permisos para crear empleados en este estacionamiento" },
                { status: 403 }
            );
        }


        // Verificar que el email no esté duplicado
        const { data: existingUser } = await supabaseAdmin
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (existingUser) {
            return NextResponse.json(
                { error: "Ya existe un usuario con este email" },
                { status: 409 }
            );
        }

        // Hash de la contraseña
        const hashedPassword = await hash(contrasena, 12);

        // PRIMERO: Crear usuario en Supabase Auth
        console.log('🔐 Creando usuario en Supabase Auth...');
        const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: contrasena, // Usar contraseña original, no hasheada
            email_confirm: true, // Confirmar email automáticamente
            user_metadata: {
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                tipo: 'empleado'
            }
        });

        if (createAuthError) {
            console.error('❌ Error creando usuario en Auth:', createAuthError);
            return NextResponse.json(
                { error: "Error al crear usuario en el sistema de autenticación" },
                { status: 500 }
            );
        }

        if (!authUser?.user) {
            console.error('❌ Usuario creado pero sin datos válidos');
            return NextResponse.json(
                { error: "Error al obtener datos del usuario creado" },
                { status: 500 }
            );
        }

        console.log('✅ Usuario creado en Auth:', authUser.user.id);

        // SEGUNDO: Crear empleado en la base de datos del sistema
        console.log('🔗 Iniciando creación de empleado en BD con auth_user_id:', authUser.user.id);
        // Primero crear registro en tabla usuario si no existe
        const { error: userInsertError } = await supabaseAdmin
            .from('usuario')
            .insert({
                usu_nom: nombre,
                usu_ape: apellido,
                usu_dni: dni,
                usu_email: email,
                usu_contrasena: hashedPassword,
                usu_fechareg: new Date().toISOString(),
                usu_estado: estado || 'Activo',
                requiere_cambio_contrasena: false,
                auth_user_id: authUser.user.id
            });

        if (userInsertError) {
            console.error('❌ Error insertando usuario en tabla usuario:', userInsertError);
            console.error('   Detalles del error:', userInsertError.details);
            console.error('   Código de error:', userInsertError.code);

            // Intentar eliminar el usuario de Auth y limpiar datos
            try {
                await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
                // También intentar limpiar cualquier registro de usuario que se haya creado
                await supabaseAdmin.from('usuario').delete().eq('usu_email', email);
                console.log('✅ Usuario de Auth y datos eliminados por error en BD');
            } catch (cleanupError) {
                console.error('⚠️ Error limpiando:', cleanupError);
            }

            return NextResponse.json(
                { error: "Error al crear el usuario en la base de datos" },
                { status: 500 }
            );
        }

        // Obtener el usu_id generado automáticamente usando el email
        const { data: usuarioCreado, error: getUserError } = await supabaseAdmin
            .from('usuario')
            .select('usu_id, auth_user_id')
            .eq('usu_email', email)
            .single();

        if (getUserError || !usuarioCreado) {
            console.error('❌ Error obteniendo usuario creado:', getUserError);

            // Limpiar datos
            try {
                await supabaseAdmin.from('usuario').delete().eq('usu_email', email);
                await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
                console.log('🧹 Datos limpiados por error al obtener usu_id');
            } catch (cleanupError) {
                console.error('⚠️ Error limpiando:', cleanupError);
            }

            return NextResponse.json(
                { error: "Error obteniendo usuario creado" },
                { status: 500 }
            );
        }

        console.log('✅ Usuario creado en BD con usu_id:', usuarioCreado.usu_id);
        console.log('✅ auth_user_id vinculado correctamente:', usuarioCreado.auth_user_id);

        // Crear las relaciones manualmente (en lugar de usar la función)
        console.log('🔗 Creando relaciones de empleado manualmente...');

        try {
            // PASO 1: Insertar en playeros
            console.log('👤 Insertando en playeros con play_id:', usuarioCreado.usu_id);
            const { error: playeroError } = await supabaseAdmin
                .from('playeros')
                .insert({ play_id: usuarioCreado.usu_id });

            if (playeroError) {
                console.error('❌ Error insertando en playeros:', playeroError);
                throw playeroError;
            }
            console.log('✅ Rol de playero asignado exitosamente');

            // PASO 2: Insertar en empleados_estacionamiento
            console.log('🏢 Insertando en empleados_estacionamiento...');
            const { error: empleadoEstError } = await supabaseAdmin
                .from('empleados_estacionamiento')
                .insert({
                    play_id: usuarioCreado.usu_id,
                    est_id: est_id
                });

            if (empleadoEstError) {
                console.error('❌ Error insertando en empleados_estacionamiento:', empleadoEstError);
                throw empleadoEstError;
            }

            // PASO 3: Insertar disponibilidad si se proporcionó
            if (disponibilidad && disponibilidad.length > 0) {
                console.log('📅 Insertando disponibilidad...');
                for (const disp of disponibilidad) {
                    const { error: dispError } = await supabaseAdmin
                        .from('disponibilidad_empleado')
                        .insert({
                            play_id: usuarioCreado.usu_id,
                            dia_semana: disp.dia_semana,
                            turno_id: disp.turno_id
                        });

                    if (dispError) {
                        console.error('❌ Error insertando disponibilidad:', dispError);
                        throw dispError;
                    }
                }
            }

            console.log('✅ Relaciones de empleado creadas exitosamente');

        } catch (transactionError) {
            console.error('❌ Error creando relaciones:', transactionError);

            // Intentar eliminar el usuario de Auth y limpiar datos si falló la creación en BD
            try {
                console.log('🧹 Intentando limpiar usuario de Auth y datos...');
                await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
                await supabaseAdmin.from('usuario').delete().eq('usu_email', email);
                console.log('✅ Usuario de Auth y datos eliminados por error en BD');
            } catch (cleanupError) {
                console.error('⚠️ Error limpiando:', cleanupError);
            }

            return NextResponse.json(
                { error: "Error al crear las relaciones del empleado" },
                { status: 500 }
            );
        }

        console.log('🎉 POST /api/empleados - Empleado creado exitosamente');

        // Crear objeto de respuesta
        const empleadoCreado = {
            usu_id: usuarioCreado.usu_id,
            nombre: nombre,
            apellido: apellido,
            dni: dni,
            email: email,
            estado: estado || 'Activo',
            estacionamiento_id: est_id,
            auth_user_id: authUser.user.id,
            rol: 'playero'
        };

        console.log('🎉 Alta de empleado completada exitosamente:', {
            email,
            auth_user_id: authUser.user.id,
            usu_id: usuarioCreado.usu_id,
            rol: 'playero'
        });

        return NextResponse.json({
            message: "Empleado creado exitosamente",
            empleado: empleadoCreado,
            auth_user_id: authUser.user.id,
            rol: 'playero'
        }, { status: 201 });

    } catch (error) {
        console.error('Error en POST /api/empleados:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// PUT - Actualizar empleado
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();

        const body = await request.json();
        const {
            usu_id,
            nombre,
            apellido,
            dni,
            email,
            estado,
            disponibilidad = []
        } = body;

        if (!usu_id) {
            return NextResponse.json(
                { error: "El campo usu_id es requerido" },
                { status: 400 }
            );
        }

        // Actualizar datos del usuario
        const updateData: any = {};
        if (nombre !== undefined) updateData.usu_nom = nombre;
        if (apellido !== undefined) updateData.usu_ape = apellido;
        if (dni !== undefined) updateData.usu_dni = dni;
        if (email !== undefined) updateData.usu_email = email;
        if (estado !== undefined) updateData.usu_estado = estado;

        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabaseAdmin
                .from('usuario')
                .update(updateData)
                .eq('usu_id', usu_id);

            if (updateError) {
                console.error('Error actualizando usuario:', updateError);
                return NextResponse.json(
                    { error: "Error al actualizar datos del usuario" },
                    { status: 500 }
                );
            }
        }

        // Actualizar disponibilidad si se proporcionó
        if (disponibilidad && disponibilidad.length >= 0) {
            // Primero eliminar la disponibilidad existente
            const { error: deleteError } = await supabaseAdmin
                .from('disponibilidad_empleado')
                .delete()
                .eq('play_id', usu_id);

            if (deleteError) {
                console.error('Error eliminando disponibilidad:', deleteError);
                return NextResponse.json(
                    { error: "Error al actualizar disponibilidad" },
                    { status: 500 }
                );
            }

            // Insertar la nueva disponibilidad si hay alguna
            if (disponibilidad.length > 0) {
                const disponibilidadData = disponibilidad.map((disp: any) => ({
                    play_id: usu_id,
                    dia_semana: disp.dia_semana,
                    turno_id: disp.turno_id
                }));

                const { error: insertError } = await supabaseAdmin
                    .from('disponibilidad_empleado')
                    .insert(disponibilidadData);

                if (insertError) {
                    console.error('Error insertando disponibilidad:', insertError);
                    return NextResponse.json(
                        { error: "Error al actualizar disponibilidad" },
                        { status: 500 }
                    );
                }
            }
        }

        // Obtener el empleado actualizado (consulta simplificada)
        console.log('🔍 Obteniendo empleado actualizado para usu_id:', usu_id);

        // Primero verificar que existe la asignación
        const { data: asignacion, error: asignacionError } = await supabaseAdmin
            .from('empleados_estacionamiento')
            .select('*')
            .eq('play_id', usu_id)
            .single();

        if (asignacionError) {
            console.error('Error verificando asignación:', asignacionError);
            return NextResponse.json(
                { error: "Error al verificar asignación del empleado" },
                { status: 500 }
            );
        }

        console.log('✅ Asignación encontrada:', asignacion);

        // Obtener datos del usuario
        const { data: usuarioActualizado, error: usuarioError } = await supabaseAdmin
            .from('usuario')
            .select('*')
            .eq('usu_id', usu_id)
            .single();

        if (usuarioError) {
            console.error('Error obteniendo usuario actualizado:', usuarioError);
            return NextResponse.json(
                { error: "Error al obtener datos del usuario actualizado" },
                { status: 500 }
            );
        }

        console.log('✅ Usuario actualizado:', usuarioActualizado);

        // Obtener disponibilidad
        const { data: disponibilidadActualizada, error: disponibilidadError } = await supabaseAdmin
            .from('disponibilidad_empleado')
            .select(`
                dia_semana,
                turno_id,
                turnos_catalogo (
                    nombre_turno
                )
            `)
            .eq('play_id', usu_id);

        if (disponibilidadError) {
            console.error('Error obteniendo disponibilidad:', disponibilidadError);
        }

        console.log('✅ Disponibilidad obtenida:', disponibilidadActualizada?.length || 0, 'registros');

        // Construir respuesta simplificada
        const empleadoActualizado = {
            play_id: asignacion.play_id,
            activo: asignacion.activo,
            fecha_asignacion: asignacion.fecha_asignacion,
            playeros: {
                play_id: usuarioActualizado.usu_id,
                usuario: usuarioActualizado
            },
            disponibilidad_empleado: disponibilidadActualizada || []
        };

        console.log('✅ Empleado actualizado construido correctamente');

        return NextResponse.json({
            message: "Empleado actualizado exitosamente",
            empleado: empleadoActualizado
        });

    } catch (error) {
        console.error('Error en PUT /api/empleados:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// DELETE - Eliminar empleado
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createAuthenticatedSupabaseClient();

        const body = await request.json();
        const { usu_id } = body;

        if (!usu_id) {
            return NextResponse.json(
                { error: "El campo usu_id es requerido" },
                { status: 400 }
            );
        }

        // Verificar que el usuario existe y es un playero
        const { data: playero, error: checkError } = await supabaseAdmin
            .from('playeros')
            .select('play_id')
            .eq('play_id', usu_id)
            .single();

        if (checkError || !playero) {
            return NextResponse.json(
                { error: "Empleado no encontrado" },
                { status: 404 }
            );
        }

        // Eliminar las relaciones primero (debido a foreign keys sin CASCADE)
        console.log('🗑️ Eliminando relaciones del empleado con ID:', usu_id);

        // 1. Eliminar disponibilidad
        const { error: dispError } = await supabaseAdmin
            .from('disponibilidad_empleado')
            .delete()
            .eq('play_id', usu_id);

        if (dispError) {
            console.error('Error eliminando disponibilidad:', dispError);
        }

        // 2. Eliminar asignación de estacionamiento
        const { error: asignacionError } = await supabaseAdmin
            .from('empleados_estacionamiento')
            .delete()
            .eq('play_id', usu_id);

        if (asignacionError) {
            console.error('Error eliminando asignación:', asignacionError);
        }

        // 3. Eliminar registro de playero
        const { error: playeroError } = await supabaseAdmin
            .from('playeros')
            .delete()
            .eq('play_id', usu_id);

        if (playeroError) {
            console.error('Error eliminando playero:', playeroError);
        }

        // 4. Obtener el email del usuario antes de eliminarlo
        console.log('🔍 Obteniendo email del usuario...');
        const { data: usuarioData, error: getUserError } = await supabaseAdmin
            .from('usuario')
            .select('usu_email, usu_auth_id')
            .eq('usu_id', usu_id)
            .single();

        if (getUserError) {
            console.error('Error obteniendo datos del usuario:', getUserError);
        }

        // 5. Eliminar la cuenta de Supabase Auth si existe
        if (usuarioData?.usu_auth_id) {
            console.log('🗑️ Eliminando usuario de Supabase Auth...');
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(usuarioData.usu_auth_id);

            if (authDeleteError) {
                console.error('Error eliminando usuario de Auth:', authDeleteError);
                // No es crítico si falla, continuamos
            } else {
                console.log('✅ Usuario eliminado de Supabase Auth');
            }
        }

        // 6. Eliminar el registro de usuario de la tabla
        console.log('🗑️ Eliminando registro de usuario...');
        const { error: deleteError } = await supabaseAdmin
            .from('usuario')
            .delete()
            .eq('usu_id', usu_id);

        if (deleteError) {
            console.error('❌ Error eliminando empleado:', deleteError);
            console.error('   Código de error:', deleteError.code);
            console.error('   Detalles:', deleteError.details);
            console.error('   Mensaje:', deleteError.message);
            return NextResponse.json(
                { error: "Error al eliminar el empleado: " + deleteError.message },
                { status: 500 }
            );
        }

        console.log('✅ Empleado eliminado exitosamente');

        return NextResponse.json({
            message: "Empleado eliminado exitosamente"
        });

    } catch (error) {
        console.error('Error en DELETE /api/empleados:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
