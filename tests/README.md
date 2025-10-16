# tests/

**Rol / propósito:** Scripts de testing automatizados para validar la funcionalidad del sistema de estacionamiento, incluyendo pruebas de API, UI, integración y casos específicos de negocio.

## Contenido clave
- `test-api-*.js` - Pruebas de endpoints de API (empleados, plazas, tarifas)
- `test-dashboard-*.js` - Pruebas de integración del panel principal
- `test-empleado-*.js` - Pruebas específicas de gestión de empleados
- `test-plazas-*.js` - Pruebas de configuración y visualización de plazas
- `test-tarifas-*.js` - Pruebas de configuración de tarifas
- `test-google-maps.js` - Pruebas de integración con Google Maps
- `test-*.ps1` - Scripts de testing en PowerShell

## Estructura

```
tests/
├── test-api-empleados.js           # API empleados
├── test-api-plazas.js              # API plazas
├── test-dashboard-integration.js   # Integración dashboard
├── test-empleado-*.js              # Gestión empleados (8+ archivos)
├── test-plazas-*.js                # Configuración plazas (6+ archivos)
├── test-tarifas-*.js               # Sistema tarifas
├── test-google-maps.js             # Integración Google Maps
├── test-*.ps1                      # Scripts PowerShell
└── ...                            # 40+ scripts específicos
```

## Entradas/Salidas

- **Entradas**: URLs de API locales, datos de prueba, configuraciones
- **Salidas**: Resultados de pruebas (✅/❌), logs detallados, datos de respuesta

## Cómo se usa desde afuera

```bash
# Ejecutar prueba específica
node tests/test-api-empleados.js

# Ejecutar pruebas de empleados
node tests/test-dashboard-empleados.js

# Ejecutar desde PowerShell
.\tests\test-flujo-empleados.ps1

# Ejecutar múltiples pruebas
for file in tests/test-*.js; do node "$file"; done
```

## Dependencias y contratos

- **Depende de**: Servidor Next.js corriendo en localhost:3000, base de datos Supabase
- **Expone**: Estado de funcionalidad, errores encontrados, métricas de pruebas

## Puntos de extensión / modificar con seguridad

- Añadir nueva prueba: crear `test-*.js` siguiendo patrón de nomenclatura
- Probar nueva funcionalidad: crear script específico para feature
- Actualizar pruebas existentes: modificar cuando cambie la API o lógica

## 🏆 Mejores Prácticas de Testing

### 📋 **Tipos de Tests**

#### **1. Tests Unitarios** (Recomendado añadir)
```bash
# Instalar Jest o Vitest
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Crear test unitario
# tests/unit/utils/payment-utils.test.js
import { getAvailablePaymentMethods } from '@/lib/utils/payment-utils';

describe('getAvailablePaymentMethods', () => {
  test('returns only enabled methods', () => {
    const config = {
      efectivo: { enabled: true },
      transfer: { enabled: false }
    };
    expect(getAvailablePaymentMethods(config)).toEqual(['efectivo']);
  });
});
```

#### **2. Tests de Integración** (Actual enfoque)
```javascript
// tests/test-api-integration.js
async function testCompleteFlow() {
  console.log('🔄 Probando flujo completo...');

  // 1. Crear empleado
  const empleado = await createEmpleado(testData);
  expect(empleado.id).toBeDefined();

  // 2. Crear plaza
  const plaza = await createPlaza(empleado.est_id);
  expect(plaza.estado).toBe('libre');

  // 3. Simular ingreso
  const ingreso = await registrarIngreso(plaza.id, testVehicle);
  expect(ingreso.success).toBe(true);
}
```

#### **3. Tests E2E** (Futuro - recomendado)
```bash
# Instalar Playwright
npm install --save-dev @playwright/test

# tests/e2e/parking-flow.spec.js
import { test, expect } from '@playwright/test';

test('complete parking flow', async ({ page }) => {
  await page.goto('/dashboard');

  // Simular flujo completo de estacionamiento
  await page.click('text=Ingreso');
  await page.fill('[data-testid=license-plate]', 'ABC123');
  await page.click('text=Confirmar');

  await expect(page.locator('text=ABC123')).toBeVisible();
});
```

### 🎯 **Patrones Recomendados**

