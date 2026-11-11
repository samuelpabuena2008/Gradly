# Gradly: Predictor de Rendimiento Académico basado en Teoría de Grafos

**Asignatura:** Matemáticas Discretas  
**Docente:** Prof. Iván Gómez Gómez  
**Institución:** Departamento de Ingeniería de Sistemas, Universidad del Norte (Barranquilla, Colombia)  
**Integrantes:** Rafael Sierra Molina, Carlos Del Castillo Mercado, Maikel Ortiz Vizcaíno, Samuel Pabuena García, Joel Trespalacios Peralta  
**Fecha:** Noviembre 2026  

---

## 1. Descripción del Proyecto

**Gradly** es un sistema de predicción de rendimiento académico y alerta temprana de autoservicio para estudiantes de pregrado de **Ingeniería de Sistemas** en la **Universidad del Norte**.

A diferencia de los sistemas institucionales tradicionales, Gradly coloca el poder analítico directamente en manos del estudiante: antes de inscribir sus asignaturas para el siguiente período académico, el estudiante puede visualizar su malla curricular, comprender su nivel de riesgo por asignatura (mediante un semáforo interactivo) y recibir recomendaciones precisas sobre qué prerrequisitos conceptuales debe repasar (explicabilidad de predicción).

El núcleo formal del proyecto modela la malla curricular como un **Grafo Dirigido Acíclico (DAG)** y aplica los fundamentos teóricos del curso de **Matemáticas Discretas** (ordenación topológica, caminos más largos, centralidad, conectividad y clausura transitiva) acoplados a un modelo predictivo lineal centrado por estudiante (*row-centering*).

---

## 2. Fundamentación en Matemáticas Discretas

### 2.1 Modelado Formal del Grafo Curricular
El plan de estudios se define como un grafo dirigido:
$$G = (V, E)$$
- **Vértices ($V$):** Conjunto de $40$ asignaturas del plan de estudios. Cada vértice $v \in V$ posee atributos: código institucional, nombre, créditos académicos, semestre recomendado, área del conocimiento y dificultad base ($b_c$).
- **Aristas Dirigidas ($E$):** Relaciones de precedencia $u \to v$, denotando que la asignatura $u$ condiciona o influye conceptualmente en la asignatura $v$. Se diferencian dos tipos:
  1. **Aristas Oficiales ($E_{\text{oficial}}$):** Prerrequisitos formales del reglamento académico de Uninorte.
  2. **Aristas Blandas ($E_{\text{blanda}}$):** Relaciones de conocimiento subyacentes identificadas en la literatura que actúan como prerrequisitos ocultos (por ejemplo: de *Álgebra Lineal* a *Ecuaciones Diferenciales*, o de *Álgebra Lineal* a *Inteligencia Artificial*).

---

### 2.2 Algoritmos de Grafos Implementados

#### A. Verificación de Grafo Dirigido Acíclico (DAG) y Detección de Ciclos
- **Teorema:** Un grafo dirigido $G$ es un DAG si y solo si no contiene ningún ciclo dirigido simple.
- **Algoritmo:** Implementación del método de coloreado en profundidad (DFS) con 3 estados:
  - *Blanco (0):* Vértice aún no explorado.
  - *Gris (1):* Vértice en la pila de recursión actual (ancestro activo).
  - *Negro (2):* Vértice y todo su subárbol completamente explorados.
- **Detección:** Si se encuentra una arista dirigida hacia un nodo Gris, se ha detectado una *Back-Edge* que conforma un ciclo cerrado. La malla curricular de Uninorte fue verificada formalmente con **0 ciclos**.

#### B. Orden Topológico (Algoritmo de Kahn)
- **Definición:** Una ordenación lineal $L = (v_1, v_2, \dots, v_{|V|})$ de los vértices tal que para cada arista dirigida $(u, v) \in E$, $u$ aparece estrictamente antes que $v$ ($pos(u) < pos(v)$).
- **Algoritmo de Kahn:** Basado en una cola de vértices con grado de entrada cero ($d_{in}(v) = 0$), reduciendo secuencialmente los grados de sus vecinos.
- **Estratificación por Niveles:** Determina la distancia máxima desde cualquier nodo raíz, estableciendo el semestre teórico más temprano en que un estudiante puede inscribir cada asignatura.

