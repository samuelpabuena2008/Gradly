# Modelo: decisiones y hallazgos

Actualizado el 13 de noviembre de 2026. Números de `docs/modelo/reporte.md`: 300 estudiantes simulados sobre la
malla oficial, validación cruzada por estudiante.

## Hallazgos

1. **La regresión sobre la malla baja el error un 33 % frente al promedio del estudiante**: MAE 0,298 contra
   0,445 puntos de nota (diferencia −0,147; IC 95 %: −0,161 a −0,133).
2. **La red neuronal no le gana a la regresión**: MAE 0,309 (diferencia +0,012; IC 95 %: +0,009 a +0,015).
   Tampoco con 1.600 estudiantes ni con el simulador no lineal (`figuras/curva_aprendizaje.png`).
3. **Con pocos datos los pesos entre materias no son fiables**: el error medio de un peso es 0,085 con
   50 estudiantes, 0,045 con 400 y 0,026 con 1.600 (`figuras/recuperacion_pesos.png`).
4. **El rango y el semáforo son honestos**: ŷ ± σ contiene la nota real el 68 % de las veces, que es lo esperado.
   Reprueba el 2 % de los verdes, el 23 % de los amarillos y el 85 % de los rojos.
5. **La cadena más larga de la malla tiene 9 materias**, de Algoritmia y Programación I a Proyecto Final:
   perder cualquiera de ellas retrasa el grado.

## Decisiones

1. **La web usa la regresión, no la red.** La red solo se recomendaría si todo su intervalo frente a la
   regresión quedara por debajo de cero; `pesos.json → validacion.recomendado` lo decide en cada entrenamiento.
2. **Se cambió la fórmula de la regresión (por ahora).**
   - Antes: ŷ = ȳ + b + Σ w · (nota previa − ȳ), con los prerrequisitos directos.
   - Ahora: ŷ = μ + b + β · a + Σ w · z, con la media de cada materia (μ), el nivel del estudiante (a) y todos
     los ancestros en la malla.
   - Por qué: en 8 escenarios simulados empata en 4 y gana por 0,005 a 0,008 puntos de nota en los otros 4.
   - Costo: cambió el contrato (`pesos.json` gana `medias`, `k_nivel` y `beta`), `predict.ts`, `predict.py`,
     los fixtures y sus pruebas. Es más difícil de calcular a mano.
   - Para volver atrás: revertir el commit «Regresión: media por materia, nivel y ancestros».
3. **La red está escrita a mano en NumPy** (`model/gradly_model/red.py`), en reemplazo de la de scikit-learn:
   propagación, retropropagación y Adam se pueden explicar en la sustentación, y una prueba compara el
   gradiente con la derivada numérica. La red conserva la entrada anterior (nota previa − ȳ).
4. **La red ya corre en TypeScript** (`web/src/lib/model/red.ts`), con el mismo caso de prueba que Python.
   No está conectada a la interfaz: eso lo decide el frente web.
5. **Malla oficial desde el 13 de noviembre.** `data/malla_sistemas.json` sale del diagrama del plan de estudios:
   50 materias y 32 prerrequisitos.
   - Quedan fuera los requisitos de 0 créditos, que no tienen nota: idiomas, exámenes comprehensivos y
     seminarios de carrera. Por eso faltan dos prerrequisitos de Proyecto Final.
   - No tiene aristas blandas: no inventamos relaciones que el plan no muestra.
   - El correquisito Física Mecánica – Cálculo II queda anotado, pero el modelo no lo usa.
   - Las pruebas siguen usando la malla pequeña, ahora en `data/malla_ejemplo.json`.

## Límites

- Las notas son **simuladas**: prueban que el método funciona y recupera pesos conocidos, no qué tan bien
  predice notas reales.
- Los pesos son asociaciones, no causas.
- Las electivas entran como una sola materia genérica cada una.

## Pendiente

- Notas reales: con menos de unos 400 estudiantes sirven para calibrar y probar, no para entrenar los pesos.
- Que alguien del grupo confirme los prerrequisitos contra el diagrama: se leyeron de la imagen.

## Cómo regenerar

```bash
cd model
python -m gradly_model.train          # data/pesos.json
python -m gradly_model.experimentos   # docs/modelo/reporte.md, experimentos.json y figuras (≈1 min)
```
