import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from './lib/supabase'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Validar variables de entorno para middleware
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variables de entorno de Supabase faltantes en middleware');
    // En lugar de tirar error, continuar sin autenticación
    return NextResponse.next();
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            expires: new Date(0),
          })
        },
      },
    }
  )

  // Obtener el usuario autenticado (más seguro que getSession)
  const { data: { user } } = await supabase.auth.getUser();

  // Obtener la URL actual
  const url = request.nextUrl.clone();

  // Rutas públicas que no requieren autenticación
  const publicPaths = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];
  const isPublicPath = publicPaths.some(path => url.pathname.startsWith(path));

  // Si no hay usuario autenticado y está intentando acceder a rutas protegidas
  if (!user && !isPublicPath) {
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Si hay usuario autenticado y está en páginas de login/register
  if (user && url.pathname.startsWith('/auth') && !url.pathname.includes('/reset-password')) {
    // Determinar el rol del usuario para redirigir apropiadamente
    try {
      // Verificar que supabaseAdmin esté disponible
      if (!supabaseAdmin) {
        console.error('❌ supabaseAdmin no disponible en middleware');
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }

      // Buscar usuario en tabla usuario
      const { data: usuarioData } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('auth_user_id', user.id)
        .single();

      if (usuarioData) {
        const usuId = usuarioData.usu_id;

        // Verificar si es dueño
        const { data: duenoData } = await supabaseAdmin
          .from('dueno')
          .select('due_id')
          .eq('due_id', usuId)
          .single();

        if (duenoData) {
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }

        // Verificar si es playero
        const { data: playeroData } = await supabaseAdmin
          .from('playeros')
          .select('play_id')
          .eq('play_id', usuId)
          .single();

        if (playeroData) {
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }

        // Si es conductor o no tiene rol específico, ir al dashboard general
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      } else {
        // Usuario no encontrado en BD, redirigir a login
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error('Error determinando rol en middleware:', error);
      // En caso de error, redirigir al dashboard general
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Protección de rutas por rol
  if (user && !isPublicPath) {
    try {
      // Verificar que supabaseAdmin esté disponible
      if (!supabaseAdmin) {
        console.error('❌ supabaseAdmin no disponible en middleware para protección de rutas');
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }

      // Determinar rol del usuario
      const { data: usuarioData } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('auth_user_id', user.id)
        .single();

      if (usuarioData) {
        const usuId = usuarioData.usu_id;
        let userRole = 'unknown';

        // Determinar rol
        const { data: duenoData } = await supabaseAdmin
          .from('dueno')
          .select('due_id')
          .eq('due_id', usuId)
          .single();

        if (duenoData) {
          userRole = 'owner';
        } else {
          const { data: playeroData } = await supabaseAdmin
            .from('playeros')
            .select('play_id')
            .eq('play_id', usuId)
            .single();

          if (playeroData) {
            userRole = 'playero';
          } else {
            userRole = 'conductor';
          }
        }

        // Proteger rutas específicas para owners
        const ownerOnlyPaths = [
          '/dashboard/empleados',
          '/dashboard/tarifas',
          '/dashboard/configuracion-zona',
          '/dashboard/plazas/configuracion-avanzada',
          '/dashboard/plantillas',
          '/dashboard/payments'
        ];

        const isOwnerOnlyPath = ownerOnlyPaths.some(path =>
          url.pathname === path || url.pathname.startsWith(path + '/')
        );

        if (isOwnerOnlyPath && userRole !== 'owner') {
          console.log(`🚫 Usuario con rol '${userRole}' intentando acceder a ruta de owner: ${url.pathname}`);
          url.pathname = '/dashboard';
          return NextResponse.redirect(url);
        }
      }
    } catch (error) {
      console.error('Error verificando permisos en middleware:', error);
      // En caso de error, permitir continuar para no bloquear al usuario
    }
  }

  // Si no se cumple ninguna condición de redirección, continuar
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Rutas explícitas
    '/',
    '/auth/:path*', // Actualizar matcher para cubrir subrutas de /auth
  ],
} 