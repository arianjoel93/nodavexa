# Recursos y captación orgánica

## Intenciones de búsqueda

La revisión de competidores encontró generadores de cotizaciones como Owoode y UtiliWebs; en servicios locales, Black Ring System, CYC Systems y MASolutions. Estos resultados permiten identificar temas y lenguaje comercial, pero no son datos de volumen de búsqueda ni dificultad SEO.

- Cotizaciones: crear cotización, cotizador gratis, cotización PDF, cotización de servicios, cotizaciones para pequeñas empresas.
- Datos: convertir Excel a SQLite, CSV a DB, CSV UTF-8 con comillas, SQLite para básculas.
- Servicios: CRM personalizado Guadalajara, software a medida Guadalajara, automatización de procesos, inventarios y almacenes para PYMES.

Fuentes consultadas:
- https://owoode.com/mx/generador-de-cotizaciones
- https://utiliwebs.com/cotizaciones/
- https://blackringsystem.com/
- https://www.cycsystems.mx/
- https://masolutions.mx/

## Cambios realizados

El catálogo público explica cada herramienta y enlaza a páginas individuales. Todas requieren cuenta para utilizarse. Las fichas comparten una fuente de contenido entre React y la generación estática para mantener títulos, descripciones, beneficios y FAQ consistentes. El build incorpora las rutas al sitemap y genera HTML inicial útil para cada herramienta.

El creador de cotizaciones enlaza con Nodavexa Control; Recursos enlaza además con Bodegalia y desarrollo de software. Se preservan las páginas comerciales locales existentes para evitar competir con ellas mediante contenido duplicado. Se elimina el schema estático al montar la metadata dinámica para evitar acumulación de datos estructurados entre rutas.

## Operación y límites

El PDF se genera con jsPDF bajo demanda. Los datos de empresa se recuerdan por cuenta en este navegador. El historial almacena los archivos generados en Supabase Storage privado durante 30 días. Carga páginas de 25 metadatos y descarga cada archivo bajo demanda. Una tarea horaria elimina archivos vencidos mediante la API de Storage. Los archivos anteriores de IndexedDB se migran para la cuenta activa y solo se eliminan localmente después de subirlos. El usuario selecciona moneda y captura precios en esa moneda; no se aplica conversión automática.

## Después de publicar

1. Subir todo el contenido de dist, incluyendo carpetas de rutas y .htaccess.
2. En Google Search Console, verificar el dominio usando el código real de la cuenta y enviar https://nodavexa.com/sitemap.xml.
3. Solicitar inspección de /recursos y /recursos/crear-cotizacion, además de las páginas de servicios principales.
4. Revisar indexación y consultas reales a las 4-8 semanas para ajustar títulos y contenido con evidencia.
5. Mantener Google Business Profile con datos reales de Nodavexa, categorías y servicios coherentes; no inventar direcciones ni reseñas.

No se garantiza una posición ni un plazo de resultados. No se han medido volúmenes de búsqueda ni ejecutado Lighthouse en esta entrega.
