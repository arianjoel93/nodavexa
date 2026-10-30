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

## Cuentas para Recursos

La migración `supabase/migrations/20261023001911_resource_accounts_and_tools.sql` crea los perfiles de usuarios de Recursos y el catálogo administrable de herramientas. Aplícala en el proyecto de Supabase antes de publicar este build.

El registro usa Supabase Auth y solicita nombre completo, correo, teléfono opcional, sector y contraseña. La pantalla de activación valida el código de ocho dígitos enviado por correo mediante `verifyOtp` con tipo `email`. En el proyecto de Supabase abre **Authentication > Email Templates > Confirm signup** y reemplaza el contenido por una plantilla que incluya `{{ .Token }}` (no `{{ .ConfirmationURL }}`), por ejemplo:

```html
<h2>Activa tu cuenta de Nodavexa</h2>
<p>Usa este código de 8 dígitos para activar tu cuenta:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
```

El superusuario `joeltrincadov@gmail.com` puede abrir el panel administrativo y controlar la visibilidad de los recursos desde **Admin > Recursos**. La política de Supabase permite a los usuarios autenticados leer únicamente recursos publicados.

## SEO y publicación en Hostinger

El contenido de las páginas de servicio se mantiene en `src/data/service-pages.json`; el build lo usa tanto para React como para generar HTML estático por URL. El HTML prerenderizado incluye texto principal, H1, metadatos, canonical y datos estructurados, por lo que no depende de ejecutar JavaScript para descubrir el contenido crítico.

Ejecuta `npm run build` y publica **todo el contenido de `dist`**, incluyendo `sitemap.xml`, `robots.txt`, `.htaccess`, `404.html` y los directorios de rutas. El `.htaccess` aplica las redirecciones 301 heredadas y sirve las páginas prerenderizadas directamente. No configures un fallback general de rutas desconocidas a `index.html`; las rutas válidas ya tienen su propio `index.html` y las inexistentes deben responder 404.

### Google Search Console

1. Agrega y verifica la propiedad de dominio `nodavexa.com` en Search Console. No hay un token de Google inventado ni agregado al código; conserva y usa el método de verificación que te indique Search Console.
2. Después de publicar el build, envía `https://nodavexa.com/sitemap.xml` en **Indexación > Sitemaps**.
3. Inspecciona la portada y las rutas `/crm-personalizado-guadalajara`, `/software-a-medida-guadalajara`, `/automatizacion-procesos-guadalajara`, `/sistemas-inventario-almacenes`, `/integraciones-odoo`, `/casos-de-exito` y `/contacto`; solicita indexación cuando estén publicadas.
4. En **Mejoras** revisa la inspección de páginas y los datos estructurados detectados. La aparición y el posicionamiento no son inmediatos ni están garantizados por el código.

La verificación de Google Business Profile, si la empresa ya cuenta con una ficha, se realiza desde esa cuenta y requiere confirmar datos reales de la empresa. No se agrega una dirección, ficha o reseña que no esté documentada.

### Analítica y mantenimiento

Se reutiliza PostHog si está configurado. Los eventos de conversión incluyen `demo_cta_click`, `whatsapp_click`, `contact_form_start`, `contact_form_submit`, `seo_service_page_view` y `case_study_view`, con `page_slug` en los eventos de página/CTA relevantes. No se añadió otra plataforma de analítica.

Después de publicar, verifica en Hostinger que el dominio sirva los nuevos archivos, que las URLs de servicio respondan directamente al recargarlas, que una ruta inexistente responda 404 y que las rutas antiguas redirijan con 301. Limpia la caché de Hostinger/CDN si el contenido anterior persiste.
