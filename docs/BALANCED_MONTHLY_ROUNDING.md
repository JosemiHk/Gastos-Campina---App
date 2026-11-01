# Redondeo mensual equilibrado

Los empates de mayor resto se compensan entre servicios cuando los grupos tienen exactamente la misma participación en los servicios confirmados del mes. Primero se calculan las cuotas por servicio con mayor resto; después se transfiere un céntimo empatado desde la cuota mensual mayor a la menor, solo cuando su diferencia es al menos dos céntimos. Se mantienen la suma de cada recibo, el aporte fijo y las cuotas inferiores/superiores proporcionales. No se trasladan céntimos entre grupos con reglas distintas.

El orden de desempate es determinista: diferencia mensual mayor, orden estable de grupo donante y receptor, y código de servicio. Cada transferencia reduce la diferencia y cambia los indicadores de redondeo de 1/0 a 0/1. Si hay un céntimo indivisible, la diferencia mínima puede ser un céntimo; no se garantiza igualdad en todos los importes posibles.

Con agua 68.50, luz 167.30, internet 119.00 y aporte 20.00: Gemelas 107.90, Miguel 113.45, JM 113.45 y aporte fijo 20.00. Agua conserva 17.13/17.12 para los individuales y luz compensa con 36.82/36.83. Total 354.80.

El cálculo guarda `roundingPolicy: balanced_monthly_v1` en inputs y resultado. La migración solo cambia funciones, sin recalcular resultados existentes. Los meses cerrados permanecen protegidos. Cada recálculo de un mes abierto crea otro registro y conserva los cálculos anteriores, recibos, adjuntos y pagos.

La previsualización de un recibo considera los demás recibos del mes para mostrar el mismo redondeo que guardará el servidor. Texto y explicación distinguen la nueva política de los cálculos históricos.

Validación: ejemplo familiar en TypeScript y SQL, determinismo ante distinto orden de recibos, matriz de céntimos por servicio, igualdad mínima entre participantes equivalentes, exclusiones, aporte fijo, preservación de pagos/adjuntos e instalación sobre datos existentes. La prueba `test:rounding-upgrade` aplica la migración sobre el esquema anterior y compara los registros completos antes y después.
