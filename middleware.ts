import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Obtener la sesión del usuario
  const { data: { session } } = await supabase.auth.getSession();

  // Obtener la URL actual
  const url = request.nextUrl.clone();

  // Si no hay sesión y el usuario intenta acceder a la ruta raíz ('/')
  if (!session && url.pathname === '/') {
    // Redirigir a la página de autenticación ESPECÍFICA
    url.pathname = '/auth/login'; // <-- Cambiar '/auth' por '/auth/login'
    console.log('Middleware: No session, redirecting to /auth/login'); // Actualizar log
    return NextResponse.redirect(url);
  }

  // Si hay sesión y el usuario está en una página de autenticación
  // (Podríamos hacer esto más específico si hay varias páginas dentro de /auth)
  if (session && url.pathname.startsWith('/auth')) { // Usar startsWith para cubrir /auth/login, /auth/register, etc.
    // Redirigir a la página principal
    url.pathname = '/';
    console.log('Middleware: Session found, redirecting from /auth page to /');
    return NextResponse.redirect(url);
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