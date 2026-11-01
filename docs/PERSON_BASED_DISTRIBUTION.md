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

## Fase 2 — integración y activación (pendiente, no iniciada)

1. Exponer pesos versionados en get_household y tipos; usar los pesos del periodo en las previsualizaciones.
2. Añadir la edición de personas por grupo conservando el diseño, con validaciones del lado del servidor y revisiones para cambios simultáneos.
3. Actualizar TODAS las rutas que crean versiones (save_household_settings y save_settings): hoy sus INSERT omiten weight y producirían peso 1. Deben conservar pesos explícitamente. No activar reglas ponderadas antes de resolverlo.
4. Actualizar textos de configuración, tarjetas, distribución, historial y exportaciones para explicar proporciones reales.
5. Elegir explícitamente el primer mes de aplicación. Conservar versiones previas y bloquear meses cerrados. No inferir el mes de activación de la fecha actual.
6. Probar el flujo completo, compatibilidad con clientes anteriores y coexistencia con la rama de accesos/correcciones. Revisar diferencias de migraciones antes de fusionar ambas ramas.
7. Revisar y autorizar la activación antes de migrar o desplegar producción.

La fase 1 es una base técnica para revisión, no una entrega desplegable del flujo por personas. No hacer merge ni desplegar automáticamente.
