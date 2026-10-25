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

Las cinco migraciones están aplicadas en Supabase y sus versiones locales coinciden con el historial remoto; la última es `20261021203521_editable_household_settings`. Las 14 tablas tienen RLS; el bucket `receipts` es privado y limita archivos a JPG/PNG/PDF de 10 MiB. La URL y clave pública están exclusivamente en archivos locales excluidos de Git. La web está publicada en Vercel, conectada a GitHub.

El propietario creó y confirmó la cuenta en Auth. Se configuraron su nombre y pertenencia activa como administrador, y se aprovisionó el hogar con sus reglas iniciales. Sus datos de alta se conservan en `supabase/.temp/admin-request.json`, excluido de Git. La verificación remota mediante el rol `authenticated` comprobó lectura como administrador, tres recibos, cálculo y cierre dentro de una transacción revertida; no quedaron periodos ni recibos de prueba. También se verificaron las denegaciones para acceso anónimo y ausencia de identidad. Estas comprobaciones SQL no sustituyen una sesión real del navegador.

El propietario configuró SMTP de Brevo, plantilla Magic Link y las URL de producción, y confirmó mediante capturas la recepción del correo y la sesión real como administrador. Se corrigió el envío nativo del formulario que recargaba la página; se detectó además que Auth enviaba ocho dígitos y se indicó ajustar el código a seis antes del acceso exitoso. La transferencia de archivos mediante la API de Storage sigue pendiente de prueba real. Ver `SETUP.md` y `SECURITY.md`.

La exportación PNG se inspeccionó en un navegador real con datos de prueba: imagen de 1080 px de ancho, márgenes iguales y contenido completo desde una vista móvil. La compartición nativa en dispositivos sigue pendiente; los tests de componentes no verifican el menú del sistema operativo.

## Mejoras verificadas el 21 de octubre de 2026

Movimiento sutil con preferencia de movimiento reducido, edición de nombres, integrantes y participación por servicio, revisión compartida y conservación de integrantes históricos. La quinta migración ya está aplicada en producción. Se compararon conteos y huellas de los registros de las 14 tablas antes y después: los tres recibos, el periodo y los tres cálculos previos conservan sus datos. La nueva RPC se comprobó con el rol autenticado dentro de una transacción revertida, sin dejar datos de prueba.

Consultar `REVIEW_SETTINGS.md` para reproducir las pruebas. El editor libre de fórmulas y proporciones queda para una fase posterior.

## Nueva entrega aislada: accesos y correcciones

La rama `codex/member-access-and-receipt-reviews` prepara integrantes con permiso opcional de revisión, invitaciones por correo desde Configuración, solicitudes de corrección e historial, y avisos de cambios con Realtime. La sexta migración y la función de invitaciones no están aplicadas en producción. Ver `REVIEW_ACCESS_AND_CORRECTIONS.md` para alcance, pruebas y validación alojada pendiente. Esta entrega no cambia el algoritmo del reparto ni las exportaciones.

## Fuera del MVP

Alta/baja libre de grupos y servicios, fórmulas o proporciones personalizadas, reapertura de meses, PDF/Excel/CSV, constancias de pago y múltiples adjuntos, recordatorios programados y modo oscuro. No hay integración bancaria automática.