#### **Estructura de Test**
```javascript
// ✅ BUENA PRÁCTICA
async function testNombreDescriptivo() {
    console.log('🎯 Probando: [descripción clara]\n');

    try {
        // 1. Preparar datos de prueba
        const testData = createTestData();

        // 2. Ejecutar acción
        const result = await performAction(testData);

        // 3. Verificar resultado
        assertResult(result);

        // 4. Limpiar (si es necesario)
        await cleanup(testData);

        console.log('✅ Test exitoso');

    } catch (error) {
        console.log('❌ Test fallido:', error.message);
        throw error;
    }
}
```

#### **Nombres de Archivos**
```
✅ BUENO:
test-api-empleados.js
test-dashboard-integration.js
test-pagos-mercadopago.js
test-zonas-configuracion.js

❌ EVITAR:
test.js
test1.js
prueba-empleados.js
```

#### **Configuración de Test Data**
```javascript
// tests/test-helpers.js
export const testData = {
  empleado: {
    nombre: 'Juan',
    apellido: 'Pérez',
    dni: '12345678',
    email: 'juan@test.com'
  },
  vehiculo: {
    patente: 'ABC123',
    marca: 'Toyota',
    modelo: 'Corolla'
  },
  plaza: {
    numero: 1,
    tipo: 'auto',
    estado: 'libre'
  }
};

export function createTestParking() {
  return {
    nombre: `Test Parking ${Date.now()}`,
    direccion: 'Test Address 123',
    capacidad: 50
  };
}
```

### 🚀 **Comandos Recomendados**

#### **Ejecutar Tests**
```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:api": "node tests/test-api-empleados.js",
    "test:integration": "node tests/test-dashboard-integration.js",
    "test:e2e": "playwright test",
    "test:all": "npm run test:api && npm run test:integration && npm run test:e2e"
  }
}
```

#### **Test Suite Completo**
```bash
# Ejecutar todos los tests API
for file in tests/test-api-*.js; do
  echo "🔄 Ejecutando $file..."
  node "$file" || exit 1
done

# Ejecutar tests de integración
node tests/test-dashboard-integration.js

# Ejecutar tests E2E (futuro)
npm run test:e2e
```

### 📊 **Métricas de Testing**

#### **Cobertura Recomendada**
- **Unit Tests**: 70-80% cobertura
- **Integration Tests**: 60-70% flujos críticos
- **E2E Tests**: 30-40% user journeys principales

#### **Velocidad de Tests**
- **Unit**: < 100ms por test
- **Integration**: < 2s por test
- **E2E**: < 30s por test

### 🔧 **Herramientas Recomendadas**

#### **Para Tests Unitarios**
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

#### **Para Tests E2E**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

#### **Para API Testing**
```bash
npm install --save-dev supertest
```

### 📈 **Estrategia de Testing**

#### **Pirámide de Testing**
```
E2E Tests (pocos)
    ↕️
Integration Tests (medianos)
    ↕️
Unit Tests (muchos)
```

#### **Flujos Críticos a Testear**
1. ✅ **Registro/Login** de usuarios
2. ✅ **Gestión de Empleados** (CRUD)
3. ✅ **Configuración de Plazas** y zonas
4. ✅ **Flujo de Parking** (ingreso/egreso)
5. ✅ **Sistema de Pagos**
6. ✅ **Dashboard y Reportes**

### 🎉 **Implementación Paso a Paso**

#### **Paso 1: Configurar Framework**
```bash
npm install --save-dev vitest @testing-library/react
```

#### **Paso 2: Crear Helpers**
```javascript
// tests/setup.js
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

#### **Paso 3: Primer Test Unitario**
```javascript
// tests/unit/utils/payment-utils.test.js
import { getAvailablePaymentMethods } from '@/lib/utils/payment-utils';

describe('Payment Utils', () => {
  describe('getAvailablePaymentMethods', () => {
    test('returns only enabled methods', () => {
      const config = {
        efectivo: { enabled: true },
        transfer: { enabled: false }
      };

      const result = getAvailablePaymentMethods(config);

      expect(result).toEqual(['efectivo']);
    });
  });
});
```

## Convenciones / notas

- Scripts en español con emojis para claridad
- Nombres descriptivos: `test-{funcionalidad}-{aspecto}.js`
- Tests independientes que pueden ejecutarse por separado
- Logging detallado con códigos de estado HTTP
- Manejo de errores y casos edge
- Scripts .ps1 para automatización en Windows
- Usar datos de prueba consistentes
- Limpiar estado después de cada test
- Documentar casos edge y errores esperados