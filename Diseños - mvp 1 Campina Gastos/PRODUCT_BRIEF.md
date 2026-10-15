# Campiña

## Descripción

Campiña es una aplicación web responsiva diseñada para gestionar y distribuir automáticamente los gastos de servicios de una vivienda familiar.

El objetivo principal es reemplazar los cálculos manuales realizados mediante Excel, WhatsApp y calculadora, permitiendo registrar recibos mensuales y generar automáticamente el reparto correspondiente para cada integrante.

La aplicación debe ser extremadamente simple de usar para personas no técnicas.

---

# Objetivos

- Registrar recibos de agua, luz e internet.
- Calcular automáticamente cuánto debe pagar cada grupo familiar.
- Aplicar reglas especiales de reparto.
- Mantener historial mensual.
- Generar un resumen visual para compartir por WhatsApp.
- Reducir errores humanos en los cálculos.

---

# Grupos de pago

La vivienda tiene 3 grupos de pago:

## Gemelas
- Amy
- Annie

## Miguel
- Denis Miguel

## JM
- José Miguel

---

# Servicios

## Agua
Participan:
- Gemelas
- Miguel
- JM

## Luz
Participan:
- Gemelas
- Miguel
- JM

Regla especial:
- Rossana aporta S/20 fijos por una congeladora.

## Internet (WIN)
Participan:
- Miguel
- JM

Las gemelas están excluidas de este servicio.

---

# Casos de uso principales

## Registrar recibo

Usuario ingresa:

- Servicio
- Monto
- Fecha
- Mes
- Foto del recibo

---

## Calcular distribución

La aplicación calcula automáticamente:

- Participación de cada grupo
- Ajustes especiales
- Totales finales

---

## Generar resumen mensual

Debe generarse un resumen listo para compartir por WhatsApp.

Ejemplo:

Agua: S/90
Luz: S/180
Internet: S/120

Gemelas: S/83.33
Miguel: S/143.33
JM: S/143.33
Rossana: S/20

---

# Requisitos UX

- Mobile First
- Diseño simple
- Material Design 3
- Navegación intuitiva
- Muy pocos clics
- Tipografía clara
- Tarjetas visuales
- Estados fáciles de entender

---

# Requisitos visuales

- Interfaz moderna
- Material Design 3
- Bordes redondeados
- Tarjetas elevadas
- Espaciado cómodo
- Colores suaves
- Estética limpia y premium
- Dashboard elegante pero simple

El modo oscuro será considerado para una versión futura.

---

# Pantallas iniciales

1. Dashboard
2. Registro de recibos
3. Historial mensual
4. Calculadora de distribución
5. Resumen para WhatsApp
6. Configuración de reglas