# Preparar Campiña Gastos

## Desarrollo

El repositorio Git se inicia en la carpeta raíz. No crees otro dentro de `app-campina-gastos`.

Con Node.js 24.15 y npm:

```sh
cd app-campina-gastos
npm ci
npm start
```

Abre `http://127.0.0.1:4200`. Sin Supabase se puede ver el acceso, pero no iniciar una sesión ni cargar datos privados. No hay acceso de demostración ni usuarios precargados.

## Crear y conectar Supabase

1. Crea un proyecto Supabase para el hogar.
2. Conserva la contraseña de PostgreSQL y las claves secretas fuera del repositorio.
3. Obtén la URL y la clave pública publishable (o anon).
4. Copia `app-campina-gastos/.env.example` a `.env` y completa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.
5. Reinicia `npm start` después de modificar `.env`.

`scripts/config.mjs` genera `public/config.json` con la configuración pública. Ambos archivos locales están excluidos de Git. El generador rechaza claves `sb_secret_` y JWT cuyo rol no sea `anon`. Nunca uses `service_role` en el frontend.

## Aplicar migraciones

Con la CLI oficial de Supabase instalada y autenticada, desde la raíz del repositorio:

```sh
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Alternativamente, ejecuta una sola vez y en orden los archivos de `supabase/migrations` mediante SQL Editor. No apliques ambas alternativas sobre una base ya migrada. El proyecto conectado ya tiene las migraciones aplicadas mediante MCP; no vuelvas a instalarlo.

La migración `20261021203521_editable_household_settings` para editar grupos y participantes ya está aplicada al proyecto conectado. No vuelvas a ejecutarla manualmente. Para probar cambios futuros utiliza una instancia de pruebas siguiendo `REVIEW_SETTINGS.md` y comprueba siempre el historial antes de migrar.

Para preparar un solo archivo con todas las migraciones, desde `app-campina-gastos` ejecuta `npm run prepare:supabase`. Copia todo el contenido de `supabase/.temp/setup-campina.sql` en SQL Editor y pulsa Run. El archivo está excluido de Git y envuelve la instalación en una transacción. Úsalo únicamente para la instalación inicial en un proyecto vacío; los archivos de `migrations` siguen siendo la fuente de verdad.

Si instalas un proyecto nuevo mediante SQL Editor y más adelante adoptas la CLI, tras verificar que todas las migraciones se ejecutaron correctamente y enlazar el proyecto, registra su estado con `supabase migration repair --status applied` seguido de las versiones de los archivos realmente aplicados. Luego comprueba `supabase migration list` antes de usar `supabase db push`. No repares el historial del proyecto ya conectado: MCP lo registró y los nombres locales coinciden. [Documentación de Supabase](https://supabase.com/docs/guides/deployment/database-migrations).

Las migraciones crean tablas, restricciones, funciones protegidas, RLS y el bucket privado `receipts`. No insertan recibos ni cuentas de prueba.

## Configurar correo y acceso

En Supabase Auth:

- Deshabilita el registro público.
- Configura SMTP para envío real de correos.
- Establece OTP de seis dígitos, vigencia de 600 segundos y espera de 60 segundos entre envíos.
- Site URL: `http://127.0.0.1:4200` en desarrollo; el dominio definitivo en producción.
- Autoriza `http://127.0.0.1:4200/acceso/confirmar` y `http://localhost:4200/acceso/confirmar` durante el desarrollo. En producción autoriza la URL completa equivalente del dominio definitivo.
- Copia `supabase/templates/magic-link.html` en la plantilla **Magic Link**. Incluye `{{ .Token }}` y el enlace de `{{ .TokenHash }}`.

Ingreso y recuperación usan la misma autenticación sin contraseña. La confirmación requiere pulsar Continuar antes de consumir el enlace para evitar que un escáner de correo lo use automáticamente. No utiliza la plantilla de restablecimiento de contraseña.

