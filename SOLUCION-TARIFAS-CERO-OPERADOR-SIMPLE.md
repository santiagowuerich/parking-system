# Solución: Tarifas en $0 en Operador Simple

## 📋 Problema

En el panel de operador simple, al registrar la salida de un vehículo, aparece:
- **Tarifa vigente:** $ 0 por hora
- **Total a cobrar:** $ 0

Esto ocurre incluso cuando el vehículo ha estado estacionado por 5 minutos o más.

---

## 🔍 Causa Raíz

### **Problema 1: Tarifas No se Cargan Correctamente**

El `useEffect` que carga las tarifas depende de `estId`:

```typescript
useEffect(() => {
    if (!estId) return;

    // Timeout de 300ms antes de cargar
    const timeoutId = setTimeout(() => {
        loadRates(); // Carga de Supabase
    }, 300);

    return () => clearTimeout(timeoutId);
}, [estId]);
```

**Problema:** Con los cambios recientes de inicialización de `estId` desde localStorage, puede haber un timing issue donde:
1. El componente se monta
2. El useEffect se ejecuta pero `estId` aún no está disponible
3. Las tarifas no se cargan
4. El cálculo usa un array vacío de `rates`

---

### **Problema 2: No Hay Fallback si No se Encuentra Tarifa**

El código actual solo calcula `fee` si encuentra `vehicleRate`:

```typescript
if (vehicleRate) {
    // Calcula fee
    fee = Math.max(calculatedFee, agreedPrice);
}
// ⚠️ Si NO se encuentra vehicleRate, fee queda en 0
```

**Problema:** Si no se encuentra la tarifa apropiada:
- `fee = 0`
- `calculatedFee = 0`
- Solo usa `agreedPrice` si es > 0

---

## 🛠️ Solución Implementada

### **Cambio 1: Logging para Diagnóstico**

**Archivo:** [`app/dashboard/operador-simple/page.tsx:96-130`](app/dashboard/operador-simple/page.tsx)

```typescript
useEffect(() => {
    if (!estId) {
        console.log('⚠️ No hay estId, no se pueden cargar tarifas');
        return;
    }

    console.log(`💰 Cargando tarifas para estId: ${estId}`);

    const timeoutId = setTimeout(() => {
        const loadRates = async () => {
            try {
                const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );

                const { data, error } = await supabase
                    .from('tarifas')
                    .select('*')
                    .eq('est_id', estId);

                if (error) throw error;

                console.log(`✅ Tarifas cargadas (${data?.length || 0} tarifas):`, data);
                setRates(data || []);
            } catch (error) {
                console.error("❌ Error al cargar tarifas:", error);
            }
        };

        loadRates();
    }, 300);

    return () => clearTimeout(timeoutId);
}, [estId]);
```

**Beneficio:** Ahora podemos ver en consola:
- Si `estId` está disponible
- Cuántas tarifas se cargaron
- Si hubo errores

---

### **Cambio 2: Warning si No se Encuentra Tarifa**

**Archivo:** [`app/dashboard/operador-simple/page.tsx:676-683`](app/dashboard/operador-simple/page.tsx)

```typescript
if (vehicleRate) {
    // ... cálculo normal
    fee = Math.max(calculatedFee, agreedPrice);

    console.log('💰 Cálculo de tarifa handleExit:', { ... });
} else {
    // 🟢 NUEVO: Warning si no se encuentra tarifa
    console.warn('⚠️ No se encontró tarifa para:', {
        plazaPlantillaId,
        tipoVehiculo: ocupacion.type,
        tiptar,
        ratesDisponibles: rates?.length || 0
    });
}
```

**Beneficio:** Identifica exactamente por qué no se encuentra la tarifa.

---

### **Cambio 3: Fallback a Precio Acordado**

**Archivo:** [`app/dashboard/operador-simple/page.tsx:686-695`](app/dashboard/operador-simple/page.tsx)

```typescript
// 🟢 SOLUCIÓN: Si después de todo el fee es 0, usar precio acordado o mínimo
if (fee === 0) {
    if (agreedPrice > 0) {
        fee = agreedPrice;
        console.log('✅ Usando precio acordado como fallback:', agreedPrice);
    } else {
        // Si no hay precio acordado ni tarifa, advertir pero permitir continuar
        console.warn('⚠️ ADVERTENCIA: No hay tarifa configurada ni precio acordado. Fee = 0');
    }
}
```

