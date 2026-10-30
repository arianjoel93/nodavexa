# Mis ventas

Ruta: /recursos/control-ventas. Requiere cuenta e instalación del recurso.

Cada cuenta inicia un periodo de un mes al abrir por primera vez la herramienta. Las ventas se guardan en Supabase; el importe se registra en MXN antes de IVA. Los clientes se identifican por teléfono normalizado. La gráfica usa fechas de Ciudad de México e incluye días sin ventas. La tendencia compara dos mitades de igual duración del periodo transcurrido y no muestra porcentaje si la primera mitad carece de ventas.

Al vencer el mes no se aceptan ventas nuevas. Los datos permanecen pendientes de cierre hasta que el usuario descargue el PDF y confirme, o decida descartar el periodo. Una confirmación explica que se eliminarán las ventas anteriores. Después la transacción elimina solo las ventas de esa cuenta e inicia un mes nuevo. No hay un borrado silencioso antes de ofrecer la exportación. Los PDF generados se conservan separadamente durante 30 días según las reglas generales del historial.

La base valida el vencimiento usando la hora del servidor. Las operaciones se serializan por cuenta con bloqueo de fila y exigen el identificador de periodo para proteger pestañas desactualizadas. La API permite leer solo datos propios; las escrituras pasan por funciones autenticadas que obtienen el propietario desde Auth. Las funciones privilegiadas están en un esquema privado y los wrappers públicos son SECURITY INVOKER. Se limita el periodo a 5000 ventas para mantener el recurso sencillo y acotado.

Pruebas:

    node --experimental-strip-types --test tests/resource-sales.test.mjs
    npm run lint
    npm run build
    node scripts/verify-resource-seo.mjs

Se verificó en una transacción revertida: creación de venta, lectura, aislamiento entre cuentas, rechazo de periodo incorrecto, bloqueo al vencer, rechazo de cierre anticipado, confirmación de cierre y reinicio con identificador nuevo. No se conservaron los registros de prueba.
