# Script para probar la API de empleados
Write-Host "🔧 Probando API de empleados..." -ForegroundColor Cyan
Write-Host ""

# Probar GET de empleados
Write-Host "1️⃣ Probando GET /api/empleados?est_id=4..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/empleados?est_id=4" -Method GET -UseBasicParsing
    Write-Host "✅ Respuesta exitosa:" -ForegroundColor Green
    Write-Host "Status:" $response.StatusCode
    Write-Host "Content-Type:" $response.Headers.'Content-Type'
    Write-Host ""
    Write-Host "📋 Contenido de la respuesta:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "❌ Error en GET:" -ForegroundColor Red
    Write-Host "Status:" $_.Exception.Response.StatusCode
    Write-Host "Message:" $_.Exception.Message
    Write-Host ""
    Write-Host "📋 Contenido del error:" -ForegroundColor Red
    try {
        $_.Exception.Response.Content | ConvertFrom-Json | ConvertTo-Json
    }
    catch {
        Write-Host $_.Exception.Response.Content
    }
}
Write-Host ""

# Probar GET de turnos
Write-Host "2️⃣ Probando GET /api/empleados/turnos..." -ForegroundColor Yellow
try {
    $turnosResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/empleados/turnos" -Method GET -UseBasicParsing
    Write-Host "✅ Turnos obtenidos:" -ForegroundColor Green
    $turnosResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "❌ Error en turnos:" -ForegroundColor Red
    Write-Host "Status:" $_.Exception.Response.StatusCode
    Write-Host "Message:" $_.Exception.Message
}
Write-Host ""

# Probar POST de empleado (debería fallar por autenticación)
Write-Host "3️⃣ Probando POST /api/empleados (sin auth)..." -ForegroundColor Yellow
$testEmployee = @{
    nombre         = "Test"
    apellido       = "User"
    dni            = "12345678"
    email          = "test-$(Get-Random)@example.com"
    contrasena     = "password123"
    estado         = "Activo"
    est_id         = 4
    disponibilidad = @(
        @{
            dia_semana = 1
            turno_id   = 1
        }
    )
} | ConvertTo-Json

try {
    $postResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/empleados" -Method POST -ContentType "application/json" -Body $testEmployee -UseBasicParsing
    Write-Host "✅ POST exitoso (inesperado sin auth):" -ForegroundColor Yellow
    $postResponse.Content | ConvertFrom-Json | ConvertTo-Json
}
catch {
    Write-Host "✅ POST falló correctamente (esperado por falta de auth):" -ForegroundColor Green
    Write-Host "Status:" $_.Exception.Response.StatusCode
    try {
        $errorContent = $_.Exception.Response.Content | ConvertFrom-Json
        Write-Host "Error message:" $errorContent.error
    }
    catch {
        Write-Host "Error content:" $_.Exception.Response.Content
    }
}

Write-Host ""
Write-Host "🎯 Diagnóstico completado" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Si el GET funciona pero no ves empleados en el frontend:" -ForegroundColor Yellow
Write-Host "   - El problema está en la autenticación del navegador"
Write-Host "   - Verifica que estés logueado correctamente"
Write-Host "   - Revisa los logs de la consola del navegador"
Write-Host ""
Write-Host "💡 Si el GET no devuelve empleados:" -ForegroundColor Yellow
Write-Host "   - Verifica que existan empleados en la base de datos"
Write-Host "   - Revisa que el est_id sea correcto"
Write-Host "   - Verifica que el usuario tenga permisos sobre ese estacionamiento"

Read-Host "Presiona Enter para continuar"
