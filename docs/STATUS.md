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

Las cuatro migraciones iniciales están aplicadas en Supabase y sus versiones locales coinciden con el historial remoto. Las 14 tablas tienen RLS; el bucket `receipts` es privado y limita archivos a JPG/PNG/PDF de 10 MiB. La URL y clave pública están exclusivamente en archivos locales excluidos de Git. La web está publicada en Vercel, conectada a GitHub.

El propietario creó y confirmó la cuenta en Auth. Se configuraron su nombre y pertenencia activa como administrador, y se aprovisionó el hogar con sus reglas iniciales. Sus datos de alta se conservan en `supabase/.temp/admin-request.json`, excluido de Git. La verificación remota mediante el rol `authenticated` comprobó lectura como administrador, tres recibos, cálculo y cierre dentro de una transacción revertida; no quedaron periodos ni recibos de prueba. También se verificaron las denegaciones para acceso anónimo y ausencia de identidad. Estas comprobaciones SQL no sustituyen una sesión real del navegador.

El propietario configuró SMTP de Brevo, plantilla Magic Link y las URL de producción, y confirmó mediante capturas la recepción del correo y la sesión real como administrador. Se corrigió el envío nativo del formulario que recargaba la página; se detectó además que Auth enviaba ocho dígitos y se indicó ajustar el código a seis antes del acceso exitoso. La transferencia de archivos mediante la API de Storage sigue pendiente de prueba real. Ver `SETUP.md` y `SECURITY.md`.

La exportación PNG está implementada y requiere inspección del archivo generado en un navegador real, junto con las pruebas de compartición en dispositivos. Los tests de componentes verifican contenido y comportamiento, no píxeles.

## Mejoras en rama de revisión

`codex/editable-household-settings` contiene movimiento sutil con preferencia de movimiento reducido y edición de nombres, integrantes y participación por servicio. Añade una quinta migración pendiente, revisión compartida y conservación de integrantes históricos. No se aplicó a la base de producción ni se fusionó la rama en `main`. La implementación conserva compatibilidad con el servidor inicial y mantiene deshabilitada la edición ampliada mientras falte esa migración.

Consultar `REVIEW_SETTINGS.md` para preparar un entorno de pruebas, revisar desktop/móvil y activar después de aprobar. El editor libre de fórmulas y proporciones queda para una fase posterior.

## Fuera del MVP

Alta/baja libre de grupos y servicios, fórmulas o proporciones personalizadas, reapertura de meses, PDF/Excel/CSV, constancias de pago y múltiples adjuntos, recordatorios programados y modo oscuro. No hay integración bancaria automática.
