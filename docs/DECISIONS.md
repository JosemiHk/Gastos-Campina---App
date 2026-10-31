# Decisiones de implementación

## Fuentes

El brief, la guía visual y los prototipos originales (mobile y desktop, incluidos login, OTP y recuperación) se conservan como referencias locales, excluidas de Git. Este documento registra las decisiones funcionales; los tokens visuales implementados están en `app-campina-gastos/src/styles.scss`. Los nombres de grupos del brief definen las reglas iniciales; montos, fechas, cuentas y correos de las maquetas son solo referenciales.

## Reparto

- Agua: Gemelas, Miguel y JM, a partes iguales por grupo.
- Luz: aporte especial de Rossana (inicialmente 2000 céntimos); saldo entre los tres grupos.
- Internet: Miguel y JM, a partes iguales. Gemelas excluidas.
- Todas las operaciones monetarias usan enteros en céntimos. Máximo por recibo: S/999,999.99.
- Remanentes: cociente entero y distribución de un céntimo por participante según orden estable Gemelas, Miguel, JM. Nunca usar porcentajes redondeados como fórmula.
- Una luz inferior al aporte fijo no puede confirmarse. Los borradores no entran al reparto.
- Solo un recibo por servicio y periodo. El mes es independiente del vencimiento.

## Periodos y cambios

Un periodo abierto puede estar incompleto. El resumen parcial lo indica. El cierre requiere los tres recibos confirmados y congela recibos, nombres, reglas y asignaciones. Los pagos se registran por separado: cerrar no implica haber cobrado. La reapertura queda fuera del MVP.

Cada escritura financiera valida pertenencia y rol en PostgreSQL, bloquea el periodo y verifica una revisión esperada. Los cambios de reglas afectan el periodo abierto seleccionado y los futuros, nunca periodos cerrados. Los pagos registrados no desaparecen al recalcular.

## Acceso

Sin contraseñas: código de seis dígitos y enlace mágico, solo para usuarios creados/invitados por el administrador. Recuperar acceso utiliza el mismo mecanismo passwordless; no cambia una contraseña inexistente. Administrador: registros y configuración. Consulta: lectura y resúmenes. Un usuario sin hogar no obtiene acceso a datos.

## Alcance

MVP: acceso, seis pantallas, recibos con un adjunto opcional, borradores, cálculo exacto, confirmación/reversión de aportes completos, cierre, historial, datos de transferencia, texto y PNG. El adjunto es opcional para no impedir registrar un gasto cuando no se dispone de foto. Se comunica claramente cuando falta.

Posterior: editor libre de grupos/servicios, reapertura, exportaciones PDF/Excel/CSV, múltiples adjuntos y mensajes automáticos. No hay integraciones bancarias ni envío automático a grupos de WhatsApp.

## Arquitectura

SPA Angular 22, Material 3 y SCSS; frontend en Vercel. Supabase Auth, PostgreSQL y Storage privado. Estado con Signals, formularios reactivos tipados. Cálculo canónico mediante RPC transaccional; previsualización TypeScript sometida a los mismos casos. Sin datos ficticios automáticos ni acceso de demostración en producción.
