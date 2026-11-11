"""
Módulo del Modelo Matemático Predictivo de Rendimiento Académico
Implementa la Ecuación (1) con centrado por estudiante (row-centering),
clasificación de riesgo semafórico y motor de explicabilidad.
"""

from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import numpy as np
import pandas as pd
from .graph_core import CurriculumGraph


@dataclass
class PrerequisiteImpact:
    """Desglose del impacto de un prerrequisito en la predicción final."""
    prerrequisito_id: str
    nombre_prerrequisito: str
    nota_obtenida: float
    promedio_estudiante: float
    desviacion_nota: float      # (y_sp - y_bar_s)
    peso_arista: float          # w_{p -> c}
    impacto_calificacion: float # w_{p -> c} * (y_sp - y_bar_s)
    es_negativo: bool


@dataclass
class CoursePrediction:
    """Resultado detallado de la predicción para una asignatura objetivo."""
    asignatura_id: str
    codigo: str
    nombre: str
    nota_predicha: float
    nota_baseline: float
    semaforo: str             # 'VERDE', 'AMARILLO', 'ROJO'
    nivel_riesgo: str         # 'BAJO', 'MODERADO', 'ALTO'
    dificultad_base: float
    promedio_estudiante: float
    suma_impactos_prereq: float
    impactos_detallados: List[PrerequisiteImpact]
    explicacion_principal: str
    materias_a_repasar: List[str]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["impactos_detallados"] = [asdict(i) for i in self.impactos_detallados]
        return d


