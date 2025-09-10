import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from "@/lib/supabase";

// Verificar que supabaseAdmin esté disponible
if (!supabaseAdmin) {
  console.error('❌ supabaseAdmin no está disponible. Verificar configuración de SUPABASE_SERVICE_ROLE_KEY');
}

export async function GET(request: NextRequest) {
  try {
    // Crear cliente de Supabase para verificar la sesión del usuario
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // No necesitamos set en este contexto
          },
          remove(name: string, options: any) {
            // No necesitamos remove en este contexto
          },
        },
      }
    )

    // Obtener el usuario autenticado desde la sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Usuario no autenticado" },
        { status: 401 }
      );
    }

    // Verificar que tenemos acceso a supabaseAdmin
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    // Determinar el rol del usuario
    const { data: usuarioData, error: usuarioError } = await (supabaseAdmin as any)
      .from('usuario')
      .select('usu_id')
      .eq('auth_user_id', user.id)
      .single();

    if (usuarioError || !usuarioData) {
      console.log('Usuario no encontrado en BD:', usuarioError);
      return NextResponse.json({
        role: 'unknown',
        isOwner: false,
        isPlayero: false,
        isConductor: false,
        isUnknown: true
      });
    }

    const usuId = usuarioData.usu_id;

    // Verificar si es dueño (prioridad más alta)
    const { data: duenoData, error: duenoError } = await (supabaseAdmin as any)
      .from('dueno')
      .select('due_id')
      .eq('due_id', usuId)
      .single();

    if (duenoData && !duenoError) {
      console.log('API: Usuario es DUEÑO');
      return NextResponse.json({
        role: 'owner',
        isOwner: true,
        isPlayero: false,
        isConductor: false,
        isUnknown: false
      });
    }

    // Verificar si es playero
    const { data: playeroData, error: playeroError } = await (supabaseAdmin as any)
      .from('playeros')
      .select('play_id')
      .eq('play_id', usuId)
      .single();

    if (playeroData && !playeroError) {
      console.log('API: Usuario es PLAYERO');
      return NextResponse.json({
        role: 'playero',
        isOwner: false,
        isPlayero: true,
        isConductor: false,
        isUnknown: false
      });
    }

    // Si no tiene rol específico, es conductor
    console.log('API: Usuario es CONDUCTOR (por defecto)');
    return NextResponse.json({
      role: 'conductor',
      isOwner: false,
      isPlayero: false,
      isConductor: true,
      isUnknown: false
    });

  } catch (error: any) {
    console.error('Error en API get-role:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Error interno del servidor',
        role: 'unknown',
        isOwner: false,
        isPlayero: false,
        isConductor: false,
        isUnknown: true
      },
      { status: 500 }
    );
  }
}
