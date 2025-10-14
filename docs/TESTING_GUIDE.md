# 🧪 Guía de Testing - Sistema de Estacionamiento

## 📋 Resumen Ejecutivo

Esta guía establece las mejores prácticas para implementar testing en el Sistema de Estacionamiento, combinando el enfoque actual de tests de integración con prácticas modernas de testing unitario y E2E.

## 🎯 Estrategia de Testing Actual vs Recomendada

### ✅ **Enfoque Actual** (Tests de Integración)
```javascript
// tests/test-api-empleados.js
async function testEmpleadosAPI() {
  const response = await fetch('/api/empleados');
  const data = await response.json();
  // Verificaciones manuales...
}
```

**Ventajas:**
- ✅ Tests reales end-to-end
- ✅ Verifica integración completa
- ✅ Fácil de entender y mantener
- ✅ Ejecutable sin dependencias complejas

**Limitaciones:**
- ❌ Lentos de ejecutar
- ❌ Difíciles de debuggear
- ❌ No prueban lógica específica
- ❌ Dependientes de estado externo

### 🚀 **Enfoque Recomendado** (Pirámide de Testing)

```
E2E Tests (3-5 tests críticos)
    ↕️
Integration Tests (tests actuales mejorados)
    ↕️
Unit Tests (70-80% de cobertura)
```

## 🛠️ Implementación Paso a Paso

### **Paso 1: Configurar Framework de Testing**

```bash
# Instalar dependencias
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @playwright/test

# Instalar Playwright browsers
npx playwright install
```

### **Paso 2: Ejecutar Tests Unitarios**

```bash
# Tests unitarios
npm run test

# Con UI visual
npm run test:ui

# Con cobertura
npm run test:coverage
```

### **Paso 3: Ejecutar Tests de Integración**

```bash
# Tests de integración mejorados
node scripts/run-integration-tests.js

# Tests individuales
npm run test:api
npm run test:integration
```

### **Paso 4: Tests E2E (Futuro)**

```bash
# Instalar Playwright
npm install --save-dev @playwright/test
npx playwright install

# Ejecutar tests E2E
npx playwright test
```

## 📊 Métricas y Objetivos

### **Cobertura por Tipo**
- **Unit Tests**: 70-80% cobertura de funciones utilitarias
- **Integration Tests**: 60-70% de flujos críticos
- **E2E Tests**: 30-40% de user journeys principales

### **Velocidad de Ejecución**
- **Unit**: < 100ms por test
- **Integration**: < 2s por test
- **E2E**: < 30s por test

### **Tasa de Éxito**
- **CI/CD**: > 95% tests pasando
- **Pre-commit**: > 90% tests pasando
- **Desarrollo**: > 80% tests pasando

## 🎯 Flujos Críticos a Testear

### **Prioridad 1** (Deben tener tests)
1. ✅ **Autenticación** - Login/logout de usuarios
2. ✅ **Gestión de Empleados** - CRUD completo
3. ✅ **Configuración de Plazas** - Crear/editar zonas
4. ✅ **Flujo de Parking** - Ingreso/egreso de vehículos
5. ✅ **Sistema de Pagos** - Configuración y procesamiento

### **Prioridad 2** (Importante)
6. 🔄 **Dashboard** - Visualización y métricas
7. 🔄 **Reportes** - Generación de informes
8. 🔄 **Configuración Global** - Tarifas, horarios
9. 🔄 **Gestión de Usuarios** - Roles y permisos

### **Prioridad 3** (Nice to have)
10. 🎨 **UI/UX** - Componentes y navegación
11. 🌐 **APIs Externas** - Google Maps, MercadoPago
12. 📱 **Responsive** - Diferentes dispositivos

## 📝 Patrones de Testing

### **Test Unitario Efectivo**
```typescript
// tests/unit/utils/payment-utils.test.ts
describe('getAvailablePaymentMethods', () => {
  test('returns only enabled methods', () => {
    const settings = { efectivo: { enabled: true }, transfer: { enabled: false } };
    const result = getAvailablePaymentMethods(settings);

    expect(result).toEqual([{ id: 'efectivo', ... }]);
  });
});
```

### **Test de Integración Mejorado**
```javascript
// tests/integration/employee-management.test.js
async function testEmployeeLifecycle() {
  const testEmployee = createTestEmployee();

  // 1. Crear empleado
  const created = await api.createEmployee(testEmployee);
  expect(created.id).toBeDefined();

  // 2. Verificar en lista
  const list = await api.getEmployees();
  expect(list.some(e => e.id === created.id)).toBe(true);

  // 3. Actualizar
  const updated = await api.updateEmployee(created.id, { nombre: 'Updated' });
  expect(updated.nombre).toBe('Updated');

  // 4. Eliminar
  await api.deleteEmployee(created.id);
  const finalList = await api.getEmployees();
  expect(finalList.some(e => e.id === created.id)).toBe(false);
}
```

