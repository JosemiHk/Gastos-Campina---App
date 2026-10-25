# Accesos y revisión de recibos

Rama de revisión: `codex/member-access-and-receipt-reviews`.

Implementación local del 25 de octubre de 2026. No se fusionó en `main`, no se desplegó la función ni se aplicó la sexta migración al proyecto de producción. La configuración local real y los archivos personales ajenos a esta entrega permanecen fuera de los commits.

## Comportamiento

- Consulta: lectura y exportación. Integrante: lo anterior, registrar servicios faltantes y solicitar correcciones. Administrador: configuración, accesos, pagos y cierre, además de recibos.
- El permiso adicional `can_review` permite a un integrante aprobar o rechazar correcciones de otras personas. No le concede permisos de administración. Los permisos se consultan en tablas del servidor, no en metadatos editables del usuario ni únicamente en el JWT.
- Configuración muestra Mi cuenta para todos. Las reglas, cuentas de transferencia y gestión de accesos solo se muestran al administrador. Las cuentas de acceso son independientes de los grupos de pago.
- No se borra una identidad desde la aplicación. Se puede desactivar/reactivar su pertenencia al hogar. Para sustituir un correo se invita al nuevo y se desactiva el anterior. No se pueden cambiar permisos con una revisión de acceso antigua ni desactivar/degradar al último administrador.
- Se conserva un recibo por servicio y mes. El integrante registra únicamente uno que falte; cambiar uno existente requiere una solicitud con motivo. Solo se admite una solicitud pendiente por recibo.
- Una solicitud guarda la versión base y las instantáneas anterior/propuesta, sin tocar el recibo ni el reparto. Aprobar actualiza el mismo recibo y recalcula en una transacción; rechazar exige motivo y no modifica importes. Se registra quién solicitó y quién resolvió.
- Una edición directa del administrador exige motivo y queda identificada como edición directa, no como aprobación de una solicitud. Cambiar el recibo o cerrar el mes invalida las propuestas pendientes. Los adjuntos de versiones y propuestas se conservan.
- Las operaciones bloquean el mes durante el guardado y comprueban revisiones. Las propuestas comprueban también la versión del recibo. No se permite resolver dos veces ni resolver solicitudes propias. Cambiar reglas sigue usando el cálculo existente, sin alterar su algoritmo.

## Avisos de cambios

Supabase Realtime escucha cambios de periodos, correcciones y la pertenencia del usuario actual. Con un formulario limpio, agrupa avisos y recarga. Con cambios sin guardar, muestra un aviso y conserva el formulario; actualizar requiere confirmar su descarte. Volver a enfocar una ventana limpia vuelve a consultar el servidor. No se agregaron webhooks ni otro servidor permanente.

La integridad no depende de recibir avisos: la base valida versión y permiso en cada operación. Al desactivar una pertenencia, las nuevas operaciones y lecturas protegidas se rechazan aunque el token todavía no haya vencido. Eso no elimina datos que un navegador ya hubiese descargado.

## Invitaciones

La función `invite-household` valida la sesión con `Auth.getUser` y usa las RPC del usuario para comprobar su permiso administrativo, preparar la invitación y completar el acceso. El cliente administrativo del servidor solo crea/envía invitaciones; no escribe pertenencias saltándose esas comprobaciones.

Se normaliza el correo, se fija la redirección con `APP_URL`, se restringe CORS a su origen y se limitan intentos. Una identidad existente recibe un código OTP sin modificar sus credenciales; una nueva recibe una invitación. Un fallo de envío no completa la pertenencia y permite reintentar con los mismos datos después de un minuto. La cancelación impide completar una invitación pendiente; no retira el correo ya enviado.

`verify_jwt=false` traslada la verificación desde la pasarela a la validación explícita `getUser` del handler, necesaria para soportar las claves y firmas actuales. No significa acceso anónimo: las pruebas comprueban rechazo sin sesión y sin rol de administrador. Las claves privilegiadas se leen del entorno de Edge Functions; nunca se incluyen en Angular ni en Vercel.

