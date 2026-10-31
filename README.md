# Campiña Gastos

Aplicación familiar para registrar agua, luz e internet, distribuir sus importes y compartir un resumen mensual.

## Proyecto

- `app-campina-gastos/`: aplicación Angular standalone, Material 3 y Signals.
- `supabase/`: migraciones, políticas, funciones y pruebas de base de datos.
- `docs/`: arquitectura y preparación del entorno.

## Desarrollo

Requiere Node.js 24.15 o compatible y npm. Consulta `docs/SETUP.md` para configurar Supabase, correo y Vercel.

El proyecto no contiene credenciales, cuentas bancarias reales ni datos de ejemplo cargados automáticamente.

## Verificar

Desde `app-campina-gastos`, ejecuta `npm test`, `npm run test:db` y `npm run build`.

La [guía de configuración](docs/SETUP.md) explica Supabase, el primer administrador y Vercel. Consulta [el estado del MVP](docs/STATUS.md) para distinguir lo implementado de lo pendiente de validar contra servicios reales.
