# Campiña Gastos · Angular

Interfaz familiar con Angular 22, componentes standalone, Signals, Material 3 y SCSS.

## Ejecutar

```sh
npm ci
npm start
```

Visita `http://127.0.0.1:4200`. Para conectar los servicios reales, sigue [la guía de configuración](../docs/SETUP.md).

## Comprobar

```sh
npm run format:check
npm test
npm run test:db
npm run build
```

La compilación de producción queda en `dist/campina-gastos/browser`. Las migraciones están en `../supabase` y el estado de validación en [STATUS.md](../docs/STATUS.md).
