# Script para probar el flujo completo de empleados
Write-Host "🧪 Probando flujo completo de empleados..." -ForegroundColor Cyan
Write-Host ""

# 1. Probar endpoint de turnos
Write-Host "1️⃣ Probando endpoint de turnos..." -ForegroundColor Yellow
try {
    $turnosResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/empleados/turnos" -Method GET
    Write-Host "✅ Turnos obtenidos:" -ForegroundColor Green
    $turnosResponse | ConvertTo-Json
} catch {
    Write-Host "❌ Error en turnos:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# 2. Probar endpoint de empleados (GET)
Write-Host "2️⃣ Probando endpoint de empleados (GET)..." -ForegroundColor Yellow
try {
    $empleadosResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/empleados?est_id=4" -Method GET
    Write-Host "✅ Empleados obtenidos:" -ForegroundColor Green
    $empleadosResponse | ConvertTo-Json
} catch {
    Write-Host "❌ Error en empleados GET:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# 3. Probar creación de empleado (POST)
Write-Host "3️⃣ Probando creación de empleado (POST)..." -ForegroundColor Yellow
$empleadoData = @{
    nombre = "Juan"
    apellido = "Pérez"
    dni = "12345678"
    email = "juan.perez.test@example.com"
    contrasena = "password123"
    estado = "Activo"
    est_id = 4
    disponibilidad = @(
        @{
            dia_semana = 1
            turno_id = 1
        }
    )
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/empleados" -Method POST -ContentType "application/json" -Body $empleadoData
    Write-Host "✅ Empleado creado:" -ForegroundColor Green
    $createResponse | ConvertTo-Json
} catch {
    Write-Host "❌ Error en creación:" -ForegroundColor Red
    Write-Host "Status Code:" $_.Exception.Response.StatusCode -ForegroundColor Red
    Write-Host "Message:" $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 Prueba completada" -ForegroundColor Cyan
Read-Host "Presiona Enter para continuar"
