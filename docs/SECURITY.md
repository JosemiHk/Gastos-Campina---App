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

## Alcance

La búsqueda automática reconoce patrones habituales y archivos sensibles. No puede garantizar detectar todas las credenciales posibles ni interpretar texto dentro de imágenes. Antes de agregar nuevos comprobantes o capturas, revisa que no contengan información personal real.

Si alguna credencial real llega a un commit, retirarla del último archivo no la borra del historial. Hay que revocarla o rotarla y revisar la limpieza del historial antes de publicar.
