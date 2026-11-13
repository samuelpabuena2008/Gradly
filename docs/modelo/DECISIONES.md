# Modelo: decisiones y hallazgos

Actualizado el 13 de noviembre de 2026. Números de `docs/modelo/reporte.md`: 300 estudiantes simulados sobre la
malla oficial, validación cruzada por estudiante.

## Hallazgos

1. **La regresión sobre la malla baja el error un 36 % frente al promedio del estudiante**: MAE 0,294 contra
   0,457 puntos de nota (diferencia −0,163; IC 95 %: −0,178 a −0,149).
2. **La red neuronal mejora con reajuste completo, pero no supera a la regresión**: MAE 0,303 (diferencia +0,008; IC 95 %: +0,006 a +0,011).
   Tampoco con 1.600 estudiantes ni con el simulador no lineal (`figuras/curva_aprendizaje.png`).
3. **La regularización guiada por distancia en el DAG elimina pesos espurios en ancestros lejanos**: al penalizar con $\alpha \cdot 4^{d(p,c)-1}$ según la distancia más corta en el grafo (y $2\alpha$ en aristas blandas), los prerrequisitos directos oficiales concentran el peso real mientras los ancestros indirectos ($d \ge 2$) se encogen limpiamente hacia cero.
4. **Con pocos datos los pesos entre materias no son fiables**: el error medio de un peso es 0,085 con
   50 estudiantes, 0,045 con 400 y 0,026 con 1.600 (`figuras/recuperacion_pesos.png`).
5. **El rango y el semáforo son honestos**: ŷ ± σ contiene la nota real el 68 % de las veces, que es lo esperado.
   El semáforo amarillo/rojo detecta al 97 % de quienes reprueban (AUC 0,96). Reprueba el 2 % de los verdes, el 22 % de los amarillos y el 83 % de los rojos.
6. **La cadena más larga de la malla tiene 9 materias**, de Algoritmia y Programación I a Proyecto Final:
   perder cualquiera de ellas retrasa el grado.

## Decisiones

1. **La web recomienda la regresión por defecto y permite alternar a la red neuronal en vivo.** `pesos.json → validacion.recomendado` selecciona el modelo por defecto, y el encabezado de predicciones ofrece el selector **Regresión / Red neuronal (MLP)** para comparar ambas en tiempo real.
2. **Fórmula de la regresión con regularización por distancia en el DAG.**
   - Ecuación: $\hat{y} = \mu + b + \beta \cdot a + \sum w \cdot z$, con la media de cada materia ($\mu$), el nivel del estudiante ($a$) y todos los ancestros en la malla.
   - Regularización (`train.py:penalizaciones`): el nivel $a$ lleva penalización $0.25\alpha$, los prerrequisitos directos oficiales $\alpha$, las aristas blandas directas $2\alpha$ y los ancestros indirectos a distancia $d \ge 2$ llevan $\alpha \cdot 4^{d-1}$.
3. **La red está escrita a mano en NumPy** (`model/gradly_model/red.py`), en reemplazo de la de scikit-learn:
   propagación, retropropagación y Adam se pueden explicar en la sustentación, una prueba compara el
   gradiente con la derivada numérica, y tras seleccionar la época por parada temprana se reajusta sobre el 100 % de los datos de entrenamiento (`reajuste`).
4. **La red corre en TypeScript y está conectada a la interfaz** (`web/src/lib/model/red.ts`, `PanelPrediccion.tsx`), con el mismo caso de prueba que Python.
5. **Malla oficial con aristas blandas y contenidos cruzados.** `data/malla_sistemas.json` tiene 50 materias, 32 prerrequisitos oficiales, 8 `aristas_blandas` (Álgebra Lineal hacia Física Mecánica, EDO, Física Electricidad, Análisis de Datos I, Soluciones Computacionales y Optimización; Cálculo III hacia Física Electricidad; Discretas hacia Algoritmia y Complejidad) y 26 puentes de `contenidos_cruzados` para mostrar qué temas puntuales repasar cuando una materia sale en amarillo o rojo.
   - Quedan fuera los requisitos de 0 créditos, que no tienen nota: idiomas (`IGL*`), exámenes comprehensivos y seminarios de carrera. El importador de certificados PDF de Uninorte los ignora automáticamente.
   - El correquisito Física Mecánica – Cálculo II queda anotado, pero el modelo no lo usa.
   - Las pruebas siguen usando la malla pequeña en `data/malla_ejemplo.json`.

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
