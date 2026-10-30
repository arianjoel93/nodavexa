# Profesionalización comercial de Nodavexa

## Cambios incorporados

- Mensaje principal orientado a software empresarial, inventarios, ventas e integraciones industriales.
- Distinción entre productos propios y servicios a medida en la portada.
- Bodegalia comunicado como producto con **plan gratuito disponible**, sin suponer límites, funcionalidades o precios de otros planes.
- Navegación y filtro del catálogo por producto o solución a medida.
- Estilos responsive y estados de foco visibles.
- Manejo de fallos de red y respuestas no exitosas en el formulario de contacto.
- Lenguaje prudente para casos de éxito, sin atribuir métricas que no constan en la base de datos.

## Antes de publicar

1. Ejecutar `npm ci && npm run build` en un entorno con Node y revisar el resultado.
2. Probar escritorio, tablet y móvil, teclado y lector de pantalla.
3. Verificar que Bodegalia esté publicado como `item_type=product` en Supabase, con contenido y URL aprobados. La web de Nodavexa no es el backend de Bodegalia.
4. Validar que el plan gratuito y sus límites publicados coincidan con las condiciones reales del producto.
5. Probar la función `send-contact` en staging; confirmar email, almacenamiento y ausencia de duplicados.
6. Revisar RLS y permisos de escritura de `solutions`, `success_cases`, `site_settings` y `contact_messages`; la verificación `admin` del frontend no sustituye a RLS.
7. Comprobar que el contenido HTML editable se sanee antes de renderizarlo, para evitar XSS.
8. Realizar una prueba Lighthouse, medición de Core Web Vitals y revisión SEO con el dominio publicado.
9. Documentar aviso de privacidad y condiciones comerciales con revisión jurídica antes de enlazarlos públicamente.
10. Revisar secretos de Edge Functions y configuraciones SMTP; no exponer contraseñas en el frontend.

## Próximas fases

- Fichas de producto con plan gratuito, condiciones, demostración y enlace de registro verificado.
- Casos de éxito con capturas autorizadas y resultados documentados.
- Flujo comercial CRM, seguimiento y calificación de prospectos.
- Pruebas automatizadas y CI/CD.
- Monitoreo, backups, restauración y soporte con niveles de servicio acordados.

No se han ejecutado migraciones ni cambios en producción con esta rama.
