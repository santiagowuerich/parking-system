@echo off
echo 🧪 Verificando endpoints de empleados...
echo.

echo 1. Verificando endpoint de turnos:
curl -s http://localhost:3000/api/empleados/turnos
echo.
echo.

echo 2. Verificando endpoint de empleados (GET):
curl -s http://localhost:3000/api/empleados?est_id=4
echo.
echo.

echo 3. Intentando crear empleado (debería fallar por autenticación):
curl -s -X POST http://localhost:3000/api/empleados ^
  -H "Content-Type: application/json" ^
  -d "{\"nombre\":\"Test\",\"apellido\":\"User\",\"dni\":\"12345678\",\"email\":\"test@example.com\",\"contrasena\":\"password123\",\"est_id\":4,\"disponibilidad\":[{\"dia_semana\":1,\"turno_id\":1}]}"
echo.
echo.

echo ✅ Verificación completada
pause
