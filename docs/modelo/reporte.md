# Resultados del modelo

Fuente de datos: simulado (300 estudiantes). Malla: versión «oficial». Validación cruzada por estudiante (5 particiones), 7800 notas evaluadas.

> Estos números salen de datos **simulados** sobre la malla: muestran que el método funciona y recupera pesos conocidos, no qué tan bien predice notas reales.

| Modelo | MAE (puntos de nota) | Precisión de riesgo | Recall de riesgo |
| --- | --- | --- | --- |
| Promedio del estudiante | 0,457 | 0,82 | 0,52 |
| Regresión sobre la malla | 0,294 | 0,83 | 0,85 |
| Red neuronal | 0,303 | 0,85 | 0,83 |

"Riesgo" = nota real menor que la de aprobación; el modelo alerta cuando predice menos que eso.

## Comparación entre modelos

- Regresión frente al promedio del estudiante: -0,163 (IC 95 %: -0,178 a -0,149).
- Red neuronal frente a la regresión: 0,008 (IC 95 %: 0,006 a 0,011).

Diferencia de MAE; negativo significa que el primero se equivoca menos. El intervalo se calcula remuestreando estudiantes completos.

**Modelo recomendado: regresión sobre la malla.** La red solo se recomienda si todo su intervalo frente a la regresión queda por debajo de cero.

## Rango y semáforo (modelo recomendado)

- El rango ŷ ± σ contiene la nota real el 68 % de las veces (lo esperado es 68 %).
- El semáforo en amarillo o rojo detecta al 97 % de quienes reprueban (AUC 0,96).
- Verde: 3932 predicciones; reprobó de verdad el 2 %.
- Amarillo: 1278 predicciones; reprobó de verdad el 22 %.
- Rojo: 2590 predicciones; reprobó de verdad el 83 %.
