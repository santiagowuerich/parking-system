/**
 * Helpers comunes para testing
 * Datos de prueba consistentes y utilidades
 */

// Datos de prueba estándar
export const testData = {
    empleado: {
        nombre: 'Juan',
        apellido: 'Pérez',
        dni: '12345678',
        email: 'juan@test.com',
        telefono: '+5491123456789'
    },

    vehiculo: {
        patente: 'ABC123',
        marca: 'Toyota',
        modelo: 'Corolla',
        color: 'Blanco',
        tipo: 'auto'
    },

    plaza: {
        numero: 1,
        tipo: 'auto',
        estado: 'libre',
        tarifa_hora: 50.00
    },

    estacionamiento: {
        nombre: 'Estacionamiento Centro',
        direccion: 'Av. Corrientes 1234, CABA',
        capacidad: 100,
        tarifa_base: 50.00
    },

    usuario: {
        email: 'admin@test.com',
        password: 'test123456',
        nombre: 'Admin',
        apellido: 'Test'
    }
};

// Configuraciones de pago de prueba
export const paymentConfigs = {
    efectivo: { enabled: true },
    transfer: {
        enabled: true,
        cbu: '0000000000000000000000',
        alias: 'test.parking'
    },
    mercadopago: {
        enabled: true,
        accessToken: 'TEST_TOKEN',
        publicKey: 'TEST_PUBLIC_KEY'
    }
};

// Utilidades para crear datos únicos de prueba
export function createUniqueTestData(baseData: any, suffix?: string) {
    const timestamp = suffix || Date.now().toString().slice(-6);
    const result = { ...baseData };

    // Modificar campos únicos
    if (result.email) result.email = result.email.replace('@', `_${timestamp}@`);
    if (result.patente) result.patente = result.patente + timestamp;
    if (result.dni) result.dni = result.dni + timestamp;
    if (result.nombre) result.nombre = `${result.nombre} ${timestamp}`;

    return result;
}

// Mock de API responses
export const mockApiResponses = {
    success: (data: any) => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data)
    }),

    error: (message: string, status = 400) => ({
        ok: false,
        status,
        json: () => Promise.resolve({ error: message })
    }),

    notFound: () => mockApiResponses.error('Not found', 404),

    unauthorized: () => mockApiResponses.error('Unauthorized', 401)
};

// Utilidad para esperar un tiempo determinado
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utilidad para crear wrapper de componente con providers necesarios
export function createTestWrapper() {
    // Esto se puede expandir con ThemeProvider, Router, etc.
    return ({ children }: { children: React.ReactNode }) => <>{ children } </>;
}

// Utilidad para mockear fetch
export function mockFetch(response: any) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(response)
        })
    );
}

// Utilidad para restaurar fetch
export function restoreFetch() {
    global.fetch = fetch;
}
