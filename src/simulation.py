"""
Módulo de Simulación de Datos Académicos y Generación Sintética
Simula historiales de calificaciones de estudiantes con correlación de prerrequisitos
y ruido gaussiano controlado (según Secciones 3.2 y 4.2 del informe).
"""

from typing import List, Dict, Tuple, Optional
import numpy as np
import pandas as pd
from .graph_core import CurriculumGraph


class AcademicSimulator:
    """
    Genera historiales académicos realistas para validar el modelo y algoritmos de grafos.
    """

    def __init__(self, curriculum_graph: CurriculumGraph, random_seed: int = 42):
        self.graph = curriculum_graph
        self.rng = np.random.default_rng(random_seed)

    def generate_student_cohort(
        self,
        num_students: int = 300,
        noise_std: float = 0.28,
        retention_prob: float = 0.90
    ) -> pd.DataFrame:
        """
        Simula una cohorte completa de estudiantes cursando las materias en orden topológico.
        
        Parámetros:
        - num_students: Cantidad de estudiantes a simular.
        - noise_std: Desviación estándar del ruido estocástico no capturado por el DAG.
        - retention_prob: Probabilidad de que el estudiante continúe hasta semestres avanzados.
        """
        order, _ = self.graph.topological_sort_kahn()
        records: List[Dict[str, Any]] = []

        # Áreas de conocimiento para afinidad específica
        unique_areas = list({self.graph.get_course(c).area for c in order})

        for s_idx in range(1, num_students + 1):
            sid = f"EST-{s_idx:04d}"
            # Aptitud latente base del estudiante (promedio centrado en 3.65 con desviación 0.5)
            theta_s = float(np.clip(self.rng.normal(3.65, 0.45), 2.0, 4.8))

            # Afinidades estocásticas por área de conocimiento (ej. fuerte en matemáticas o desarrollo)
            area_affinity = {
                area: float(self.rng.normal(0.0, 0.20))
                for area in unique_areas
            }

            grades_history: Dict[str, float] = {}

            # Cursar en estricto orden topológico
            for cid in order:
                course = self.graph.get_course(cid)
                preds = list(self.graph.nx_graph.predecessors(cid))

                # Si el estudiante ha reprobado muchos prerrequisitos, podría retrasarse
                has_prereqs = True
                prereq_effect = 0.0

                if preds:
                    for p in preds:
                        if p not in grades_history:
                            has_prereqs = False
                            break
                        w = self.graph.nx_graph[p][cid].get("peso", 0.5)
                        diff = grades_history[p] - theta_s
                        prereq_effect += w * diff

                if not has_prereqs:
                    continue  # Aún no cumple los prerrequisitos en esta simulación

                # Simulación de la calificación:
                # y_{s,c} = theta_s + b_c + afinidad + efecto_prerrequisitos + ruido
                b_c = course.dificultad_base
                affinity = area_affinity.get(course.area, 0.0)
                noise = float(self.rng.normal(0.0, noise_std))

                raw_grade = theta_s + b_c + affinity + prereq_effect + noise
                grade = float(np.clip(raw_grade, 1.0, 5.0))
                grade = round(grade, 1)

                grades_history[cid] = grade

                # Promedio acumulado hasta este momento
                current_gpa = round(float(np.mean(list(grades_history.values()))), 2)

                records.append({
                    "student_id": sid,
                    "student_theta": round(theta_s, 2),
                    "course_id": cid,
                    "codigo": course.codigo,
                    "nombre": course.nombre,
                    "semestre": course.semestre,
                    "area": course.area,
                    "creditos": course.creditos,
                    "grade": grade,
                    "gpa": current_gpa,
                    "passed": grade >= 3.0
                })

                # Posibilidad de deserción o freno de avance en cursos muy avanzados
                if course.semestre >= 5 and self.rng.random() > retention_prob:
                    break

        return pd.DataFrame(records)

    def generate_single_student_case(
        self,
        case_name: str,
        student_id: str = "EST-CASO-01",
        gpa: float = 3.4
    ) -> Dict[str, float]:
        """
        Crea perfiles arquetípicos para demostración didáctica de casos de estudio.
        """
        if case_name == "dificultad_en_calculo":
            # Estudiante con dificultades en línea de cálculo (Cálculo 1 = 3.1, Cálculo 2 = 3.0)
            # pero buen desempeño en programación y álgebra lineal (3.8)
            return {
                "CALC1": 3.1,
                "ALG_LIN": 3.8,
                "PROG1": 4.2,
                "INTRO_SIS": 4.5,
                "COMP_COM1": 4.0,
                "QUIMICA": 3.3,
                "CALC2": 3.0,
                "MAT_DISC": 3.4,
                "PROG2": 4.0,
                "FISICA1": 3.2,
                "COMP_COM2": 4.2
            }
        elif case_name == "estudiante_excelente":
            return {
                "CALC1": 4.6,
                "ALG_LIN": 4.7,
                "PROG1": 4.8,
                "INTRO_SIS": 4.5,
                "COMP_COM1": 4.2,
                "QUIMICA": 4.0,
                "CALC2": 4.5,
                "MAT_DISC": 4.6,
                "PROG2": 4.8,
                "FISICA1": 4.3,
                "COMP_COM2": 4.4
            }
        elif case_name == "alto_riesgo_general":
            return {
                "CALC1": 3.0,
                "ALG_LIN": 3.0,
                "PROG1": 3.2,
                "INTRO_SIS": 3.5,
                "COMP_COM1": 3.2,
                "QUIMICA": 3.0,
                "CALC2": 2.9,
                "MAT_DISC": 3.0,
                "PROG2": 3.1,
                "FISICA1": 2.8,
                "COMP_COM2": 3.3
            }
        else:
            return {"CALC1": 3.5, "PROG1": 3.5}

