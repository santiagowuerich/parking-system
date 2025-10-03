import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from './lib/supabase'
import { logger, createTimer } from './lib/logger'

export async function middleware(request: NextRequest) {
  const timer = createTimer('Middleware execution');

  // Obtener la URL actual ANTES de cualquier procesamiento
  const url = request.nextUrl.clone();

  // Rutas públicas que no requieren autenticación - verificar PRIMERO
  const publicPaths = [
    '/', // Página principal (landing page)
    '/register-selection', // Página de selección de tipo de registro
    '/auth/login',
    '/auth/register',
    '/auth/register-conductor', // Nueva página de registro para conductores
    '/auth/forgot-password',
    '/auth/reset-password'
  ];
  const isPublicPath = publicPaths.some(path => url.pathname.startsWith(path));

  // Si es una ruta pública, continuar inmediatamente sin autenticación
  if (isPublicPath) {
    timer.end();
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Validar variables de entorno para middleware
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    timer.end();
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

  // Si no hay usuario autenticado y está intentando acceder a rutas protegidas
  if (!user) {
    url.pathname = '/auth/login';
    timer.end();
    return NextResponse.redirect(url);
  }

  // Función auxiliar para obtener el rol del usuario (evita duplicación)
  const getUserRole = async () => {
    // Primero intentar obtener el rol desde la cookie
    const roleCookie = request.cookies.get('user_role');
    if (roleCookie) {
      try {
        const { role, timestamp } = JSON.parse(roleCookie.value);
        // Si el cache tiene menos de 5 minutos, usarlo
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return role;
        }
      } catch (e) {
        // Si hay error parseando, continuar con query a BD
      }
    }

    if (!supabaseAdmin) return null;

    const { data: userWithRole } = await supabaseAdmin
      .from('usuario')
      .select(`
        usu_id,
        dueno!left(due_id),
        playeros!left(play_id),
        conductores!left(con_id)
      `)
      .eq('auth_user_id', user.id)
      .single();

    if (!userWithRole) return null;

    const hasOwnerRel = Array.isArray(userWithRole.dueno)
      ? userWithRole.dueno.length > 0
      : Boolean(userWithRole.dueno);
    const hasPlayeroRel = Array.isArray(userWithRole.playeros)
      ? userWithRole.playeros.length > 0
      : Boolean(userWithRole.playeros);
    const hasConductorRel = Array.isArray(userWithRole.conductores)
      ? userWithRole.conductores.length > 0
      : Boolean(userWithRole.conductores);

    let role = 'unknown';
    if (hasOwnerRel) role = 'owner';
    else if (hasPlayeroRel) role = 'playero';
    else if (hasConductorRel) role = 'conductor';

    // Guardar el rol en cookie para futuras requests
    response.cookies.set('user_role', JSON.stringify({
      role,
      timestamp: Date.now()
    }), {
      httpOnly: false, // Permitir acceso desde JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 // 5 minutos
    });

    return role;
  };

  // Si hay usuario autenticado y está en páginas de login/register
  if (user && url.pathname.startsWith('/auth') && !url.pathname.includes('/reset-password')) {
    // Determinar el rol del usuario para redirigir apropiadamente
    try {
      const userRole = await getUserRole();

      if (!userRole) {
        url.pathname = '/auth/login';
        timer.end();
        return NextResponse.redirect(url);
      }

      if (userRole === 'owner') {
        url.pathname = '/dashboard';
      } else if (userRole === 'playero') {
        url.pathname = '/dashboard/operador-simple';
      } else if (userRole === 'conductor') {
        url.pathname = '/conductor';
      } else {
        url.pathname = '/dashboard';
      }

      timer.end();
      return NextResponse.redirect(url);
    } catch (error) {
      // En caso de error, redirigir al dashboard general
      url.pathname = '/dashboard';
      timer.end();
      return NextResponse.redirect(url);
    }
  }

  // Protección de rutas por rol
  if (user && !isPublicPath) {
    try {
      const userRole = await getUserRole();

      // Proteger rutas específicas para owners
      const ownerOnlyPaths = [
        '/dashboard/empleados',
        '/dashboard/tarifas',
        '/dashboard/configuracion-zona',
        '/dashboard/plazas/configuracion-avanzada',
        '/dashboard/plantillas',
        '/dashboard/payments'
      ];

      // Proteger todas las rutas del dashboard para conductores (excepto /account)
      const dashboardPaths = [
        '/dashboard'
      ];

      const isOwnerOnlyPath = ownerOnlyPaths.some(path =>
        url.pathname === path || url.pathname.startsWith(path + '/')
      );

      const isDashboardPath = dashboardPaths.some(path =>
        url.pathname === path || url.pathname.startsWith(path + '/')
      );

      // Los conductores no pueden acceder a rutas del dashboard
      if (isDashboardPath && userRole === 'conductor') {
        url.pathname = '/conductor';
        timer.end();
        return NextResponse.redirect(url);
      }

      // Owners y empleados no pueden acceder a /conductor
      if (url.pathname.startsWith('/conductor') && (userRole === 'owner' || userRole === 'playero')) {
        url.pathname = userRole === 'owner' ? '/dashboard' : '/dashboard/operador-simple';
        timer.end();
        return NextResponse.redirect(url);
      }

      // Redirigir empleados al panel de operador si acceden al dashboard principal
      if (url.pathname === '/dashboard' && userRole === 'playero') {
        url.pathname = '/dashboard/operador-simple';
        timer.end();
        return NextResponse.redirect(url);
      }

      // Bloquear rutas de owner para empleados
      if (isOwnerOnlyPath && userRole !== 'owner') {
        // Redirigir empleados al panel de operador, usuarios sin rol definido quedan en dashboard
        url.pathname = userRole === 'playero' ? '/dashboard/operador-simple' : '/dashboard';
        timer.end();
        return NextResponse.redirect(url);
      }
    } catch (error) {
      // En caso de error, permitir continuar para no bloquear al usuario
    }
  }

  // Si no se cumple ninguna condición de redirección, continuar
  timer.end();
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Rutas explícitas
    '/',
    '/auth/:path*', // Actualizar matcher para cubrir subrutas de /auth
  ],
} 