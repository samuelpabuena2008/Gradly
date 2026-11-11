# Modelo: decisiones y hallazgos

Actualizado el 10 de noviembre de 2026. Números de `docs/modelo/reporte.md` (300 estudiantes simulados,
validación cruzada por estudiante).

## Hallazgos

1. **La regresión sobre la malla baja el error un 28 % frente al promedio del estudiante**: MAE 0,292 contra
   0,404 puntos de nota (diferencia −0,112; IC 95 %: −0,125 a −0,100).
2. **La red neuronal no le gana a la regresión**: MAE 0,304 (diferencia +0,012; IC 95 %: +0,009 a +0,016).
   Tampoco con 1.600 estudiantes ni con el simulador no lineal (`figuras/curva_aprendizaje.png`).
3. **Con pocos datos los pesos entre materias no son fiables**: el error medio de un peso es 0,13 con
   50 estudiantes, 0,04 con 400 y 0,015 con 1.600 (`figuras/recuperacion_pesos.png`).
4. **El rango y el semáforo son honestos**: ŷ ± σ contiene la nota real el 68 % de las veces, que es lo esperado.

## Decisiones

1. **La web usa la regresión, no la red.** La red solo se recomendaría si todo su intervalo frente a la
   regresión quedara por debajo de cero; `pesos.json → validacion.recomendado` lo decide en cada entrenamiento.
2. **Se cambió la fórmula de la regresión (por ahora).**
   - Antes: ŷ = ȳ + b + Σ w · (nota previa − ȳ), con los prerrequisitos directos.
   - Ahora: ŷ = μ + b + β · a + Σ w · z, con la media de cada materia (μ), el nivel del estudiante (a) y todos
     los ancestros en la malla.
   - Por qué: en 8 escenarios simulados empata en 4 y gana por 0,005 a 0,008 puntos de nota en los otros 4.
   - Costo: cambió el contrato (`pesos.json` gana `medias`, `k_nivel` y `beta`), `predict.ts`, `predict.py`,
     los fixtures y sus pruebas. Es más difícil de calcular a mano. Con 50 estudiantes puede ser algo peor.
   - Para volver atrás: revertir el commit «Regresión: media por materia, nivel y ancestros».
3. **La red está escrita a mano en NumPy** (`model/gradly_model/red.py`), en reemplazo de la de scikit-learn:
   propagación, retropropagación y Adam se pueden explicar en la sustentación, y una prueba compara el
   gradiente con la derivada numérica. La red conserva la entrada anterior (nota previa − ȳ).
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
