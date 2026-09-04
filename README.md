# Nodavexa Web

Sitio empresarial y catálogo administrable desarrollado con React, Vite y Supabase.

## Desarrollo local

1. Instala dependencias con `npm install`.
2. Copia `.env.example` como `.env.local` y completa las variables.
3. Ejecuta `supabase/setup.sql` en el SQL Editor de Supabase.
4. Crea un usuario en Authentication > Users y asígnale el rol admin con el comando incluido al inicio de `setup.sql`.
5. Ejecuta `npm run dev`.

## Correo del formulario

La función `send-contact` está desplegada en Supabase. La credencial SMTP se guarda cifrada en Supabase Vault y sólo puede leerla `service_role`; nunca debe guardarse en `.env`, código fuente ni variables `VITE_*`.

## Cotizador FedEx

La función `fedex-quote` está desplegada y las credenciales nunca llegan al navegador. Configura estos valores en **Supabase > Edge Functions > Secrets**:

- `FEDEX_CLIENT_ID`: API Key / Client ID del proyecto FedEx.
- `FEDEX_CLIENT_SECRET`: Secret Key del proyecto FedEx.
- `FEDEX_ACCOUNT_NUMBER`: número de cuenta FedEx de nueve dígitos.
- `FEDEX_ORIGIN_POSTAL_CODE`: código postal desde el que salen los paquetes.
- `FEDEX_API_BASE_URL`: `https://apis.fedex.com` en producción o `https://apis-sandbox.fedex.com` para pruebas.

En cada solución activa el cotizador y captura precio antes de IVA, IVA, peso y dimensiones finales del paquete.

Sin variables de Supabase, el sitio público muestra contenido demostrativo y `/admin` presenta instrucciones de conexión.

## Publicación en Hostinger

Ejecuta `npm run build` y publica el contenido de `dist`. Configura el fallback de rutas SPA hacia `index.html`.