En proyectos Free nuevos, el SMTP predeterminado no permite modificar las plantillas: configura SMTP propio antes de copiar la plantilla con OTP. Además, el servicio predeterminado solo envía a miembros autorizados del equipo del proyecto; crear una cuenta en Auth no agrega su correo a ese equipo. [Restricción de plantillas](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), [configuración SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

`supabase/config.toml` configura la instancia local, no aplica estos ajustes automáticamente al proyecto alojado. El MCP conectado permite SQL y migraciones, pero no modifica la configuración de Auth.

## Crear el primer administrador

Crea primero el usuario con su **correo real confirmado** en Supabase Auth mediante sus herramientas administrativas. No actives el registro público para hacerlo.

En SQL Editor, sustituyendo el correo:

```sql
select private.provision_household('TU_CORREO_REAL', 'Hogar Campiña');
```

La función solo puede ejecutarse administrativamente. Crea grupos, integrantes, servicios y reglas del brief. No crea recibos, pagos ni cuentas bancarias. Los nombres de grupos pertenecen al dominio inicial, no a los datos referenciales de las maquetas.

Para otro integrante, crea primero su usuario en Auth y agrega su pertenencia desde SQL Editor:

```sql
insert into public.household_memberships (household_id, user_id, role)
select 'UUID_DEL_HOGAR'::uuid, id, 'viewer'
from auth.users
where lower(email) = lower('CORREO_REAL_DEL_INTEGRANTE');
```

Usa `admin` solo para quienes podrán registrar, modificar reglas y confirmar aportes. Un usuario sin pertenencia activa ve su acceso pendiente.

## Supabase local opcional

Con Docker y la CLI de Supabase disponibles:

```sh
supabase start
supabase db reset
```

La configuración y plantilla están en `supabase/config.toml`. El buzón local está en `http://127.0.0.1:54324`. Usa URL y clave pública de tu instancia local. Crea los usuarios y el hogar con el mismo procedimiento; no hay seed automático.

## Vercel

- Importa el repositorio desde GitHub.
- Root Directory: `app-campina-gastos`.
- Node.js: línea 24 compatible.
- Build Command: `npm run build`.
- Output Directory: `dist/campina-gastos/browser`.
- Variables: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.
- Conecta previews a Supabase de pruebas y Production al proyecto definitivo.
- Actualiza Site URL y las redirecciones de Supabase Auth.

`vercel.json` configura rutas SPA y cabeceras básicas. Verifica un acceso con código y otro con enlace desde el dominio publicado.

## Verificación

Desde `app-campina-gastos`:

```sh
npm run format:check
npm test
npm run test:db
npm run test:upgrade
npm run build
```

Las pruebas PostgreSQL usan PGlite para ejecutar migraciones, roles, RLS y funciones en una base efímera. Simulan los esquemas externos Auth y Storage; no sustituyen la prueba de correo y API de Storage contra Supabase real.

GitHub Actions ejecutará estas comprobaciones al subir el repositorio. No requiere credenciales.

## Validación antes de usar datos familiares

En un proyecto de pruebas, comprobar:

- OTP válido, inválido, expirado y reenvío; enlace desde otro dispositivo.
- Administrador, consulta y correo sin hogar.
- Carga, reemplazo y lectura privada de JPG, PNG y PDF.
- Tres recibos, redondeo, edición concurrente y cierre.
- Aporte confirmado, anulado y cobro posterior al cierre.
- Texto, archivo PNG real y compartir desde Android/iOS y desktop.
- Las diez pantallas en mobile, tablet y desktop, teclado y foco.

La inspección visual y del PNG requieren un navegador habilitado. Compilar y probar componentes no verifica píxeles ni el menú de compartir del sistema operativo.

## Respaldo

Respalda PostgreSQL y objetos de Storage. La copia de la base no incorpora los archivos por sí sola. Conserva rutas y verifica una restauración en pruebas.
