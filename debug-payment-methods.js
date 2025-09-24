// debug-payment-methods.js
// Script para probar la lógica de métodos de pago

const { getAvailablePaymentMethods } = require('./lib/utils/payment-utils.ts');

// Simular configuración real como la que se cargaría en operador-simple
const testSettings = {
    efectivo: { enabled: true },
    transfer: {
        enabled: true,
        cbu: 'saanti2384',
        alias: 'juan.santiago'
    },
    mercadopago: {
        enabled: true,
        accessToken: 'TEST-8105448618313453-040716-cafe27fb4572c06e329c92dc262ac934-201463249',
        publicKey: '' // No tenemos publicKey
    }
};

console.log('🔧 Configuración de prueba:', testSettings);
console.log('📱 Métodos disponibles:', getAvailablePaymentMethods(testSettings));
