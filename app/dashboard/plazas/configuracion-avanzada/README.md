# Configuración Avanzada de Plazas

Sistema completo para gestionar plantillas de plazas de manera visual e intuitiva.

## 🚀 Características

- **Interfaz Visual**: Grid interactivo con colores por tipo de plantilla
- **Múltiples Modos de Selección**: Individual, rango, fila, columna
- **Aplicación Masiva**: Cambios en múltiples plazas simultáneamente
- **Vista Previa**: Preview de cambios antes de confirmar
- **Validaciones**: Solo afecta plazas libres, respeta ocupaciones

## 📁 Estructura de Archivos

```
configuracion-avanzada/
├── page.tsx                    # Página principal
├── types.ts                    # Tipos TypeScript
├── components/
│   ├── ZonePicker.tsx         # Selector y configuración de zona
│   ├── PlazasGrid.tsx         # Grid visual de plazas
│   ├── SelectionToolbar.tsx   # Herramientas de selección
│   └── ApplyTemplatePanel.tsx # Panel de aplicación de plantillas
└── README.md                  # Este archivo
```

## 🎯 Uso del Sistema

### 1. Seleccionar Zona
- Elige la zona a configurar desde el panel izquierdo
- Ajusta la configuración del grid si es necesario (filas/columnas/numeración)

### 2. Elegir Modo de Selección
- **Individual**: Clic en plazas (Ctrl para múltiple)
- **Rango**: Arrastrar para seleccionar área rectangular
- **Fila**: Seleccionar toda una fila
- **Columna**: Seleccionar toda una columna

### 3. Aplicar Plantillas
- Selecciona una plantilla del dropdown
- Elige las plazas usando las herramientas de selección
- Haz clic en "Aplicar plantilla"
- Los cambios se muestran inmediatamente (preview mode)

### 4. Confirmar Cambios
- Revisa todos los cambios en el historial
- Usa "Deshacer" si necesitas revertir
- Haz clic en "Confirmar Cambios" para persistir

## 🔧 APIs Utilizadas

### Backend APIs
- `GET /api/plantillas` - Lista plantillas disponibles
- `GET /api/zonas` - Lista zonas del estacionamiento
- `GET /api/plazas?zona_id=X` - Plazas de una zona específica
- `POST /api/plazas/apply` - Aplicar cambios masivamente
- `GET/PUT /api/zonas/{id}/grid` - Configurar grid de zona

### Funciones de Base de Datos
- `fn_aplicar_plantilla_a_plazas()` - Aplica plantillas con validaciones
- `fn_limpiar_plantilla_de_plazas()` - Limpia plantillas de plazas libres

## 🎨 Colores y Leyenda

- 🔵 **Azul**: Automóviles
- 🟢 **Verde**: Motocicletas
- 🟣 **Morado**: Camionetas
- 🔴 **Rojo**: Plazas ocupadas
- 🟡 **Amarillo**: Plazas reservadas
- 🟠 **Naranja**: Plazas en mantenimiento
- ⚪ **Gris**: Sin plantilla asignada

## ⚠️ Consideraciones Importantes

1. **Solo plazas libres**: Los cambios solo afectan plazas con estado "Libre"
2. **Transacciones seguras**: Usa funciones de BD con validaciones
3. **Preview mode**: Los cambios son temporales hasta confirmar
4. **Historial**: Se puede deshacer cualquier cambio antes de confirmar
5. **Validaciones**: Verifica permisos y consistencia de datos

## 🔄 Flujo de Trabajo

```
1. Seleccionar Zona → 2. Configurar Grid → 3. Elegir Modo Selección
   ↓
4. Seleccionar Plazas → 5. Elegir Plantilla → 6. Aplicar Cambios
   ↓
7. Preview Resultados → 8. Ajustar si necesario → 9. Confirmar
   ↓
10. Cambios persistidos en BD
```

## 🚨 Troubleshooting

- **No se aplican cambios**: Verifica que las plazas estén libres
- **Grid no se muestra**: Asegúrate de haber seleccionado una zona
- **Errores de permisos**: Verifica que tengas acceso al estacionamiento
- **Problemas de performance**: Considera usar paginación para zonas grandes
