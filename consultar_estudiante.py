"""
Script Interactivo para Diagnóstico Académico Personalizado de Estudiantes
Permite ingresar notas personalizadas y obtener la predicción, semáforo y explicabilidad.
"""

import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from src.curriculum import CurriculumDataset
from src.graph_core import CurriculumGraph
from src.model import GradePredictor


def consultar():
    data_path = current_dir / "data" / "malla_uninorte.json"
    dataset = CurriculumDataset(str(data_path))
    graph = CurriculumGraph(dataset, include_soft_edges=True)
    predictor = GradePredictor(graph)

    print("\n" + "=" * 70)
    print(" GRADLY: CONSULTA Y PREDICCIÓN ACADÉMICA PERSONALIZADA")
    print("=" * 70)

    # Ejemplo de notas previas del estudiante
    print("\nEjemplo de notas históricas del estudiante (Semestres 1 y 2):")
    notas_estudiante = {
        "CALC1": 3.2,
        "ALG_LIN": 3.9,
        "PROG1": 4.1,
        "INTRO_SIS": 4.5,
        "COMP_COM1": 4.0,
        "QUIMICA": 3.4,
        "CALC2": 3.0,
        "MAT_DISC": 3.5,
        "PROG2": 4.2,
        "FISICA1": 3.1,
        "COMP_COM2": 4.0
    }

    for cid, n in notas_estudiante.items():
        c = graph.get_course(cid)
        print(f"  • {c.nombre:<32} ({cid}): {n:.1f}")

    promedio = sum(notas_estudiante.values()) / len(notas_estudiante)
    print(f"\nPromedio Acumulado Histórico: {promedio:.2f}")

    # Materias a diagnosticar para Semestre 3 y 4
    materias_objetivo = ["EDO", "ESTR_DAT", "FISICA2", "CALC3", "PROB_EST"]

    print("\n" + "-" * 70)
    print(f"{'ASIGNATURA OBJETIVO':<30} | {'PREDICCIÓN':<11} | {'SEMÁFORO':<10} | {'RIESGO':<10}")
    print("-" * 70)

    diagnosticos = []
    for target in materias_objetivo:
        pred = predictor.predict_course(notas_estudiante, target, cumulative_gpa=promedio)
        diagnosticos.append(pred)
        print(f"{pred.nombre:<30} | {pred.nota_predicha:<11.2f} | {pred.semaforo:<10} | {pred.nivel_riesgo:<10}")

    print("-" * 70)
    print("\nDETALLE Y EXPLICABILIDAD GENERADA POR EL SISTEMA:")
    for pred in diagnosticos:
        print(f"\n>>> {pred.nombre.upper()} ({pred.codigo}):")
        print(f"    Semáforo: [{pred.semaforo}] - Nota estimada: {pred.nota_predicha:.2f} (Baseline: {pred.nota_baseline:.2f})")
        print(f"    Explicación: {pred.explicacion_principal}")
        if pred.materias_a_repasar:
            print(f"    Sugerencia de repaso: {', '.join(pred.materias_a_repasar)}")


if __name__ == "__main__":
    consultar()

