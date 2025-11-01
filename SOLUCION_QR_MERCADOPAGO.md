# 🔧 Solución: Error de QR en MercadoPago

## 📋 Problema Identificado

Al escanear el código QR generado para reservas, aparece el error **"error de ingreso de datos"**.

## 🔍 Causa Raíz

MercadoPago **NO genera códigos QR automáticamente** en las preferences regulares de checkout. Las preferences solo devuelven `init_point` (URL de checkout web), no códigos QR nativos.

### Lo que NO funciona:
- ❌ `point_of_interaction.transaction_data.qr_code` - No existe en preferences regulares
- ❌ Configurar `point_of_interaction: { type: 'QR_CODE' }` - No funciona en preferences

### Lo que SÍ funciona:
- ✅ Usar `init_point` como código QR (URL que redirige a MercadoPago)
- ✅ Usar QR Dinámico de MercadoPago (requiere configuración adicional)

## ✅ Solución Implementada

Se modificó el código para usar `init_point` como código QR. Cuando el usuario escanea el QR:
1. Es redirigido a la página de pago de MercadoPago
2. Completa el pago allí
3. MercadoPago procesa el webhook

### Cambios Realizados:

**Archivo**: `app/api/reservas/crear/route.ts`

1. **Configuración de preference para QR**:
   ```typescript
   if (metodo_pago === 'qr') {
       preferenceData.payment_methods = {
           default_payment_method_id: 'account_money',
           excluded_payment_methods: [
               { id: 'credit_card' },
               { id: 'debit_card' },
               { id: 'bank_transfer' }
           ],
           excluded_payment_types: [
               { id: 'ticket' },
               { id: 'atm' }
           ],
           installments: 1
       };
       preferenceData.binary_mode = true;
   }
   ```

2. **Uso de init_point como QR**:
   ```typescript
   paymentInfo = {
       preference_id: preferenceResult.id,
       qr_code: qrUrl, // init_point usado como código QR
       init_point: preferenceResult.init_point,
       sandbox_init_point: preferenceResult.sandbox_init_point
   };
   ```

## ⚠️ Limitaciones Actuales

- El QR contiene una URL, no datos nativos de MercadoPago
- El usuario debe abrir MercadoPago después de escanear
- No es un QR "puro" como los de Point of Sale

## 🚀 Mejora Futura: QR Dinámico

Para obtener códigos QR nativos de MercadoPago, necesitamos usar el endpoint de **QR Dinámico**:

```typescript
// Endpoint: POST https://api.mercadopago.com/instore/orders/qr/seller/collectors/{USER_ID}/pos/{EXTERNAL_POS_ID}/qrs

const qrResponse = await fetch(
    `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${collectorId}/pos/${posId}/qrs`,
    {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            external_reference: resCodigoGenerado,
            title: `Reserva ${estacionamientoNombre}`,
            description: `Reserva de ${duracion_horas} hora(s)`,
            notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/reservas/procesar-pago?res_codigo=${resCodigoGenerado}`,
            items: [{
                sku_number: resCodigoGenerado,
                category: 'reserva',
                title: `Reserva Plaza ${pla_numero}`,
                description: `Vehículo ${veh_patente}`,
                unit_price: precioTotal,
                quantity: 1,
                unit_measure: 'unit',
                total_amount: precioTotal
            }],
            total_amount: precioTotal,
            currency_id: 'ARS'
        })
    }
);
```

### Requisitos para QR Dinámico:
1. Configurar un Point of Sale (POS) en MercadoPago
2. Obtener `collector_id` y `external_pos_id`
3. Usar endpoint específico de QR Dinámico

## 🧪 Testing

Para probar la solución actual:

1. Crear una reserva con método QR
2. Escanear el código QR con la app de MercadoPago
3. Debería abrirse la página de pago
4. Completar el pago
5. Verificar que el webhook procese correctamente

## 📝 Notas Adicionales

- El error "ingreso de datos" puede venir de MercadoPago si falta información en la preference
- Asegúrate de que `external_reference` esté configurado correctamente
- Verifica que `notification_url` sea accesible públicamente
- En sandbox, usa `sandbox_init_point` en lugar de `init_point`

## 🔗 Referencias

- [MercadoPago QR Code Documentation](https://www.mercadopago.com.uy/developers/es/docs/qr-code/introduction)
- [MercadoPago Dynamic QR](https://www.mercadopago.com.ar/developers/es/docs/instore-api/qr-code)
- [MercadoPago Preferences API](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/preferences)
