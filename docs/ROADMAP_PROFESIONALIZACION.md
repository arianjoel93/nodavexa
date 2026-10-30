# Profesionalización comercial de Nodavexa

## Cambios incorporados

- Mensaje principal orientado a software empresarial, inventarios, ventas e integraciones industriales.
- Distinción entre productos propios y servicios a medida en la portada.
- Bodegalia comunicado como producto con **plan gratuito disponible**, sin suponer límites, funcionalidades o precios de otros planes.
- Navegación y filtro del catálogo por producto o solución a medida.
- Estilos responsive y estados de foco visibles.
- Manejo de fallos de red y respuestas no exitosas en el formulario de contacto.
- Lenguaje prudente para casos de éxito, sin atribuir métricas que no constan en la base de datos.

## Implementación verificada en este PR

- Sanitización con lista permitida para el HTML editable de soluciones y casos de éxito, tanto al guardar desde el panel como al renderizar contenido público.
- Validación de tipo y tamaño de archivos antes de enviarlos a Storage.
- Migración `20261030192759_harden_nodavexa_rls.sql` para reforzar RLS, privilegios explícitos y autorización administrativa basada en `app_metadata`.
- Metadatos SEO y páginas prerenderizadas para soluciones y casos publicados cuando existen credenciales de lectura; la compilación también funciona sin secretos locales y genera las rutas estáticas básicas.
- Tests de sanitización y workflow de CI con lint, tests y build.
- Formulario de leads con límite de tamaño, validación de objeto y deduplicación de envíos idénticos recientes para evitar duplicados al reintentar tras un fallo de correo.
- Bodegalia se promociona como producto con plan gratuito disponible y enlace al sitio oficial. No se modifican sus reglas, precios ni límites desde este repositorio.

## Antes de publicar

1. Ejecutar `npm ci`, `npm run lint`, `npm test -- --run` y `npm run build` en CI o localmente.
2. Probar escritorio, tablet y móvil, teclado y lector de pantalla.
3. Verificar que Bodegalia esté publicado como `item_type=product` en Supabase, con contenido y URL aprobados. La web de Nodavexa no es el backend de Bodegalia.
4. Validar que el plan gratuito y sus límites publicados coincidan con las condiciones reales del producto.
5. Probar la función `send-contact` en staging; confirmar email, almacenamiento y ausencia de duplicados.
6. Aplicar la migración de RLS en un entorno controlado y revisar los advisors después; la verificación `admin` del frontend no sustituye a RLS.
7. Probar con datos representativos que el contenido HTML editable conserve el formato permitido y elimine scripts, eventos y enlaces inseguros.
8. Realizar una prueba Lighthouse, medición de Core Web Vitals y revisión SEO con el dominio publicado.
9. Documentar aviso de privacidad y condiciones comerciales con revisión jurídica antes de enlazarlos públicamente.
10. Revisar secretos de Edge Functions y configuraciones SMTP; no exponer contraseñas en el frontend.

## Próximas fases

- Fichas de producto con plan gratuito, condiciones, demostración y enlace de registro verificado.
- Casos de éxito con capturas autorizadas y resultados documentados.
- Flujo comercial CRM, seguimiento y calificación de prospectos.
- Pruebas automatizadas y CI/CD.
- Monitoreo, backups, restauración y soporte con niveles de servicio acordados.

No se han ejecutado migraciones, despliegues ni cambios en producción con esta rama. La lectura de Supabase confirmó que Bodegalia está publicada como `product` y enlaza con `https://bodegalia.nodavexa.com/`; las condiciones concretas del plan gratuito siguen siendo responsabilidad del producto Bodegalia y deben validarse allí antes de publicar textos más específicos.
