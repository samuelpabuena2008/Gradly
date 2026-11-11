"""
================================================================================
Gradly: Predictor de Rendimiento Académico basado en Teoría de Grafos
Malla Curricular de Ingeniería de Sistemas - Universidad del Norte
Proyecto de Matemáticas Discretas
================================================================================
"""

import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np

# Asegurar importación de módulos locales
current_dir = Path(__file__).resolve().parent
sys.path.append(str(current_dir))

from src.curriculum import CurriculumDataset
from src.graph_core import CurriculumGraph
from src.model import GradePredictor
from src.simulation import AcademicSimulator
from src.visualization import CurriculumVisualizer


def print_header(title: str):
    print("\n" + "=" * 80)
    print(f" {title.upper()}")
    print("=" * 80)


def print_subheader(title: str):
    print(f"\n--- {title} ---")


def main():
    print_header("Gradly - Análisis Completo de Teoría de Grafos y Predicción Académica")

    # 1. Carga de Datos de la Malla Curricular
    data_path = current_dir / "data" / "malla_uninorte.json"
    dataset = CurriculumDataset(str(data_path))

    nodes_csv = current_dir / "data" / "malla_uninorte_nodos.csv"
    edges_csv = current_dir / "data" / "malla_uninorte_aristas.csv"
    dataset.export_csv(str(nodes_csv), str(edges_csv))

    print(f"Programa: {dataset.programa}")
    print(f"Institución: {dataset.universidad} ({dataset.departamento})")
    print(f"Total de asignaturas (Vértices |V|): {len(dataset.courses)}")
    print(f"Total de relaciones de prerrequisito (Aristas |E|): {len(dataset.edges)}")
    print(f"  • Prerrequisitos oficiales: {sum(1 for e in dataset.edges if e.tipo == 'oficial')}")
    print(f"  • Aristas blandas (conocimiento subyacente): {sum(1 for e in dataset.edges if e.tipo == 'blanda')}")
    print(f"Datos exportados a CSV en directorio 'data/'.")

    # 2. Construcción del Grafo Dirigido
    graph = CurriculumGraph(dataset, include_soft_edges=True)

    # -------------------------------------------------------------------------
    # 3. VERIFICACIÓN DE GRAFO DIRIGIDO ACÍCLICO (DAG)
    # -------------------------------------------------------------------------
    print_header("1. Verificación Formal de Grafo Dirigido Acíclico (DAG)")
    is_dag = graph.is_dag()
    print(f"¿Es un Grafo Dirigido Acíclico (DAG) válido?: {'SÍ (VERIFICADO)' if is_dag else 'NO (CONTIENE CICLOS)'}")

    cycles = graph.find_cycles_dfs()
    if cycles:
        print(f"ALERTA: Se detectaron {len(cycles)} ciclo(s) dirigido(s):")
        for c in cycles:
            print(f"  Ciclo: {' -> '.join(c)}")
    else:
        print("Algoritmo de Coloreado DFS: No se encontraron aristas hacia atrás (Back-Edges).")
        print("Demostración: La malla curricular no posee dependencias circulares;")
        print("ninguna materia es directa o indirectamente prerrequisito de sí misma.")

    # -------------------------------------------------------------------------
    # 4. ORDEN TOPOLÓGICO (ALGORITMO DE KAHN)
    # -------------------------------------------------------------------------
    print_header("2. Orden Topológico (Algoritmo de Kahn)")
    order, trace = graph.topological_sort_kahn()
    is_valid_order = graph.verify_topological_order(order)

    print(f"Validación formal de precedencia (\u2200 (u, v) \u2208 E \u27F9 pos(u) < pos(v)): {'CORRECTA' if is_valid_order else 'FALLIDA'}")
    print("\nSecuencia lineal de cursado (Orden Topológico completo):")
    for idx, cid in enumerate(order, 1):
        c = graph.get_course(cid)
        print(f"  {idx:02d}. [{c.id:<11}] {c.nombre:<36} (Sem {c.semestre}, {c.creditos} cr, {c.area})")

    # Niveles Topológicos (Longest Path desde nodos fuente)
    levels = graph.compute_topological_levels()
    print_subheader("Estratificación Topológica por Niveles (Semestre mínimo teórico de cursado)")
    for lvl, cids in levels.items():
        names = [f"{graph.get_course(c).nombre} ({c})" for c in cids]
        print(f"  Nivel Topológico {lvl} ({len(cids)} materias): {', '.join(names)}")

    # -------------------------------------------------------------------------
    # 5. CAMINO CRÍTICO Y ASIGNATURAS DE MÁXIMA EXTENSIÓN (CPM)
    # -------------------------------------------------------------------------
    print_header("3. Camino Más Largo y Camino Crítico (Critical Path Method - CPM)")
    crit_info = graph.compute_critical_path()
    crit_path = crit_info["camino_critico"]
    crit_names = crit_info["materias_camino_critico"]

    print(f"Longitud del Camino Más Largo: {int(crit_info['distancia_maxima'])} niveles de dependencia")
    print(f"Cadena crítica de graduación ({len(crit_path)} materias):")
    for idx, (cid, name) in enumerate(zip(crit_path, crit_names), 1):
        c = graph.get_course(cid)
        print(f"  Paso {idx}: {name} ({cid}) - Semestre plan: {c.semestre}, Créditos: {c.creditos}")

    print("\nInterpretación en Matemáticas Discretas:")
    print("  • La holgura (Slack) de las asignaturas en este camino es estrictamente CERO (0).")
    print("  • Perder cualquiera de estas materias retrasa DIRECTA Y MATEMÁTICAMENTE el tiempo mínimo")
    print("    de graduación de la carrera, al constituir la cadena de dependencias más profunda.")

    # -------------------------------------------------------------------------
    # 6. ANÁLISIS DE CENTRALIDAD Y CUELLOS DE BOTELLA
    # -------------------------------------------------------------------------
    print_header("4. Métricas de Centralidad y Vulnerabilidad Estructural")
    df_centrality = graph.compute_centrality_metrics()

    print_subheader("Top 5 Cuellos de Botella Estructurales (Mayor Centralidad de Intermediación)")
    print(df_centrality[["id", "nombre", "semestre", "intermediacion_betweenness", "total_descendientes"]].head(5).to_string(index=False))

    print_subheader("Top 5 Materias Llave / Habilitadoras (Mayor Grado de Salida - Out-Degree)")
    df_out = df_centrality.sort_values(by="grado_salida_outdegree", ascending=False).head(5)
    print(df_out[["id", "nombre", "semestre", "grado_salida_outdegree", "total_descendientes"]].to_string(index=False))

    print_subheader("Top 5 Materias Integradoras (Mayor Grado de Entrada - In-Degree)")
    df_in = df_centrality.sort_values(by="grado_entrada_indegree", ascending=False).head(5)
    print(df_in[["id", "nombre", "semestre", "grado_entrada_indegree", "total_ancestros"]].to_string(index=False))

    # -------------------------------------------------------------------------
    # 7. ANÁLISIS DE IMPACTO EN CASCADA ANTE REPROBACIÓN
    # -------------------------------------------------------------------------
    print_header("5. Análisis de Impacto en Cascada y Cierre Transitivo")
    casos_falla = ["CALC1", "PROG1", "CALC2", "ESTR_DAT"]

    for cid in casos_falla:
        casc = graph.analyze_cascade_impact(cid)
        c_obj = graph.get_course(cid)
        print_subheader(f"Simulación de reprobación en: {c_obj.nombre} ({cid})")
        print(f"  • Bloqueo inmediato (Nivel 1): {casc['total_bloqueo_inmediato']} materias")
        print(f"    -> {[m['nombre'] for m in casc['bloqueo_inmediato']]}")
        print(f"  • Bloqueo total en cascada (Cierre Transitivo): {casc['total_descendientes_bloqueados']} materias")
        print(f"  • Créditos académicos afectados: {casc['creditos_bloqueados']} créditos")
        print(f"  • ¿Pertenece al Camino Crítico?: {'SÍ' if casc['pertenece_a_camino_critico'] else 'NO'}")
        print(f"  • Severidad institucional: {casc['severidad_retraso']}")

    # -------------------------------------------------------------------------
    # 8. SIMULACIÓN DE DATOS Y ENTRENAMIENTO DEL MODELO MATEMÁTICO
    # -------------------------------------------------------------------------
    print_header("6. Modelo Matemático Predictivo y Validación Experimental")
    print("Implementación de la Ecuación (1) con Centrado por Estudiante (Row-Centering):")
    print("  \u0177_{s,c} = b_c + \u2211_{p \u2208 prev(c)} w_{p \u2192 c} \u00b7 (y_{s,p} - \u0233_s) + \u0233_s")

    simulator = AcademicSimulator(graph, random_seed=42)
    print("\nGenerando cohorte sintética de 400 estudiantes con correlación de prerrequisitos...")
    df_sim = simulator.generate_student_cohort(num_students=400, noise_std=0.25)
    print(f"Historiales generados: {len(df_sim)} registros de calificaciones.")

    # División Entrenamiento / Prueba (80% / 20%)
    unique_students = df_sim["student_id"].unique()
    split_idx = int(len(unique_students) * 0.8)
    train_ids = set(unique_students[:split_idx])
    test_ids = set(unique_students[split_idx:])

    df_train = df_sim[df_sim["student_id"].isin(train_ids)]
    df_test = df_sim[df_sim["student_id"].isin(test_ids)]

    predictor = GradePredictor(graph)
    print("Entrenando parámetros {w_{p\u2192c}, b_c} mediante Regresión Regularizada en df_train...")
    predictor.fit_from_data(df_train)

    print("\nEvaluando precisión del modelo contra el Baseline Trivial (\u0177 = \u0233_s) en df_test:")
    metrics = predictor.evaluate_model(df_test)

    print(f"  • Evaluaciones de prueba realizadas: {metrics['total_evaluaciones']}")
    print(f"  • MAE Modelo con Grafo:    {metrics['mae_modelo']:.4f} puntos de nota")
    print(f"  • MAE Baseline (\u0233_s):       {metrics['mae_baseline']:.4f} puntos de nota")
    print(f"  • MEJORA DEL MODELO:       {metrics['mejora_mae_porcentual']:.2f}% de reducción de error")
    print(f"  • RMSE Modelo:             {metrics['rmse_modelo']:.4f} vs Baseline: {metrics['rmse_baseline']:.4f}")
    print(f"\nDetección de Estudiantes en Riesgo (< 3.0):")
    clf_mod = metrics["clasificacion_riesgo_modelo"]
    clf_base = metrics["clasificacion_riesgo_baseline"]
    print(f"  • Modelo - Exactitud (Accuracy): {clf_mod['accuracy']:.4f} | Precisión: {clf_mod['precision']:.4f} | Recall: {clf_mod['recall']:.4f} | F1: {clf_mod['f1']:.4f}")
    print(f"  • Baseline - Exactitud:          {clf_base['accuracy']:.4f} | Precisión: {clf_base['precision']:.4f} | Recall: {clf_base['recall']:.4f} | F1: {clf_base['f1']:.4f}")

    # -------------------------------------------------------------------------
    # 9. CASO DE ESTUDIO INDIVIDUAL Y MOTOR DE EXPLICABILIDAD (XAI)
    # -------------------------------------------------------------------------
    print_header("7. Caso de Estudio Individual: Diagnóstico y Semáforo de Riesgo")
    # Caso citado en el informe: estudiante con Cálculo 1 = 3.1, Cálculo 2 = 3.0, Álgebra Lineal = 3.8
    # va a inscribir Ecuaciones Diferenciales (EDO)
    caso_estudiante = simulator.generate_single_student_case("dificultad_en_calculo")
    gpa_estudiante = float(np.mean(list(caso_estudiante.values())))

    print(f"Perfil del Estudiante: Promedio acumulado \u0233_s = {gpa_estudiante:.2f}")
    print("Notas relevantes cursadas:")
    print(f"  • Cálculo 1: {caso_estudiante['CALC1']} (bajo su promedio)")
    print(f"  • Cálculo 2: {caso_estudiante['CALC2']} (bajo su promedio)")
    print(f"  • Álgebra Lineal: {caso_estudiante['ALG_LIN']} (sobre su promedio)")

    pred_edo = predictor.predict_course(caso_estudiante, "EDO", cumulative_gpa=gpa_estudiante)

    print(f"\nPredicción para la materia objetivo: {pred_edo.nombre} ({pred_edo.codigo})")
    print(f"  • Nota Predicha: {pred_edo.nota_predicha:.2f} / 5.0 (Baseline trivial: {pred_edo.nota_baseline:.2f})")
    print(f"  • Semáforo de Riesgo: [{pred_edo.semaforo}] - Nivel: {pred_edo.nivel_riesgo}")
    print(f"  • Dificultad base de la materia (b_c): {pred_edo.dificultad_base:+.2f}")
    print("\nDesglose de Impacto por Prerrequisito (\u0394_{p\u2192c} = w \u00b7 (y_{s,p} - \u0233_s)):")
    for imp in pred_edo.impactos_detallados:
        signo = "+" if imp.impacto_calificacion >= 0 else ""
        print(f"  - {imp.nombre_prerrequisito:<25}: Nota={imp.nota_obtenida:.1f}, "
              f"Desv={imp.desviacion_nota:+.2f}, Peso={imp.peso_arista:.2f} \u27F9 Impacto={signo}{imp.impacto_calificacion:.3f} pts")

    print(f"\nEXPLICACIÓN GENERADA:")
    print(f"  \"{pred_edo.explicacion_principal}\"")
    if pred_edo.materias_a_repasar:
        print(f"  \u2192 Materias sugeridas para repasar: {', '.join(pred_edo.materias_a_repasar)}")

    # -------------------------------------------------------------------------
    # 10. GENERACIÓN DE VISUALIZACIONES GRÁFICAS DE ALTA RESOLUCIÓN
    # -------------------------------------------------------------------------
    print_header("8. Generación de Figuras y Visualizaciones Gráficas")
    viz = CurriculumVisualizer(graph, output_dir=str(current_dir / "export"))

    fig1 = viz.plot_curriculum_dag("1_malla_curricular_dag.png")
    print(f"  [1/5] Malla Curricular Completa (DAG):       {fig1}")

    fig2 = viz.plot_critical_path("2_camino_critico_graduacion.png")
    print(f"  [2/5] Camino Crítico de Graduación (CPM):   {fig2}")

    fig3 = viz.plot_centrality_rankings("3_centralidad_cuellos_botella.png")
    print(f"  [3/5] Rankings de Centralidad y Cuellos:    {fig3}")

    fig4 = viz.plot_cascade_impact("CALC1", "4_impacto_cascada_CALC1.png")
    print(f"  [4/5] Mapa de Impacto en Cascada (CALC1):   {fig4}")

    fig5 = viz.plot_prediction_waterfall(pred_edo, "5_explicabilidad_prediccion_EDO.png")
    print(f"  [5/5] Gráfico de Explicabilidad (EDO):      {fig5}")

    print_header("Análisis Finalizado Exitosamente")
    print("Todos los requerimientos de Teoría de Grafos y Matemáticas Discretas se han ejecutado.")


if __name__ == "__main__":
    main()

