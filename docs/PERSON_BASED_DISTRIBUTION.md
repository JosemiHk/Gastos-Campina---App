# Reparto por personas: ejecución en dos fases

## Fase 1 — motor y migración local (completada)

Rama: `codex/person-based-distribution`, basada en main. No incorpora la rama pendiente de accesos y correcciones.

- Pesos enteros entre 1 y 10 por participante, servicio y versión de regla. Las cuentas de acceso y los nombres no determinan el peso.
- Compatibilidad: peso 1 por defecto conserva el reparto anterior. La migración no activa 2:1:1, no recalcula periodos ni cambia resultados existentes.
- Motor TypeScript y SQL: cuota base entera y asignación de céntimos por mayor resto; empates por orden estable del grupo. SQL usa bigint para multiplicar sin desbordamientos.
- El aporte fijo se descuenta antes del reparto de luz. Internet conserva sus participantes y pesos propios.
- Los nuevos cálculos guardan los pesos usados en inputs y resultado; los anteriores permanecen intactos.
- La prueba SQL usa transacciones locales con rollback. No se han cambiado datos en Supabase ni se ha desplegado.

Ejemplo (agua 68.50, luz 167.30, internet 119.00, aporte 20.00): con pesos de agua/luz 2:1:1 e internet 1:1, las cuotas son 107.90, 113.46, 113.44 y 20.00. Total: 354.80. Los empates repetidos explican dos céntimos de diferencia entre los grupos individuales. No se redondea cada persona antes de agrupar.

## Fase 2 — integración completada localmente

- Configuración mantiene los grupos y el diseño existente. Cada servicio seleccionado permite indicar personas / partes entre 1 y 10. Editar integrantes o cuentas de acceso no altera esos valores.
- El administrador selecciona el mes en el selector existente. Guardar crea una versión para ese mes abierto y la usa como base para meses aún no creados. Los otros meses existentes conservan su versión. Si hay recibos confirmados y cambia el reparto, se pide confirmación antes del recálculo.
- La previsualización de recibos, tarjetas y explicación del cálculo usan los pesos del periodo, no los actuales del hogar. Resúmenes de texto y PNG muestran la proporción usada. Los resultados históricos sin pesos se interpretan como reparto igual entre sus participantes originales.
- RPC nueva `save_weighted_household_settings`: autorización de administrador, bloqueo del periodo, revisión del mes y configuración del hogar, validación del JSON y pesos. Nunca reemplaza recibos ni archivos para cambiar reglas.
- Las RPC anteriores `save_household_settings` y `save_settings` conservan los pesos al crear versiones. Los grupos recién seleccionados por clientes antiguos reciben una parte.
- Migración `20261101191741_weighted_distribution_settings.sql`: integra las lecturas y escrituras sin modificar filas financieras existentes. La migración de fase 1 añade la columna con peso 1; ninguna activa 2:1:1 automáticamente.

## Validación

- Pruebas Angular de pesos, formularios, cancelación, previsualización, persistencia y resúmenes históricos, además de la suite existente.
- SQL local en PGlite: instalación limpia, actualización anterior y actualización desde las cinco migraciones que tiene main. La prueba de actualización ponderada compara filas completas de recibos, periodos, cálculos, cuotas, pagos, cuentas de transferencia, actividad y objetos de Storage antes/después: deben ser idénticas.
- Prueba de activación: tres recibos, PDF adjunto y pago; cambio a 2:1:1; preservación exacta de recibos y pagos, archivo presente, otros meses intactos. Comprueba clientes anteriores, pesos inválidos, revisiones desactualizadas, consulta, otro hogar y meses cerrados.
- Navegador local con SQL real en PGlite y Auth simulado: acceso de administrador, cambio de personas en octubre, confirmación, recarga, cuotas y explicación 2:1:1, generación de PNG habilitada y pantalla móvil de 390 × 844 sin desbordamiento horizontal.
- Las pruebas no utilizan datos de la nube. PGlite serializa operaciones; no sustituye una prueba de concurrencia con dos conexiones PostgreSQL reales. No se cambió el protocolo de bloqueo existente.

Resultados: 50 pruebas Angular; 27 comprobaciones SQL de instalación; 28 de actualización anterior y 28 desde el esquema actual; 5 pruebas de seguridad. Compilación, formato y auditoría de credenciales correctos.

## Publicación y activación pendientes

1. Revisar el diff y los checks de esta rama. No mezclar aún `codex/member-access-and-receipt-reviews`: su migración también cambia `get_household` y sus permisos. Antes de fusionarla habrá que reconciliar explícitamente sus funciones y ejecutar las pruebas conjuntas. Esta entrega está basada en main y no incorpora esa funcionalidad.
2. Antes de aplicar migraciones, verificar las versiones realmente aplicadas en Supabase. No ejecutar el archivo de instalación completa sobre un proyecto existente.
3. Obtener contadores y huellas agregadas de las tablas financieras y objetos de Storage, sin exportar datos personales. Aplicar únicamente las dos migraciones nuevas, en orden, y comparar las huellas inmediatamente después, antes de activar o registrar nuevos datos. Ninguna debería cambiar.
4. Publicar el frontend. La configuración antigua sigue admitida por las RPC compatibles; no es necesario borrar tablas, reiniciar la base o volver a subir recibos.
5. Elegir explícitamente el mes inicial. En Configuración, con ese mes abierto seleccionado: agua y luz con 2 partes para Amy y Annie, 1 para Denis y 1 para José Miguel; internet con 1 para cada participante actual. Conservar el aporte especial de luz. Guardar y confirmar el recálculo si ya hay recibos.
6. Verificar IDs, importes y adjuntos de los recibos, pagos y resumen del mes; comprobar un mes anterior. Los saldos pueden cambiar por las nuevas cuotas, pero las confirmaciones de pago permanecen.
7. Si hubiera un problema de interfaz, volver al frontend anterior conserva las reglas guardadas gracias a las RPC compatibles. Los clientes anteriores pueden seguir mostrando previsualizaciones iguales: evitar nuevas ediciones hasta restaurar el frontend actualizado. No eliminar la columna de pesos ni borrar versiones para deshacer un despliegue. Revertir un acuerdo de reparto requiere guardar otra versión explícita en el mes abierto.

Estado: desarrollo local completado, sin push, merge, migración remota ni despliegue de producción por parte del agente durante esta fase. El mes de activación todavía debe elegirse; no se toma automáticamente de la fecha actual.
