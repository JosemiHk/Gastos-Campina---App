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

El proyecto Supabase está creado y la URL y clave pública quedaron configuradas exclusivamente en archivos locales excluidos de Git. La consulta pública de Auth respondió HTTP 200; la función `get_household` todavía no está instalada (PGRST202). Falta aplicar las migraciones, desactivar el registro público, configurar el correo y crear el administrador. No se han verificado sesiones ni Storage contra la instancia real. El repositorio ya tiene un remoto de GitHub; Vercel sigue pendiente.

El usuario indicó el nombre y correo del primer administrador. La solicitud se conserva exclusivamente en `supabase/.temp/admin-request.json`, excluido de Git; no significa que la cuenta ya exista. Se sugirió la integración Supabase para obtener acceso administrativo sin compartir claves secretas. Está pendiente de que el usuario complete la autorización.

La exportación PNG está implementada y requiere inspección del archivo generado en un navegador real, junto con las pruebas de compartición en dispositivos. Los tests de componentes verifican contenido y comportamiento, no píxeles.

## Fuera del MVP

Editor libre de grupos y servicios, reapertura de meses, PDF/Excel/CSV, constancias de pago y múltiples adjuntos, recordatorios programados y modo oscuro. No hay integración bancaria automática.
