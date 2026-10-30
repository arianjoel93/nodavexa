# Reportes TSC

La herramienta está publicada en `/recursos/reportes-tsc` y requiere una cuenta autenticada con el recurso instalado. Cada cuenta funciona como su propio espacio de trabajo porque el esquema actual de Recursos no tiene espacios compartidos entre usuarios.

## Persistencia y privacidad

La migración `20261027211042_resource_tsc_reports.sql` está aplicada en el proyecto Supabase de Nodavexa. Crea `report_uploads`, `report_rows`, `report_warnings`, `report_comparisons` y el bucket privado `tsc-reports-private`. RLS vincula todos los registros y objetos de Storage al usuario autenticado. Los archivos originales no se sobrescriben ni se eliminan al reemplazar la vista.

## Formato y límites

Se admiten CSV separados por coma o punto y coma, entrecomillados, UTF-8/BOM y Windows-1252. Máximo 25 MB por archivo, cinco archivos y 50 MB por lote, hasta 100,000 filas por archivo. Columnas no reconocidas, filas vacías y anchos irregulares se conservan en el registro original y generan advertencias. Fechas/números interpretables se normalizan sin cambiar el original.

## Verificación local

```powershell
npm run test:tsc-reports
npx tsc -b
npm run build
```

Los casos de prueba cubren delimitadores y comillas, UTF-8 y Windows-1252, decimales, fechas, columnas/filas irregulares, duplicados y comparación acumulativa.