## Verificación realizada

Desde `app-campina-gastos`:

```sh
npm test
npm run test:db
npm run test:upgrade
npm run test:collaboration
npm run test:invitations
npm run test:setup
npm run format:check
npm run build
npm run security:check
```

Pasaron 53 pruebas Angular, 25 del funcionamiento previo, 26 de actualización, 26 específicas de colaboración y 8 del handler de invitaciones. La instalación completa también se verificó con PostgreSQL efímero. Las nuevas pruebas cubren conservación de cálculos previos, solicitudes sin efecto financiero, permisos, duplicados, doble resolución, solicitudes propias, revisión antigua, rechazo, cierre, desactivación con sesión vigente, último administrador, aislamiento entre hogares y protección de adjuntos propios/ajenos.

La función de servidor pasó la comprobación de tipos de Deno y sus dependencias están fijadas en `supabase/functions/deno.lock`. CI ejecuta las pruebas nuevas y esa comprobación.

El navegador local usó las migraciones reales con PostgreSQL efímero y Auth simulado. Se verificaron edición de permisos, cancelación de aprobación, aprobación como integrante revisor, recálculo, historial con responsable, Configuración sin opciones administrativas para el integrante y pantalla móvil de 390 px sin desbordamiento horizontal.

Límites: PGlite serializa las consultas y no sustituye una prueba de varias conexiones PostgreSQL reales. El correo, las identidades y el transporte Realtime del entorno local son simulados o se prueban mediante callbacks. La entrega SMTP, el enlace de invitación real, las políticas de Storage por HTTP y los avisos entre dos navegadores necesitan verificarse en un Supabase aislado. No se ejercitaron contra los datos familiares de producción.

## Preparar revisión alojada

1. Utilizar un proyecto Supabase de pruebas. Aplicar las seis migraciones en orden; en uno ya preparado aplicar solo las pendientes. No ejecutar instalación completa ni `db reset` sobre un proyecto con datos reales.
2. Crear un administrador confirmado y aprovisionar el hogar según `SETUP.md`. Configurar correo, Site URL y redirecciones exclusivamente para el dominio de pruebas. Copiar `supabase/templates/invite.html` en la plantilla Invite User, además de mantener la plantilla Magic Link existente.
3. Configurar `APP_URL` en los secretos de la función con el origen exacto de esa web. Las claves públicas/secretas por defecto del proyecto son suministradas por Supabase; la función prioriza `SUPABASE_PUBLISHABLE_KEYS` y `SUPABASE_SECRET_KEYS`, con compatibilidad para las variables heredadas. No copiar claves privilegiadas a variables del frontend.
4. Desplegar únicamente `invite-household` al proyecto de pruebas con la CLI oficial. Revisar RLS, permisos y los asesores de ese proyecto antes de invitar. La migración publica las tablas necesarias en `supabase_realtime` si esa publicación existe; comprobarlo en la configuración de Realtime.
5. Conectar la previsualización de Vercel al proyecto de pruebas, no al hogar de producción. El cliente mantiene deshabilitada la colaboración si el servidor todavía no devuelve `accessEnabled`.
6. Probar invitación nueva y existente, enlace/código, fallo SMTP, reintento/cancelación, revocación y revisión de permisos. Con dos sesiones, intentar registrar el mismo servicio, aprobar simultáneamente y cambiar un recibo mientras otro formulario está abierto. Verificar el aviso sin pérdida del formulario y la denegación de un guardado desactualizado.
7. Probar propuestas con adjuntos por la API de Storage y comprobar que los importes y el historial cerrado se mantienen.

La cuenta cotidiana real de José Miguel todavía no fue creada ni modificada: debe usarse el correo personal que el propietario elija. En la revisión se usaron únicamente correos `example.test`.

La fusión y publicación se harán después de revisar esta rama y autorizar la activación. Antes de actualizar producción, comprobar historial de migraciones, respaldo restaurable administrado por el propietario y conservación de los registros actuales. Después actualizar las pestañas: el cliente anterior no contempla motivos ni permisos nuevos.
