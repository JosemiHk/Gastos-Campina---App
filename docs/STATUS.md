# Estado del MVP

## Implementado

- Angular 22, standalone, Signals, formularios tipados, Material 3 y SCSS.
- Correo, OTP, recuperación, confirmación de enlace y cierre de sesión.
- Navegación mobile/desktop y periodo en la URL.
- Resumen mensual sin datos ficticios.
- Registro/edición de recibos, borradores y adjunto privado opcional.
- Previsualización y cálculo PostgreSQL en céntimos exactos.
- Desglose y confirmación/anulación manual de aportes.
- Historial por año y cierre que protege importes, reglas y nombres.
- Configuración del aporte fijo y de cuentas reales de transferencia.
- Texto y exportación PNG con alternativas según navegador.
- Migraciones, RLS, Storage privado, pruebas y CI para GitHub.

## Pendiente de entorno y validación real

El usuario aún no tiene proyecto Supabase. No se han aplicado migraciones externas ni verificado correo, sesiones o Storage contra una instancia real. Tampoco se ha desplegado en Vercel ni subido a GitHub.

La exportación PNG está implementada y requiere inspección del archivo generado en un navegador real, junto con las pruebas de compartición en dispositivos. Los tests de componentes verifican contenido y comportamiento, no píxeles.

## Fuera del MVP

Editor libre de grupos y servicios, reapertura de meses, PDF/Excel/CSV, constancias de pago y múltiples adjuntos, recordatorios programados y modo oscuro. No hay integración bancaria automática.
