import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { ConnectionProvider, ConnectionStatus } from '@/lib/connection-context';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Sistema de Estacionamiento',
  description: 'Sistema para la gestión de estacionamientos',
  generator: 'v0.dev',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConnectionProvider>
            <AuthProvider>
              {children}
              <ConnectionStatus />
              <Toaster />
            </AuthProvider>
          </ConnectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
