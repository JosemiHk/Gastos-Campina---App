# Revisión antes de publicar

Se revisaron los archivos actuales y todos los objetos alcanzables del historial Git, incluidos archivos eliminados en commits posteriores. No se encontraron coincidencias de credenciales. El `public/config.json` de los primeros commits tenía los campos de conexión vacíos.

- `.env` y sus variantes están excluidos. `.env.example` solo contiene placeholders.
- La configuración generada, cachés, dependencias, claves privadas, archivos de credenciales y respaldos están excluidos.
- Los mockups conservan datos referenciales, tal como indicó el propietario del proyecto.
- Git conserva el nombre y correo del autor de cada commit; estos metadatos se publican junto con el historial.

## Comprobación local

Desde `app-campina-gastos`:

```sh
npm run security:check
npm run test:security
```

La auditoría informa solo tipo y ubicación de las coincidencias, sin mostrar los valores. También examina URLs remotas que pudieran llevar credenciales.

Este repositorio tiene hooks de `pre-commit` y `pre-push`: revisan el índice antes de guardar un commit y el historial antes de subirlo. Funcionan con Git y GitHub Desktop mientras Node.js esté disponible y se mantenga la configuración local de hooks.

En un clon nuevo, desde la raíz, activarlos con:

```sh
git config --local core.hooksPath .githooks
```

El control de GitHub Actions también ejecuta la auditoría, pero ocurre después de la subida; no sustituye la comprobación local.

## Revisión de Supabase alojado

Se comprobaron RLS en las 14 tablas, ausencia de permisos anónimos para las operaciones de la aplicación, rechazo de escrituras directas y almacenamiento privado. Se retiró `EXECUTE` de `public.rls_auto_enable()` para `PUBLIC`, `anon` y `authenticated`; su event trigger conserva el funcionamiento administrativo.

Los asesores conservan siete avisos de [RPC con SECURITY DEFINER para usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Son los siete puntos de entrada intencionales de la aplicación: lectura exige pertenencia activa y cada escritura comprueba administrador, hogar y revisión; `search_path` está vacío, los permisos anónimos revocados y los auxiliares internos restringidos. Las pruebas locales cubren consulta y escrituras cruzadas; la instancia alojada se verificó también con roles reales. No se cambia a SECURITY INVOKER porque los clientes no tienen permisos directos de escritura sobre las tablas.

El propietario completó la configuración del correo y confirmó una sesión OTP real. La desactivación del registro público debe comprobarse antes del uso familiar. El asesor también informó que estaba desactivada la [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); el flujo de la aplicación usa OTP, pero la cuenta creada administrativamente conserva la contraseña elegida por su propietario.

La edición añade una RPC protegida de guardado y dos auxiliares privados. No cambia permisos directos sobre tablas ni usa metadatos de usuario para autorizar. Se comprobaron permisos de administrador, rechazo de consulta y accesos cruzados, llamada anónima denegada, revisión global/por mes, validación de JSON y reversión atómica de configuraciones inválidas. Los nuevos auxiliares privados tienen `EXECUTE` revocado para clientes. La migración se aplicó el 21 de octubre de 2026; se verificó la nueva RPC en producción dentro de una transacción revertida y se revisaron nuevamente los asesores.

La comparación de conteos y huellas agregadas confirmó la conservación de los registros previos. No se exportó un respaldo local completo: la revisión automática lo rechazó por incluir información familiar. Esta comprobación de integridad no equivale a un respaldo restaurable.

Los avisos informativos de [claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) quedan registrados para revisar con volumen real y planes de consulta; existen índices para usuario, recibos, cálculos, pagos y actividad. No se eliminaron índices por el aviso de falta de uso en una base recién creada. Esto no constituye una validación de rendimiento a escala.

## Límites de la auditoría

La búsqueda automática reconoce patrones habituales y archivos sensibles. No puede garantizar detectar todas las credenciales posibles ni interpretar texto dentro de imágenes. Antes de agregar nuevos comprobantes o capturas, revisa que no contengan información personal real.

Si alguna credencial real llega a un commit, retirarla del último archivo no la borra del historial. Hay que revocarla o rotarla y revisar la limpieza del historial antes de publicar.
