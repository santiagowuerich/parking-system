import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface Usuario {
  usu_id: number;
  usu_nom: string;
  usu_ape: string;
  usu_email: string;
  auth_user_id: string;
}

interface Dueno {
  due_id: number;
}

interface Playero {
  play_id: number;
}

interface EmpleadoEstacionamiento {
  play_id: number;
  est_id: number;
}

export async function GET(request: NextRequest) {
  try {
    // Verificar que tenemos acceso a supabaseAdmin
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Configuración de servidor incompleta" },
        { status: 500 }
      );
    }

    console.log('🔍 Iniciando diagnóstico de roles...');

    // 1. Obtener todos los usuarios de la tabla usuario
    const { data: usuarios, error: usuariosError } = await (supabaseAdmin as any)
      .from('usuario')
      .select('usu_id, usu_nom, usu_ape, usu_email, auth_user_id')
      .order('usu_id');

    if (usuariosError) {
      console.error('❌ Error obteniendo usuarios:', usuariosError);
      return NextResponse.json({ error: usuariosError.message }, { status: 500 });
    }

    // 2. Verificar roles de dueño
    const { data: duenos, error: duenosError } = await (supabaseAdmin as any)
      .from('dueno')
      .select('due_id')
      .order('due_id');

    if (duenosError) {
      console.error('❌ Error obteniendo dueños:', duenosError);
      return NextResponse.json({ error: duenosError.message }, { status: 500 });
    }

    // 3. Verificar roles de playero
    const { data: playeros, error: playerosError } = await (supabaseAdmin as any)
      .from('playeros')
      .select('play_id')
      .order('play_id');

    if (playerosError) {
      console.error('❌ Error obteniendo playeros:', playerosError);
      return NextResponse.json({ error: playerosError.message }, { status: 500 });
    }

    // 4. Verificar empleados_estacionamiento
    const { data: empleadosEst, error: empleadosEstError } = await (supabaseAdmin as any)
      .from('empleados_estacionamiento')
      .select('play_id, est_id')
      .order('play_id');

    if (empleadosEstError) {
      console.error('❌ Error obteniendo empleados_estacionamiento:', empleadosEstError);
      return NextResponse.json({ error: empleadosEstError.message }, { status: 500 });
    }

    // 5. Análisis de conflictos
    const conflictos: Array<{ usuario: Usuario; problema: string }> = [];
    const usuariosConRoles = (usuarios as Usuario[]).map((user: Usuario) => {
      const esDueno = (duenos as Dueno[])?.some((d: Dueno) => d.due_id === user.usu_id);
      const esPlayero = (playeros as Playero[])?.some((p: Playero) => p.play_id === user.usu_id);
      const empleadoEst = (empleadosEst as EmpleadoEstacionamiento[])?.find((e: EmpleadoEstacionamiento) => e.play_id === user.usu_id);
      
      let rol = 'conductor'; // Por defecto
      let problema = null;
      
      if (esDueno && esPlayero) {
        rol = 'conflicto';
        problema = 'Es tanto dueño como playero';
        conflictos.push({ usuario: user, problema });
      } else if (esDueno) {
        rol = 'owner';
      } else if (esPlayero) {
        rol = 'playero';
      } else {
        problema = 'No tiene rol asignado (será conductor por defecto)';
        conflictos.push({ usuario: user, problema });
      }

      return {
        ...user,
        rol,
        esDueno,
        esPlayero,
        empleadoEst,
        problema
      };
    });

    const diagnostico = {
      resumen: {
        totalUsuarios: usuarios.length,
        totalDuenos: duenos.length,
        totalPlayeros: playeros.length,
        totalAsignaciones: empleadosEst.length,
        totalConflictos: conflictos.length
      },
      usuarios: usuariosConRoles,
      conflictos,
      recomendaciones: conflictos.length > 0 ? [
        'Revisar usuarios con conflictos de roles',
        'Decidir qué rol debe tener cada usuario',
        'Limpiar roles duplicados si es necesario'
      ] : ['✅ No se encontraron conflictos']
    };

    console.log('✅ Diagnóstico completado');
    return NextResponse.json(diagnostico);

  } catch (error: any) {
    console.error('❌ Error durante el diagnóstico:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
