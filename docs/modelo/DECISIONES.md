# Modelo: decisiones y hallazgos

Actualizado el 10 de noviembre de 2026. Números de `docs/modelo/reporte.md` (300 estudiantes simulados,
validación cruzada por estudiante).

## Hallazgos

1. **La regresión sobre la malla baja el error un 25 % frente al promedio del estudiante**: MAE 0,301 contra
   0,404 puntos de nota (diferencia −0,103; IC 95 %: −0,115 a −0,091).
2. **La red neuronal no le gana a la regresión**: MAE 0,304 (diferencia +0,003; IC 95 %: +0,001 a +0,005).
   Tampoco con 1.600 estudiantes ni con el simulador no lineal (`figuras/curva_aprendizaje.png`).
3. **Con pocos datos los pesos entre materias no son fiables**: el error medio de un peso es 0,13 con
   50 estudiantes, 0,04 con 400 y 0,015 con 1.600 (`figuras/recuperacion_pesos.png`).
4. **El rango y el semáforo son honestos**: ŷ ± σ contiene la nota real el 67 % de las veces (se espera 68 %).
   Reprueba el 3 % de los verdes, el 24 % de los amarillos y el 84 % de los rojos.

## Decisiones

1. **La web sigue usando la regresión.** La red solo se recomendaría si todo su intervalo frente a la regresión
   quedara por debajo de cero; `pesos.json → validacion.recomendado` lo decide en cada entrenamiento.
2. **La red está escrita a mano en NumPy** (`model/gradly_model/red.py`), en reemplazo de la de scikit-learn:
   propagación, retropropagación y Adam se pueden explicar en la sustentación, y una prueba compara el
   gradiente con la derivada numérica.
3. **El contrato de datos no cambia.** `pesos.json` conserva `cursos` igual y gana dos bloques opcionales:
   `red` (pesos de la red) y `validacion`. La web actual no los lee.
4. **La red ya corre en TypeScript** (`web/src/lib/model/red.ts`, paso 8 del plan), con el mismo caso de prueba
   que Python. No está conectada a la interfaz: eso lo decide el frente web.

## Límites

- Todo sale de **datos simulados sobre la malla de ejemplo**: prueba que el método funciona, no qué tan bien
  predice notas reales.
- Los pesos son asociaciones, no causas.

## Pendiente

- **Malla oficial (paso 7).** `malla_oficial_borrador.json` trae las 54 materias del
  [plan de estudios oficial](https://guayacan02.uninorte.edu.co/4PL1CACI0N35/PlandeEstudio/index.php?id=PINGSISTEMAS)
  con sus códigos y semestres. Faltan los créditos y verificar los prerrequisitos, que son inferidos; después
  hay que pasarla al formato de `data/malla_sistemas.json` y reentrenar.
- Notas reales: con menos de unos 400 estudiantes sirven para calibrar y probar, no para entrenar los pesos.

## Cómo regenerar

```bash
cd model
python -m gradly_model.train          # data/pesos.json
python -m gradly_model.experimentos   # docs/modelo/reporte.md, experimentos.json y figuras (≈1 min)
```
