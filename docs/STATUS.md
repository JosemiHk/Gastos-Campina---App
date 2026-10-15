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

Las cuatro migraciones están aplicadas en Supabase y sus versiones locales coinciden con el historial remoto. Las 14 tablas tienen RLS; el bucket `receipts` es privado y limita archivos a JPG/PNG/PDF de 10 MiB. La URL y clave pública están exclusivamente en archivos locales excluidos de Git. El repositorio tiene remoto de GitHub; Vercel sigue pendiente.

El propietario creó y confirmó la cuenta en Auth. Se configuraron su nombre y pertenencia activa como administrador, y se aprovisionó el hogar con sus reglas iniciales. Sus datos de alta se conservan en `supabase/.temp/admin-request.json`, excluido de Git. La verificación remota mediante el rol `authenticated` comprobó lectura como administrador, tres recibos, cálculo y cierre dentro de una transacción revertida; no quedaron periodos ni recibos de prueba. También se verificaron las denegaciones para acceso anónimo y ausencia de identidad. Estas comprobaciones SQL no sustituyen una sesión real del navegador.

Pendiente en el panel de Auth: desactivar el registro público (la consulta de settings aún lo muestra habilitado), configurar Site URL/redirecciones, SMTP y plantilla Magic Link con código de seis dígitos. El MCP conectado no ofrece administración de usuarios ni de configuración de Auth. No se han probado entrega de correo, sesión real ni transferencia de archivos mediante la API de Storage. Ver `SETUP.md` y `SECURITY.md`.

La exportación PNG está implementada y requiere inspección del archivo generado en un navegador real, junto con las pruebas de compartición en dispositivos. Los tests de componentes verifican contenido y comportamiento, no píxeles.

## Fuera del MVP

Editor libre de grupos y servicios, reapertura de meses, PDF/Excel/CSV, constancias de pago y múltiples adjuntos, recordatorios programados y modo oscuro. No hay integración bancaria automática.