**Beneficio:**
- Si hay `ocu_precio_acordado` > 0 → Usa ese valor
- Esto asegura que se cobre AL MENOS el mínimo acordado
- Si aún así es 0, muestra advertencia pero permite continuar

---

## 🧪 Pasos para Verificar el Problema

1. **Abrir DevTools → Console**

2. **Ir a Operador Simple**

3. **Verificar logs al cargar:**
   ```
   💰 Cargando tarifas para estId: 90
   ✅ Tarifas cargadas (X tarifas): [...]
   ```

4. **Registrar salida de un vehículo**

5. **Verificar logs de cálculo:**
   ```
   💰 Cálculo de tarifa handleExit: {
     basePrice: XXX,
     calculatedFee: XXX,
     agreedPrice: XXX,
     fee: XXX
   }
   ```

---

## 📊 Posibles Escenarios

### **Escenario 1: Tarifas No Cargadas**

**Síntoma:**
```
⚠️ No hay estId, no se pueden cargar tarifas
```

**Causa:** `estId` es `null` cuando se monta el componente

**Solución:** Verificar que localStorage tenga `parking_est_id` guardado

---

### **Escenario 2: Tarifas Cargadas pero No Coinciden**

**Síntoma:**
```
✅ Tarifas cargadas (5 tarifas): [...]
⚠️ No se encontró tarifa para: {
  plazaPlantillaId: null,
  tipoVehiculo: "auto",
  tiptar: 1,
  ratesDisponibles: 5
}
```

**Causa:** La tarifa no coincide con:
- `plantilla_id` de la plaza (si tiene)
- `catv_segmento` del vehículo + `tiptar_nro`

**Solución:** Configurar tarifas correctamente en `/dashboard/tarifas`

---

### **Escenario 3: Precio Acordado como Fallback**

**Síntoma:**
```
⚠️ No se encontró tarifa para: {...}
✅ Usando precio acordado como fallback: 1000
```

**Causa:** No hay tarifa configurada, pero hay `ocu_precio_acordado`

**Resultado:** Cobra el precio acordado (correcto)

---

### **Escenario 4: Fee en $0 Sin Solución**

**Síntoma:**
```
⚠️ No se encontró tarifa para: {...}
⚠️ ADVERTENCIA: No hay tarifa configurada ni precio acordado. Fee = 0
```

**Causa:**
- No hay tarifas configuradas
- No hay precio acordado
- Configuración incompleta

**Solución:**
1. Ir a `/dashboard/tarifas`
2. Crear tarifas para todos los tipos de vehículos
3. Alternativamente, asegurar que se ingrese precio acordado al registrar entrada

---

## 🎯 Checklist de Verificación

Para que el cobro funcione correctamente, verificar:

- [ ] **estId existe** en localStorage (`parking_est_id`)
- [ ] **Tarifas configuradas** en `/dashboard/tarifas` para el estacionamiento
- [ ] **Tarifas coinciden** con:
  - Tipo de vehículo (`catv_segmento`)
  - Tipo de tarifa (`tiptar_nro`: 1=hora, 2=día, 3=mes, 4=semana)
  - Plantilla de plaza (si aplica)
- [ ] **Precio acordado** (`ocu_precio_acordado`) si no hay tarifas configuradas

---

## 🔧 Archivos Modificados

1. [`app/dashboard/operador-simple/page.tsx`](app/dashboard/operador-simple/page.tsx)
   - Línea 96-130: Mejorado logging en carga de tarifas
   - Línea 676-683: Agregado warning si no se encuentra tarifa
   - Línea 686-695: Agregado fallback a precio acordado

---

## 📝 Próximos Pasos

Si el problema persiste:

1. **Verificar en consola:**
   - ¿Se cargan las tarifas?
   - ¿Cuántas tarifas se cargan?
   - ¿Qué valores tienen?

2. **Verificar en base de datos:**
   ```sql
   SELECT * FROM tarifas WHERE est_id = 90;
   ```

3. **Verificar precio acordado:**
   ```sql
   SELECT ocu_precio_acordado FROM ocupaciones
   WHERE patente = 'ACB2734A' AND est_id = 90;
   ```

4. **Si es necesario, configurar tarifa por defecto:**
   - Crear tarifa "genérica" que aplique a todos los vehículos
   - Tipo: Por hora
   - Precio base: Mínimo a cobrar

---

**Fecha de Implementación:** 2025-10-08
**Archivos Modificados:** 1
**Prioridad:** ALTA (afecta facturación)
