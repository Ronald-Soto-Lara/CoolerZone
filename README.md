# CoolerZone Bolivia

Catálogo de coolers para celular construido con Next.js y Supabase. Los productos publicados se leen desde la tabla `products`; las compras usan PayPal.

## Configuración local

1. Copia `.env.example` a `.env.local`.
2. Completa las variables con los valores reales de tus proyectos de Supabase y PayPal.
3. Ejecuta las migraciones de Supabase y luego inicia el sitio:

```bash
npm install
npm run dev
```

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son necesarias para leer el catálogo. Si aún no están configuradas, el sitio puede compilar, pero el catálogo quedará vacío y la aplicación registrará el error.

El checkout requiere, además, `SUPABASE_SERVICE_ROLE_KEY`, las credenciales de PayPal (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `NEXT_PUBLIC_PAYPAL_CLIENT_ID`) y una tasa válida en `PAYPAL_BOB_TO_USD_RATE`. No expongas `SUPABASE_SERVICE_ROLE_KEY` ni `PAYPAL_CLIENT_SECRET` con el prefijo `NEXT_PUBLIC_`.

WhatsApp, redes sociales y Tawk.to son opcionales. Consulta `.env.example` para la lista completa.

## Base de datos y catálogo MEMO

Aplica los archivos SQL de `supabase/migrations` en orden cronológico desde Supabase CLI o el SQL Editor del proyecto. La migración `20261123000000_seed_memo_coolers.sql` agrega los seis modelos MEMO de este catálogo; usa `ON CONFLICT DO NOTHING` para no sobrescribir datos de productos ya existentes.

`products-memo-coolers.csv` contiene los mismos registros para importarlos desde el panel de Supabase. Las imágenes en `public/products` son ilustraciones conceptuales originales para demostración, no fotografías oficiales de los modelos. El stock incluido es ficticio y solo sirve para la demo; reemplázalo antes de cualquier uso comercial.

### Categorías y precios de referencia

Las categorías del filtro distinguen el sistema de sujeción: **Coolers magnéticos**, **Coolers híbridos** (imán y clip) y **Coolers con clip**. La refrigeración semiconductora/Peltier, potencia, pantalla, RGB y ventiladores se describen en cada ficha.

Los precios cargados son importes referenciales en bolivianos, no cotizaciones de distribuidores locales confirmadas. Deben verificarse antes de recibir pagos. Los listados de AliExpress se consultaron el 23 de noviembre de 2026; sus precios pueden cambiar y no incluyen necesariamente importación o entrega local:

- [MEMO CX12](https://www.aliexpress.com/w/wholesale-memo-cx12-cooler.html)
- [MEMO CX08 Pro](https://www.aliexpress.com/w/wholesale-memo-cx08-pro-cooler.html)
- [MEMO CX26 Ultra 30W](https://www.aliexpress.com/w/wholesale-memo-cx26-ultra-30w.html)
- [MEMO DL05](https://www.aliexpress.com/w/wholesale-memo-dl05-cooler.html)
- [MEMO CX07](https://www.aliexpress.com/w/wholesale-memo-cx07-cooler.html)
- [MEMO DL21](https://www.aliexpress.com/w/wholesale-memo-dl21-dual-fan.html)