#### C. Camino Más Largo y Camino Crítico (Critical Path Method - CPM)
- **Propiedad Discreta:** Mientras que el problema del camino más largo es NP-hard en grafos dirigidos generales, en un **DAG** admite solución exacta y eficiente en tiempo lineal $O(|V| + |E|)$ mediante programación dinámica sobre el orden topológico:
  $$L(v) = \begin{cases} 0 & \text{si } d_{in}(v) = 0 \\ \max_{u \in pred(v)} (L(u) + w(u, v)) & \text{en otro caso} \end{cases}$$
- **Holgura (Slack):** Diferencia entre el tiempo de inicio más tardío y más temprano. Los nodos con $\text{Slack}(v) = 0$ forman el **Camino Crítico**.
- **Impacto Académico:** El camino crítico define la secuencia de dependencias más extensa (8 niveles). **Reprobar cualquier materia en este camino retrasa automáticamente el semestre mínimo de graduación**.

#### D. Análisis de Centralidad y Cuellos de Botella
Se calcularon métricas estructurales para identificar puntos débiles de la malla:
- **Grado de Salida ($d_{out}(v)$):** Número de asignaturas que desbloquea directamente (*materias llave/habilitadoras* como *Cálculo 2* y *Estructuras de Datos*).
- **Grado de Entrada ($d_{in}(v)$):** Número de prerrequisitos inmediatos requeridos (*materias integradoras* como *Arquitectura de Computadores* y *Sistemas Distribuidos*).
- **Centralidad de Intermediación (Betweenness Centrality):**
  $$C_B(v) = \sum_{s \ne v \ne t} \frac{\sigma_{st}(v)}{\sigma_{st}}$$
  Mide con qué frecuencia un nodo actúa como puente forzoso en los caminos del plan de estudios (*cuellos de botella estructurales*).
- **Closeness Centrality y PageRank:** Miden la accesibilidad e influencia global en la red curricular.

#### E. Alcance e Impacto en Cascada (Clausura Transitiva)
- Para cada vértice $v$, se evalúa el conjunto de descendientes alcanzables:
  $$\text{Desc}(v) = \{u \in V \mid v \rightsquigarrow u\}$$
- Permite calcular el **impacto en cascada** ante la pérdida de una asignatura: número de materias bloqueadas a corto y largo plazo, y créditos académicos congelados. Por ejemplo, la reprobación de *Cálculo 1* bloquea directamente 3 materias y en cascada a **28 asignaturas (91 créditos)**.

---

## 3. Modelo Matemático Predictivo

Siguiendo la Sección 2.2 del informe del proyecto, la predicción de calificación se fundamenta en la literatura de *grade prediction* utilizando el historial académico centrado respecto al promedio del estudiante (*row-centering*):

$$\hat{y}_{s,c} = b_c + \sum_{p \in prev(c)} w_{p \to c} \cdot (y_{s,p} - \bar{y}_s) + \bar{y}_s$$

### Variables de la Ecuación:
- $\hat{y}_{s,c}$: Calificación predicha para el estudiante $s$ en la materia objetivo $c$ (acotada al rango institucional $[0.0, 5.0]$).
- $b_c$: Parámetro de sesgo / dificultad intrínseca de la asignatura $c$.
- $prev(c)$: Conjunto de prerrequisitos inmediatos (predecesores) de $c$ en el grafo $G$.
- $w_{p \to c}$: Peso de transferencia de conocimiento del prerrequisito $p$ hacia $c$.
- $y_{s,p}$: Calificación real obtenida por el estudiante en el prerrequisito $p$.
- $\bar{y}_s$: Promedio acumulado histórico del estudiante.
- $(y_{s,p} - \bar{y}_s)$: Desempeño relativo del estudiante en el prerrequisito en comparación con su rendimiento habitual.

### Explicabilidad y Atribución (XAI):
El impacto individual de cada prerrequisito se descompone como:
$$\Delta_{p \to c} = w_{p \to c} \cdot (y_{s,p} - \bar{y}_s)$$
Permitiendo generar diagnósticos automáticos en lenguaje natural:
> *"Tu predicción en Ecuaciones Diferenciales (3.02) baja sobre todo por tu rendimiento previo en Cálculo 2 (nota: 3.0, impacto: -0.63 pts)."*

