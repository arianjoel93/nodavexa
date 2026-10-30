# Inventario básico

Ruta: `/recursos/inventario-basico`. Instalable desde el catálogo de Recursos.

- Datos permanentes por usuario; no participa en la limpieza mensual de ventas o archivos.
- 30 productos activos; códigos únicos incluyendo archivados. Archivar requiere stock cero. Restaurar respeta el límite.
- 15 movimientos por mes calendario de aniversario, desde el primer movimiento válido. Cada producto de una entrada o salida consume uno; las correcciones usan un movimiento contrario.
- Renovación calculada en servidor usando el ancla original (evita deriva al comenzar el 31). No acumula cupos ni borra historial.
- Bloqueo transaccional por usuario: evita superar límites o gastar el mismo stock concurrentemente. UUID de solicitud evita duplicar un envío reintentado.
- Cantidades positivas con hasta seis decimales; no admite stock negativo. Stock no editable directamente.
- RLS y funciones privadas autenticadas; cliente sin permisos de escritura directa.
- Historial paginado de 25 registros. Exportación completa CSV/PDF bajo demanda. CSV neutraliza fórmulas.
- Copias de reportes en Storage siguen la retención existente de 30 días; esto no afecta los datos del inventario.

Validación: `npm run lint`, `npm run build`. Pruebas SQL transaccionales en `tests/resource-inventory.sql`; ejecutarlas en SQL Editor con privilegios de administrador. Requieren una cuenta de prueba existente; no guardan datos al terminar.
