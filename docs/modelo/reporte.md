# Resultados del modelo

Fuente de datos: simulado (300 estudiantes). Malla: versión «ejemplo». Validación cruzada por estudiante (5 particiones), 3600 notas evaluadas.

> Estos números salen de datos **simulados** sobre una malla de ejemplo: muestran que el método funciona y recupera pesos conocidos, no qué tan bien predice notas reales.

| Modelo | MAE (puntos de nota) | Precisión de riesgo | Recall de riesgo |
| --- | --- | --- | --- |
| Promedio del estudiante | 0,404 | 0,82 | 0,50 |
| Regresión sobre la malla | 0,292 | 0,81 | 0,80 |
| Red neuronal | 0,304 | 0,83 | 0,76 |

"Riesgo" = nota real menor que la de aprobación; el modelo alerta cuando predice menos que eso.

## Comparación entre modelos

- Regresión frente al promedio del estudiante: -0,112 (IC 95 %: -0,125 a -0,100).
- Red neuronal frente a la regresión: 0,012 (IC 95 %: 0,009 a 0,016).

Diferencia de MAE; negativo significa que el primero se equivoca menos. El intervalo se calcula remuestreando estudiantes completos.

**Modelo recomendado: regresión sobre la malla.** La red solo se recomienda si todo su intervalo frente a la regresión queda por debajo de cero.

## Rango y semáforo (modelo recomendado)

- El rango ŷ ± σ contiene la nota real el 68 % de las veces (lo esperado es 68 %).
- El semáforo en amarillo o rojo detecta al 94 % de quienes reprueban (AUC 0,95).
- Verde: 2082 predicciones; reprobó de verdad el 3 %.
- Amarillo: 604 predicciones; reprobó de verdad el 22 %.
- Rojo: 914 predicciones; reprobó de verdad el 81 %.