### Semáforo de Riesgo Académico:
- 🟢 **VERDE (Bajo Riesgo):** $\hat{y}_{s,c} \ge 3.5$
- 🟡 **AMARILLO (Riesgo Moderado):** $3.0 \le \hat{y}_{s,c} < 3.5$
- 🔴 **ROJO (Alto Riesgo / Alerta de Reprobación):** $\hat{y}_{s,c} < 3.0$ (Umbral de aprobación en Uninorte es 3.0)

---

## 4. Estructura del Repositorio

```
GrafoDiscretas/
├── data/
│   ├── malla_uninorte.json          # Definición estructurada en JSON (nodos y aristas)
│   ├── malla_uninorte_nodos.csv     # Exportación tabular de asignaturas
│   └── malla_uninorte_aristas.csv   # Exportación tabular de aristas y pesos
├── src/
│   ├── __init__.py
│   ├── curriculum.py                # Clases Course, Edge y CurriculumDataset
│   ├── graph_core.py                # Algoritmos de Grafos (DAG, Kahn, CPM, Centralidad, Cascada)
│   ├── model.py                     # Ecuación (1), Semáforo, Explicabilidad y Baseline
│   ├── simulation.py                # Generador de cohortes y casos sintéticos
│   └── visualization.py             # Renderizado de figuras de alta resolución (300 DPI)
├── export/                          # Figuras y diagramas exportados
│   ├── 1_malla_curricular_dag.png
│   ├── 2_camino_critico_graduacion.png
│   ├── 3_centralidad_cuellos_botella.png
│   ├── 4_impacto_cascada_CALC1.png
│   └── 5_explicabilidad_prediccion_EDO.png
├── tests/
│   └── test_graph_and_model.py      # Pruebas unitarias de teoremas y fórmulas
├── run_analysis.py                  # Pipeline completo de ejecución analítica
├── consultar_estudiante.py          # Script interactivo de diagnóstico personalizado
└── README.md                        # Documentación técnica y académica
```

---

## 5. Instrucciones de Ejecución

### Prerrequisitos:
El proyecto utiliza Python 3.12 y las librerías `networkx`, `matplotlib`, `pandas`, `numpy`. Todo el entorno se encuentra preconfigurado en la carpeta `.venv/`.

### 1. Ejecutar el Pipeline Completo de Análisis:
```bash
.\.venv\Scripts\python.exe run_analysis.py
```
Este comando ejecuta:
1. Carga y validación de la malla como DAG.
2. Cálculo de orden topológico y niveles de precedencia.
3. Identificación del camino crítico de graduación (CPM).
4. Tablas de centralidad (betweenness, in-degree, out-degree).
5. Simulaciones de reprobación en cascada.
6. Entrenamiento y validación estadística contra el *baseline* trivial ($\hat{y} = \bar{y}_s$), reportando MAE, RMSE y métricas de clasificación (Accuracy, Precision, Recall, F1).
7. Caso de estudio individual con semáforo y explicabilidad.
8. Generación de las 5 figuras en la carpeta `export/`.

### 2. Probar el Diagnóstico Interactivo de un Estudiante:
```bash
.\.venv\Scripts\python.exe consultar_estudiante.py
```
Permite ingresar un perfil de calificaciones previas y entrega la predicción, el color del semáforo y la sugerencia de repaso para cada materia a inscribir.

### 3. Ejecutar las Pruebas Unitarias:
```bash
.\.venv\Scripts\python.exe -m unittest discover tests
```
Verifica formalmente las propiedades matemáticas del DAG, el orden topológico y el cálculo numérico exacto de la Ecuación (1).

---

## 6. Resultados Obtenidos

| Métrica | Modelo Basado en Grafo (Gradly) | Baseline Trivial ($\hat{y} = \bar{y}_s$) | Ganancia |
| :--- | :---: | :---: | :---: |
| **Error Absoluto Medio (MAE)** | **0.258 pts** | 0.417 pts | **+38.15% de mayor precisión** |
| **Raíz del Error Cuadrático Medio (RMSE)** | **0.323 pts** | 0.522 pts | **+38.12% de reducción de error** |
| **Exactitud en Riesgo (Accuracy)** | **89.50%** | 82.06% | **+7.44%** |
| **Sensibilidad / Recall (Detección de Reprobados)** | **73.00%** | 43.88% | **+29.12% de cobertura de riesgo** |
| **F1-Score en Detección de Riesgo** | **0.7425** | 0.5036 | **+47.44% de balance diagnóstico** |

---

*Gradly - Proyecto de Matemáticas Discretas 2026, Universidad del Norte.*

