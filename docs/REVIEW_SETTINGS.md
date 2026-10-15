# Revisión de grupos, servicios y movimiento

Rama: `codex/editable-household-settings`.

## Alcance

- Animaciones de entrada de 220 ms, menú de 140 ms y respuesta breve al pulsar botones. Sin dependencias nuevas, animaciones continuas ni demoras al navegar. Se respeta `prefers-reduced-motion`.
- Edición del nombre de los cuatro grupos existentes y sus integrantes, de uno a diez por grupo. Nombres de hasta 80 caracteres, sin vacíos ni duplicados dentro de un grupo. Estos integrantes son etiquetas familiares: no crean cuentas ni cambian permisos de acceso.
- Selección de los grupos regulares que pagan agua, luz e internet. Cada servicio necesita al menos uno. El saldo se divide en partes iguales y el orden de redondeo permanece estable.
- El grupo de aporte especial mantiene su papel en la luz, aunque cambie su nombre. El importe fijo sigue siendo editable.
- Se muestran participantes y nombres reales en previsualización, cuotas, fórmulas y resúmenes de texto e imagen.

No se agregan ni eliminan grupos ni servicios. Un editor de porcentajes, ponderaciones o fórmulas queda para una fase posterior: necesita definir validación y migración de reglas, y diseñar su explicación para usuarios no técnicos.

## Historial y concurrencia

El guardado crea una nueva versión de reglas para el mes seleccionado y para meses que todavía no existen. Los otros meses abiertos conservan sus reglas hasta que se actualicen expresamente. Los pagos recibidos se conservan; pueden aparecer saldos a favor después de un recálculo. Cambiar la participación con recibos confirmados pide confirmación.

Los nombres actuales pertenecen al hogar. Los nombres e integrantes de cada cálculo se guardan también como instantánea. Los meses cerrados conservan importes, participantes y etiquetas históricos. La migración completa las instantáneas de integrantes de los cálculos existentes antes de permitir la primera edición.

Además de la revisión del mes, existe una revisión compartida de la configuración: una pestaña o mes con datos antiguos no puede sobrescribir otro guardado del hogar. El guardado anterior de aporte/cuentas sigue disponible y también avanza esa revisión.

## Cómo probar sin modificar producción

No se aplicó la quinta migración al proyecto alojado ni se fusionó esta rama en `main`.

1. Ejecutar desde `app-campina-gastos`: `npm ci`, `npm test`, `npm run test:db`, `npm run test:upgrade`, `npm run test:setup`, `npm run build` y `npm run security:check`.
2. Para revisión visual, usar una instancia Supabase de pruebas o local. Aplicar las migraciones de esta rama, crear un administrador y aprovisionar su hogar siguiendo `SETUP.md`.
3. Configurar la URL y clave pública de pruebas en el entorno local o Preview de Vercel. No conectar una previsualización editable al hogar real.
4. Revisar desktop y móvil, teclado, movimiento reducido y navegación rápida. Renombrar un grupo, agregar/quitar integrantes y activar internet para otro grupo.
5. Comprobar previsualización y resultado guardado con céntimos no divisibles, excluir todos los grupos para ver la validación y cancelar el diálogo de recálculo.
6. Verificar un mes cerrado antes y después de editar otro mes, dos pestañas con cambios en meses diferentes, perfil consulta y resumen PNG real.

En una base sin la nueva migración, la edición ampliada permanece deshabilitada y sigue funcionando el guardado anterior de aporte y cuentas. Esto permite revisar la rama sin obligar a actualizar producción.

Las pruebas automatizadas usan componentes y PostgreSQL efímero. La prueba de actualización crea primero un hogar con datos y un mes cerrado usando el esquema anterior; aplica después la nueva migración y comprueba su conservación. No sustituyen la inspección visual, entrega de correos ni subida real de adjuntos.

## Activación después de aprobar

Respaldar la base. Aplicar únicamente la migración pendiente mediante la CLI enlazada al proyecto correcto, comprobar el historial y publicar la rama aprobada. No ejecutar de nuevo la instalación inicial completa sobre producción.

Actualizar las pestañas de los usuarios antes de editar participantes. Después de usar reglas personalizadas, no volver sin revisión al cliente anterior: sus textos y previsualización todavía asumen el reparto inicial, aunque el servidor conserve el cálculo canónico.

La revisión y el merge quedan a cargo del propietario; no se publicaron estos cambios en la web de producción.