class GradePredictor:
    r"""
    Predictor de calificaciones basado en el Grafo Curricular y centrado por estudiante.
    
    Ecuación (1):
        \hat{y}_{s,c} = b_c + \sum_{p \in prev(c)} w_{p \to c} \cdot (y_{s,p} - \bar{y}_s) + \bar{y}_s
    """

    def __init__(self, curriculum_graph: CurriculumGraph):
        self.graph = curriculum_graph
        # Pesos y sesgos por defecto tomados de los atributos del grafo
        self.weights: Dict[Tuple[str, str], float] = {}
        self.biases: Dict[str, float] = {}
        self._init_parameters()

    def _init_parameters(self) -> None:
        """Inicializa los pesos w_{p -> c} y sesgos b_c a partir del grafo."""
        for u, v, data in self.graph.nx_graph.edges(data=True):
            self.weights[(u, v)] = float(data.get("peso", 0.5))

        for n, data in self.graph.nx_graph.nodes(data=True):
            self.biases[n] = float(data.get("dificultad_base", 0.0))

    def set_edge_weight(self, source: str, target: str, weight: float) -> None:
        self.weights[(source, target)] = weight

    def set_course_bias(self, course_id: str, bias: float) -> None:
        self.biases[course_id] = bias

    def predict_course(
        self,
        student_grades: Dict[str, float],
        target_course: str,
        cumulative_gpa: Optional[float] = None
    ) -> CoursePrediction:
        """
        Calcula la predicción para un estudiante en la materia target_course.
        
        Parámetros:
        - student_grades: Diccionario {course_id: nota} con las notas históricas aprobadas o cursadas.
        - target_course: ID de la asignatura a predecir.
        - cumulative_gpa: Promedio acumulado (si es None, se calcula automáticamente de student_grades).
        """
        if target_course not in self.graph.nx_graph:
            raise KeyError(f"Asignatura {target_course} no existe en el grafo.")

        target_node = self.graph.get_course(target_course)
        b_c = self.biases.get(target_course, 0.0)

        # Determinar promedio general del estudiante y_bar_s
        if cumulative_gpa is None:
            if not student_grades:
                y_bar_s = 3.5  # Promedio referencial si no tiene notas previas
            else:
                y_bar_s = float(np.mean(list(student_grades.values())))
        else:
            y_bar_s = float(cumulative_gpa)

        # Obtener los prerrequisitos (predecesores en el grafo)
        predecessors = list(self.graph.nx_graph.predecessors(target_course))

        impacts: List[PrerequisiteImpact] = []
        sum_impacts = 0.0
        repasar_list = []

        for p in predecessors:
            w_pc = self.weights.get((p, target_course), 0.5)
            p_course = self.graph.get_course(p)

            # Si el estudiante cursó el prerrequisito, usar su nota real; si no, asumir el promedio
            y_sp = student_grades.get(p, y_bar_s)
            diff = y_sp - y_bar_s
            impact = w_pc * diff
            sum_impacts += impact

            is_negative = impact < -0.05
            if is_negative or y_sp < 3.2:
                repasar_list.append(p_course.nombre)

            impacts.append(PrerequisiteImpact(
                prerrequisito_id=p,
                nombre_prerrequisito=p_course.nombre,
                nota_obtenida=round(y_sp, 2),
                promedio_estudiante=round(y_bar_s, 2),
                desviacion_nota=round(diff, 2),
                peso_arista=round(w_pc, 2),
                impacto_calificacion=round(impact, 3),
                es_negativo=is_negative
            ))

        # Fórmula (1): \hat{y}_{s,c} = b_c + \sum w * (y_sp - y_bar) + y_bar
        y_hat_raw = b_c + sum_impacts + y_bar_s
        # Restricción al rango institucional [0.0, 5.0]
        y_hat = float(np.clip(y_hat_raw, 0.0, 5.0))
        baseline = float(np.clip(y_bar_s, 0.0, 5.0))

        # Semáforo de riesgo:
        # Verde >= 3.5; Amarillo: 3.0 <= y_hat < 3.5; Rojo: < 3.0
        if y_hat >= 3.5:
            semaforo = "VERDE"
            nivel_riesgo = "BAJO"
        elif y_hat >= 3.0:
            semaforo = "AMARILLO"
            nivel_riesgo = "MODERADO"
        else:
            semaforo = "ROJO"
            nivel_riesgo = "ALTO (Riesgo de Reprobación)"

        # Construcción de la explicación interpretable
        explicacion = self._generate_explanation(target_node.nombre, y_hat, y_bar_s, impacts)

        return CoursePrediction(
            asignatura_id=target_course,
            codigo=target_node.codigo,
            nombre=target_node.nombre,
            nota_predicha=round(y_hat, 2),
            nota_baseline=round(baseline, 2),
            semaforo=semaforo,
            nivel_riesgo=nivel_riesgo,
            dificultad_base=round(b_c, 2),
            promedio_estudiante=round(y_bar_s, 2),
            suma_impactos_prereq=round(sum_impacts, 3),
            impactos_detallados=impacts,
            explicacion_principal=explicacion,
            materias_a_repasar=repasar_list
        )

    def _generate_explanation(
        self,
        course_name: str,
        predicted: float,
        gpa: float,
        impacts: List[PrerequisiteImpact]
    ) -> str:
        """Genera una explicación en lenguaje natural accesible para el estudiante."""
        if not impacts:
            return f"Asignatura inicial o sin prerrequisitos previos directos. Predicción estimada según dificultad base y tu promedio general ({gpa:.2f})."

        # Ordenar prerrequisitos por impacto más negativo primero
        sorted_impacts = sorted(impacts, key=lambda x: x.impacto_calificacion)
        worst = sorted_impacts[0]
        best = sorted_impacts[-1]

        if predicted < 3.0:
            if worst.impacto_calificacion < -0.1:
                return (f"Alerta de riesgo en {course_name}: tu predicción ({predicted:.1f}) baja sobre todo por "
                        f"tu rendimiento previo en {worst.nombre_prerrequisito} (obtenido: {worst.nota_obtenida:.1f}, "
                        f"impacto: {worst.impacto_calificacion:+.2f} pts).")
            else:
                return f"Alerta de riesgo en {course_name}: la asignatura presenta una alta dificultad intrínseca combinada con tu promedio base."
        elif predicted < 3.5:
            if worst.impacto_calificacion < -0.05:
                return (f"Rendimiento moderado en {course_name}. Conviene reforzar conceptos de "
                        f"{worst.nombre_prerrequisito} ({worst.impacto_calificacion:+.2f} pts) para asegurar la aprobación.")
            else:
                return f"Predicción equilibrada en {course_name} consistente con tu promedio histórico ({gpa:.2f})."
        else:
            if best.impacto_calificacion > 0.1:
                return (f"Excelente pronóstico en {course_name} ({predicted:.1f}), impulsado notablemente por tus sólidas bases en "
                        f"{best.nombre_prerrequisito} ({best.impacto_calificacion:+.2f} pts).")
            else:
                return f"Predicción favorable en {course_name} respaldada por un buen promedio acumulado."

    def fit_from_data(self, df_records: pd.DataFrame, alpha: float = 0.01) -> None:
        """
        Ajusta los parámetros (pesos w y sesgos b) usando regresión ridge / mínimos cuadrados
        por cada asignatura a partir de un histórico tabular de notas de estudiantes.
        
        df_records debe contener columnas: ['student_id', 'course_id', 'grade', 'gpa']
        """
        for target in self.graph.nx_graph.nodes():
            preds = list(self.graph.nx_graph.predecessors(target))
            if not preds:
                continue

            target_df = df_records[df_records["course_id"] == target]
            if len(target_df) < 10:
                continue

            # Construir matriz de características: X = [y_{s,p} - \bar{y}_s] para cada p
            X_rows = []
            y_rows = []

            for _, row in target_df.iterrows():
                sid = row["student_id"]
                y_sc = row["grade"]
                y_bar = row["gpa"]

                student_all = df_records[df_records["student_id"] == sid]
                grades_dict = dict(zip(student_all["course_id"], student_all["grade"]))

                # Vector de desviaciones
                x_vec = []
                has_all_preds = True
                for p in preds:
                    if p in grades_dict:
                        x_vec.append(grades_dict[p] - y_bar)
                    else:
                        has_all_preds = False
                        break

                if has_all_preds:
                    X_rows.append(x_vec)
                    # Variable dependiente: (y_sc - y_bar)
                    y_rows.append(y_sc - y_bar)

            if len(X_rows) >= max(len(preds) + 2, 10):
                X = np.array(X_rows)
                Y = np.array(y_rows)

                # Regresión Ridge para evitar sobreajuste y multicolinealidad: (X^T X + \alpha I)^{-1} X^T Y
                p_dim = X.shape[1]
                I = np.eye(p_dim)
                # Resolver [1, X] para incluir sesgo b_c
                X_design = np.hstack([np.ones((len(X), 1)), X])
                I_design = np.eye(p_dim + 1)
                I_design[0, 0] = 0  # No penalizar el intercepto

                try:
                    beta = np.linalg.solve(X_design.T @ X_design + alpha * I_design, X_design.T @ Y)
                    self.biases[target] = float(beta[0])
                    for idx, p in enumerate(preds):
                        # Forzar pesos no negativos razonables
                        w_val = float(np.clip(beta[1 + idx], 0.05, 1.2))
                        self.weights[(p, target)] = w_val
                except Exception:
                    pass

    def evaluate_model(
        self,
        test_records: pd.DataFrame
    ) -> Dict[str, Any]:
        r"""
        Evalúa el modelo contra el baseline trivial (\hat{y} = \bar{y}_s) reportando:
        - MAE (Error Absoluto Medio)
        - RMSE
        - Precisión y Recall en detección de estudiantes en riesgo (< 3.0)
        """
        actual_grades = []
        pred_grades = []
        baseline_grades = []

        students = test_records["student_id"].unique()

        for sid in students:
            s_df = test_records[test_records["student_id"] == sid]
            g_dict = dict(zip(s_df["course_id"], s_df["grade"]))
            gpa = s_df["gpa"].iloc[0]

            for _, row in s_df.iterrows():
                cid = row["course_id"]
                preds = list(self.graph.nx_graph.predecessors(cid))
                if not preds:
                    continue
                # Si tenemos notas para todos los prerrequisitos
                if all(p in g_dict for p in preds):
                    actual = row["grade"]
                    prediction = self.predict_course(g_dict, cid, cumulative_gpa=gpa)

                    actual_grades.append(actual)
                    pred_grades.append(prediction.nota_predicha)
                    baseline_grades.append(gpa)

        if not actual_grades:
            return {"error": "No hay suficientes datos de prueba con prerrequisitos completos."}

        y_true = np.array(actual_grades)
        y_pred = np.array(pred_grades)
        y_base = np.array(baseline_grades)

        mae_model = float(np.mean(np.abs(y_true - y_pred)))
        mae_base = float(np.mean(np.abs(y_true - y_base)))

        rmse_model = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
        rmse_base = float(np.sqrt(np.mean((y_true - y_base) ** 2)))

        # Clasificación binaria: Reprueba (< 3.0) vs Aprueba (>= 3.0)
        true_fail = (y_true < 3.0)
        pred_fail = (y_pred < 3.0)
        base_fail = (y_base < 3.0)

        def get_clf_metrics(y_real_bool, y_pred_bool):
            tp = int(np.sum(y_real_bool & y_pred_bool))
            fp = int(np.sum(~y_real_bool & y_pred_bool))
            fn = int(np.sum(y_real_bool & ~y_pred_bool))
            tn = int(np.sum(~y_real_bool & ~y_pred_bool))
            acc = (tp + tn) / max(len(y_real_bool), 1)
            prec = tp / max(tp + fp, 1)
            rec = tp / max(tp + fn, 1)
            f1 = 2 * prec * rec / max(prec + rec, 1e-9)
            return {"accuracy": round(acc, 4), "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4)}

        metrics_model = get_clf_metrics(true_fail, pred_fail)
        metrics_base = get_clf_metrics(true_fail, base_fail)

        return {
            "total_evaluaciones": len(actual_grades),
            "mae_modelo": round(mae_model, 4),
            "mae_baseline": round(mae_base, 4),
            "mejora_mae_porcentual": round((mae_base - mae_model) / max(mae_base, 1e-9) * 100, 2),
            "rmse_modelo": round(rmse_model, 4),
            "rmse_baseline": round(rmse_base, 4),
            "clasificacion_riesgo_modelo": metrics_model,
            "clasificacion_riesgo_baseline": metrics_base
        }
