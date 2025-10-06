# public/

**Rol / propósito:** Archivos estáticos públicos del sistema de estacionamiento, incluyendo imágenes placeholder, logos e iconos utilizados en la interfaz de usuario.

## Contenido clave
- `placeholder-logo.png/svg` - Logos placeholder para la aplicación
- `placeholder-user.jpg` - Imagen placeholder para usuarios
- `placeholder.jpg/svg` - Imágenes genéricas de placeholder

## Estructura

```
public/
├── placeholder-logo.png     # Logo PNG placeholder
├── placeholder-logo.svg     # Logo SVG placeholder
├── placeholder-user.jpg     # Avatar placeholder
├── placeholder.jpg          # Imagen genérica placeholder
└── placeholder.svg          # SVG genérico placeholder
```

## Entradas/Salidas

- **Entradas**: Archivos estáticos servidos por Next.js
- **Salidas**: URLs públicas accesibles desde el navegador

## Cómo se usa desde afuera

```typescript
// En componentes React
<img src="/placeholder-logo.svg" alt="Logo" />

// En CSS
.logo {
  background-image: url('/placeholder-user.jpg');
}
```

## Dependencias y contratos

- **Depende de**: Servidor Next.js para servir archivos estáticos
- **Expone**: URLs públicas en `/` para acceso desde frontend

## Puntos de extensión / modificar con seguridad

- Añadir nuevos assets: colocar archivos en `public/` con nombres descriptivos
- Reemplazar placeholders: actualizar archivos manteniendo nombres
- Optimizar imágenes: comprimir antes de añadir

## Convenciones / notas

- Archivos servidos automáticamente por Next.js desde `/`
- Nombres descriptivos con guiones bajos
- Optimización manual de imágenes recomendada
- Placeholders temporales para desarrollo
