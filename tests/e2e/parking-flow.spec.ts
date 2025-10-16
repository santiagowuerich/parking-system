import { test, expect } from '@playwright/test'

test.describe('Parking Flow E2E', () => {
    test('complete parking session from entry to exit', async ({ page }) => {
        // Navegar al dashboard
        await page.goto('/dashboard')

        // Verificar que estamos en el dashboard
        await expect(page).toHaveTitle(/Sistema de Estacionamiento/)

        // Hacer clic en "Ingreso" para registrar entrada
        await page.click('text=Ingreso')

        // Esperar modal de ingreso
        await page.waitForSelector('[data-testid=modal-ingreso]', { timeout: 5000 })

        // Llenar datos del vehículo
        await page.fill('[data-testid=license-plate]', 'ABC123')
        await page.selectOption('[data-testid=vehicle-type]', 'auto')

        // Confirmar ingreso
        await page.click('text=Confirmar')

        // Verificar que el vehículo aparece en la lista
        await expect(page.locator('text=ABC123')).toBeVisible()

        // Esperar un momento simulado
        await page.waitForTimeout(2000)

        // Hacer clic en "Egreso" para registrar salida
        await page.click(`[data-testid=vehicle-row-ABC123] [data-testid=btn-egreso]`)

        // Esperar modal de egreso
        await page.waitForSelector('[data-testid=modal-egreso]')

        // Verificar cálculo de tarifa
        await expect(page.locator('[data-testid=total-amount]')).toBeVisible()

        // Confirmar egreso
        await page.click('text=Confirmar Pago')

        // Verificar que el vehículo ya no está en la lista
        await expect(page.locator('text=ABC123')).not.toBeVisible()

        // Verificar mensaje de éxito
        await expect(page.locator('text=✅ Egreso registrado')).toBeVisible()
    })

    test('employee management flow', async ({ page }) => {
        // Login como administrador
        await page.goto('/auth/login')
        await page.fill('[data-testid=email]', 'admin@test.com')
        await page.fill('[data-testid=password]', 'test123456')
        await page.click('text=Iniciar Sesión')

        // Navegar a gestión de empleados
        await page.click('text=Gestionar Empleados')

        // Verificar lista de empleados
        await expect(page.locator('[data-testid=empleados-list]')).toBeVisible()

        // Crear nuevo empleado
        await page.click('text=Agregar Empleado')
        await page.fill('[data-testid=nombre]', 'María González')
        await page.fill('[data-testid=dni]', '87654321')
        await page.fill('[data-testid=email]', 'maria@test.com')
        await page.click('text=Guardar')

        // Verificar que el empleado aparece en la lista
        await expect(page.locator('text=María González')).toBeVisible()
    })

    test('payment configuration', async ({ page }) => {
        // Login como administrador
        await page.goto('/auth/login')
        await page.fill('[data-testid=email]', 'admin@test.com')
        await page.fill('[data-testid=password]', 'test123456')
        await page.click('text=Iniciar Sesión')

        // Navegar a configuración de pagos
        await page.click('text=Configuración')
        await page.click('text=Métodos de Pago')

        // Configurar MercadoPago
        await page.check('[data-testid=mercadopago-enabled]')
        await page.fill('[data-testid=mp-access-token]', 'TEST_TOKEN_123')
        await page.fill('[data-testid=mp-public-key]', 'TEST_PUBLIC_KEY_123')
        await page.click('text=Guardar Configuración')

        // Verificar mensaje de éxito
        await expect(page.locator('text=✅ Configuración guardada')).toBeVisible()
    })
})