### **Test E2E Completo**
```typescript
// tests/e2e/parking-flow.spec.ts
test('complete parking session', async ({ page }) => {
  await page.goto('/dashboard');

  // Registrar entrada
  await page.click('text=Ingreso');
  await page.fill('[data-testid=license-plate]', 'ABC123');
  await page.click('text=Confirmar');

  // Verificar registro
  await expect(page.locator('text=ABC123')).toBeVisible();

  // Registrar salida
  await page.click('[data-testid=btn-egreso]');
  await page.click('text=Confirmar Pago');

  // Verificar finalización
  await expect(page.locator('text=ABC123')).not.toBeVisible();
});
```

## 🔧 Configuración de CI/CD

### **GitHub Actions**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:run

      - name: Start server
        run: npm run build && npm run start &

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npx playwright test
```

### **Scripts de Calidad**
```json
{
  "scripts": {
    "quality": "npm run lint && npm run test:run && npm run test:coverage",
    "pre-commit": "npm run quality",
    "pre-push": "npm run test:all"
  }
}
```

## 📈 Monitoreo y Métricas

### **Comandos Útiles**
```bash
# Cobertura detallada
npm run test:coverage

# Tests con watch mode
npm run test -- --watch

# Tests específicos
npm run test payment-utils.test.ts

# Tests por patrón
npm run test -- --grep "payment"
```

### **Reportes de Cobertura**
```javascript
// vitest.config.ts
export default {
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'tests']
    }
  }
}
```

## 🚨 Manejo de Errores y Edge Cases

### **Casos a Considerar**
- **Redes lentas** - Timeouts y reintentos
- **Datos corruptos** - Validación de entrada
- **Estado inconsistente** - Cleanup entre tests
- **APIs externas fallidas** - Mocks y fallbacks
- **Permisos insuficientes** - Tests de autorización

### **Patrón de Test Robusto**
```javascript
async function testWithRetry(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await wait(1000 * (i + 1)); // Backoff exponencial
    }
  }
}
```

## 🎯 Checklist de Implementación

### **Semana 1: Configuración Base**
- [ ] Instalar Vitest y Testing Library
- [ ] Configurar `vitest.config.ts`
- [ ] Crear `tests/setup.ts`
- [ ] Crear helpers de test
- [ ] Primer test unitario

### **Semana 2: Tests Unitarios**
- [ ] Testear utilidades de pago
- [ ] Testear utilidades de empleados
- [ ] Testear validaciones
- [ ] Cobertura > 70%

### **Semana 3: Mejorar Tests de Integración**
- [ ] Estandarizar tests existentes
- [ ] Agregar cleanup automático
- [ ] Mejorar manejo de errores
- [ ] Crear script de ejecución masiva

### **Semana 4: Tests E2E**
- [ ] Instalar Playwright
- [ ] Tests críticos de parking
- [ ] Tests de administración
- [ ] Configurar CI/CD

## 💡 Tips y Mejores Prácticas

### **Escribir Tests Mantenibles**
1. **Nombres descriptivos**: `test('calculates total with discount')`
2. **Un concepto por test**: No probar múltiples cosas
3. **Datos de test consistentes**: Usar factories o helpers
4. **Cleanup automático**: Después de cada test
5. **Mocks apropiados**: Solo lo necesario

### **Debugging Efectivo**
```javascript
// Agregar logs temporales
console.log('🔍 Debug:', { variable, estado });

// Usar debugger
test.only('debug specific test', () => {
  debugger;
  // código
});
```

### **Performance**
- **Paralelización**: Vitest ejecuta tests en paralelo
- **Caching**: Reutilizar setup costoso
- **Selectivos**: `npm run test -- --grep "fast"`
- **Mocks**: Para dependencias lentas

## 📚 Recursos Adicionales

- [Vitest Docs](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Docs](https://playwright.dev/)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy)

---

## 🎉 Conclusión

Implementar testing moderno en el Sistema de Estacionamiento mejorará significativamente la calidad, mantenibilidad y confiabilidad del código. Comenzar con tests unitarios de utilidades críticas y gradualmente expandir a tests de integración y E2E creará una base sólida para el desarrollo futuro.

**Recuerda**: Los tests son una inversión que se paga con intereses en forma de bugs evitados y confianza en los despliegues.
