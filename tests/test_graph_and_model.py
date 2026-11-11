"""
Pruebas Unitarias para Algoritmos de Grafos y Modelo Matemático
Verifica formalmente propiedades de Teoría de Grafos y fórmulas de predicción.
"""

import unittest
from pathlib import Path
import sys
import numpy as np

# Rutas del proyecto
current_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(current_dir))

from src.curriculum import CurriculumDataset, Course, PrerequisiteEdge
from src.graph_core import CurriculumGraph
from src.model import GradePredictor


class TestCurriculumGraphTheory(unittest.TestCase):
    """Pruebas rigurosas sobre propiedades de grafos discretos."""

    def setUp(self):
        data_path = current_dir / "data" / "malla_uninorte.json"
        self.dataset = CurriculumDataset(str(data_path))
        self.graph = CurriculumGraph(self.dataset, include_soft_edges=True)

    def test_graph_is_dag(self):
        """Verifica que el grafo sea estrictamente acíclico (DAG)."""
        self.assertTrue(self.graph.is_dag(), "La malla curricular debe ser un Grafo Dirigido Acíclico.")
        cycles = self.graph.find_cycles_dfs()
        self.assertEqual(len(cycles), 0, f"No deben existir ciclos. Se detectaron: {cycles}")

    def test_topological_sort_validity(self):
        """Verifica la validez formal del orden topológico: u precede a v si (u, v) in E."""
        order, _ = self.graph.topological_sort_kahn()
        self.assertEqual(len(order), len(self.graph.nx_graph.nodes()), "El orden topológico debe contener todos los vértices.")
        self.assertTrue(self.graph.verify_topological_order(order), "El orden topológico debe respetar todas las aristas dirigidas.")

    def test_critical_path_calculation(self):
        """Verifica que el camino crítico sea conexo y tenga longitud consistente."""
        crit = self.graph.compute_critical_path()
        path = crit["camino_critico"]
        self.assertGreater(len(path), 3, "El camino crítico debe tener al menos 4 asignaturas.")
        self.assertGreaterEqual(crit["distancia_maxima"], 5.0, "La cadena crítica debe abarcar al menos 5 niveles semestrales.")

        # Verificar que sea un camino válido consecutivo en el grafo
        for u, v in zip(path[:-1], path[1:]):
            self.assertTrue(self.graph.nx_graph.has_edge(u, v), f"La arista ({u}, {v}) del camino crítico debe existir.")

    def test_cascade_reachability(self):
        """Verifica que los descendientes transitivos sean un subconjunto estricto y no incluyan al nodo origen."""
        impact = self.graph.analyze_cascade_impact("CALC1")
        self.assertNotIn("CALC1", [c["id"] for c in impact["bloqueo_inmediato"]])
        self.assertGreater(impact["total_descendientes_bloqueados"], 5, "Cálculo 1 debe bloquear múltiples materias.")


class TestPredictionModelFormula(unittest.TestCase):
    """Pruebas sobre el modelo matemático y la Ecuación (1)."""

    def setUp(self):
        data_path = current_dir / "data" / "malla_uninorte.json"
        self.dataset = CurriculumDataset(str(data_path))
        self.graph = CurriculumGraph(self.dataset, include_soft_edges=True)
        self.predictor = GradePredictor(self.graph)

    def test_exact_equation_calculation(self):
        r"""
        Verificación manual paso a paso de la fórmula:
        \hat{y}_{s,c} = b_c + \sum w * (y_{sp} - \bar{y}_s) + \bar{y}_s
        """
        # Fijar parámetros conocidos para EDO
        self.predictor.set_course_bias("EDO", -0.20)
        self.predictor.set_edge_weight("CALC2", "EDO", 0.60)
        self.predictor.set_edge_weight("ALG_LIN", "EDO", 0.35)

        # Historial del estudiante:
        # y_bar = 3.6
        # CALC2 = 3.0 (desv = 3.0 - 3.6 = -0.6)
        # ALG_LIN = 4.0 (desv = 4.0 - 3.6 = +0.4)
        student_grades = {"CALC2": 3.0, "ALG_LIN": 4.0}
        gpa = 3.6

        # Impacto manual:
        # sum_impacts = (0.60 * -0.6) + (0.35 * 0.4) = -0.36 + 0.14 = -0.22
        # y_hat_raw = -0.20 + (-0.22) + 3.6 = 3.18
        pred = self.predictor.predict_course(student_grades, "EDO", cumulative_gpa=gpa)

        self.assertAlmostEqual(pred.nota_predicha, 3.18, places=2)
        self.assertEqual(pred.semaforo, "AMARILLO")
        self.assertEqual(pred.nivel_riesgo, "MODERADO")

    def test_clipping_bounds(self):
        """Verifica que las calificaciones predichas permanezcan en [0.0, 5.0]."""
        # Calificaciones artificialmente extremas
        pred_high = self.predictor.predict_course({"CALC2": 5.0, "ALG_LIN": 5.0}, "EDO", cumulative_gpa=5.0)
        self.assertLessEqual(pred_high.nota_predicha, 5.0)

        pred_low = self.predictor.predict_course({"CALC2": 0.0, "ALG_LIN": 0.0}, "EDO", cumulative_gpa=1.0)
        self.assertGreaterEqual(pred_low.nota_predicha, 0.0)


if __name__ == "__main__":
    unittest.main()
