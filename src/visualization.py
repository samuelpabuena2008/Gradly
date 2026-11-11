"""
Módulo de Visualización Gráfica para Matemáticas Discretas
Genera diagramas del DAG curricular, camino crítico, impacto en cascada,
centralidad y explicabilidad de predicciones.
"""

from typing import Dict, List, Optional, Tuple, Any
import os
import matplotlib
# Configurar backend no interactivo antes de importar pyplot
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import networkx as nx
import numpy as np
import pandas as pd
from .graph_core import CurriculumGraph
from .model import CoursePrediction


class CurriculumVisualizer:
    """Generador de visualizaciones de teoría de grafos y predicciones."""

    # Paleta de colores distinguible por área académica
    AREA_COLORS = {
        "Ciencias Básicas": "#4A90E2",      # Azul
        "Computación": "#50E3C2",           # Verde azulado
        "Sistemas": "#F5A623",              # Naranja
        "Software": "#BD10E0",              # Púrpura
        "Matemáticas": "#9013FE",           # Violeta
        "Humanidades": "#7ED321",           # Verde lima
        "Económico-Adm": "#B8E986",         # Verde claro
        "Gestión": "#E67E22",               # Ocre
        "Integración": "#E74C3C",           # Rojo coral
        "Profesional": "#34495E"            # Gris azulado
    }

    SEMAPHORE_COLORS = {
        "VERDE": "#2ECC71",
        "AMARILLO": "#F39C12",
        "ROJO": "#E74C3C"
    }

    def __init__(self, curriculum_graph: CurriculumGraph, output_dir: str = "export"):
        self.graph = curriculum_graph
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        # Aplicar estilo limpio
        plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

    def _compute_hierarchical_layout(self) -> Dict[str, Tuple[float, float]]:
        """
        Calcula posiciones (x, y) donde x corresponde al semestre/nivel
        y y se distribuye verticalmente dentro de cada semestre.
        """
        semesters: Dict[int, List[str]] = {}
        for n, data in self.graph.nx_graph.nodes(data=True):
            sem = data.get("semestre", 1)
            semesters.setdefault(sem, []).append(n)

        pos: Dict[str, Tuple[float, float]] = {}
        for sem, nodes in semesters.items():
            k = len(nodes)
            y_coords = np.linspace(k * 0.9, -k * 0.9, k) if k > 1 else [0.0]
            for idx, node in enumerate(nodes):
                pos[node] = (float(sem * 2.8), float(y_coords[idx]))

        return pos

    # =========================================================================
    # 1. DIAGRAMA GENERAL DE LA MALLA CURRICULAR COMO DAG
    # =========================================================================

    def plot_curriculum_dag(self, filename: str = "1_malla_curricular_dag.png") -> str:
        """Renderiza la malla curricular completa diferenciando aristas oficiales y blandas."""
        fig, ax = plt.subplots(figsize=(20, 12), dpi=300)
        pos = self._compute_hierarchical_layout()

        # Nodos
        node_colors = [
            self.AREA_COLORS.get(self.graph.nx_graph.nodes[n].get("area"), "#95A5A6")
            for n in self.graph.nx_graph.nodes()
        ]

        nx.draw_networkx_nodes(
            self.graph.nx_graph,
            pos,
            node_color=node_colors,
            node_size=1400,
            edgecolors="#2C3E50",
            linewidths=1.8,
            ax=ax
        )

        # Aristas oficiales (línea continua azul oscuro)
        official_edges = [
            (u, v) for u, v, d in self.graph.nx_graph.edges(data=True)
            if d.get("tipo") == "oficial"
        ]
        nx.draw_networkx_edges(
            self.graph.nx_graph,
            pos,
            edgelist=official_edges,
            edge_color="#34495E",
            width=1.8,
            arrows=True,
            arrowsize=14,
            arrowstyle="-|>",
            connectionstyle="arc3,rad=0.08",
            ax=ax
        )

        # Aristas blandas (línea punteada violeta)
        soft_edges = [
            (u, v) for u, v, d in self.graph.nx_graph.edges(data=True)
            if d.get("tipo") == "blanda"
        ]
        if soft_edges:
            nx.draw_networkx_edges(
                self.graph.nx_graph,
                pos,
                edgelist=soft_edges,
                edge_color="#8E44AD",
                width=1.6,
                style="dashed",
                arrows=True,
                arrowsize=12,
                arrowstyle="-|>",
                connectionstyle="arc3,rad=0.18",
                ax=ax
            )

        # Etiquetas de nodos
        labels = {n: f"{n}\n{self.graph.nx_graph.nodes[n]['codigo']}" for n in self.graph.nx_graph.nodes()}
        nx.draw_networkx_labels(
            self.graph.nx_graph,
            pos,
            labels=labels,
            font_size=8,
            font_weight="bold",
            font_color="#1A252F",
            ax=ax
        )

        # Leyenda de áreas
        legend_patches = [
            mpatches.Patch(color=color, label=area)
            for area, color in self.AREA_COLORS.items()
            if any(self.graph.nx_graph.nodes[n].get("area") == area for n in self.graph.nx_graph.nodes())
        ]
        legend_patches.append(mpatches.Patch(color="#34495E", label="Prerrequisito Oficial"))
        legend_patches.append(mpatches.Patch(color="#8E44AD", label="Arista Blanda (Relación Subyacente)"))

        ax.legend(
            handles=legend_patches,
            loc="upper center",
            bbox_to_anchor=(0.5, 1.05),
            ncol=5,
            fontsize=9,
            frameon=True,
            facecolor="white",
            edgecolor="#BDC3C7"
        )

        ax.set_title(
            "Malla Curricular como Grafo Dirigido Acíclico (DAG) - Ingeniería de Sistemas Uninorte",
            fontsize=15,
            fontweight="bold",
            pad=35
        )
        ax.axis("off")
        plt.tight_layout()

        output_path = os.path.join(self.output_dir, filename)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close(fig)
        return output_path

    # =========================================================================
    # 2. CAMINO CRÍTICO Y ASIGNATURAS DE MÁXIMA EXTENSIÓN
    # =========================================================================

    def plot_critical_path(self, filename: str = "2_camino_critico_graduacion.png") -> str:
        """Resalta el camino más largo (Camino Crítico de Graduación)."""
        crit_info = self.graph.compute_critical_path()
        crit_path = crit_info["camino_critico"]
        crit_edges = list(zip(crit_path[:-1], crit_path[1:]))

        fig, ax = plt.subplots(figsize=(20, 11), dpi=300)
        pos = self._compute_hierarchical_layout()

        # Colores de nodos: Rojo brillante para los críticos, gris suave para los demás
        node_colors = [
            "#E74C3C" if n in crit_path else "#ECF0F1"
            for n in self.graph.nx_graph.nodes()
        ]
        edge_colors_nodes = [
            "#C0392B" if n in crit_path else "#BDC3C7"
            for n in self.graph.nx_graph.nodes()
        ]
        node_sizes = [
            2100 if n in crit_path else 1100
            for n in self.graph.nx_graph.nodes()
        ]

        nx.draw_networkx_nodes(
            self.graph.nx_graph,
            pos,
            node_color=node_colors,
            node_size=node_sizes,
            edgecolors=edge_colors_nodes,
            linewidths=2.2,
            ax=ax
        )

        # Aristas no críticas (faded)
        non_crit_edges = [e for e in self.graph.nx_graph.edges() if e not in crit_edges]
        nx.draw_networkx_edges(
            self.graph.nx_graph,
            pos,
            edgelist=non_crit_edges,
            edge_color="#BDC3C7",
            alpha=0.35,
            width=1.0,
            arrows=True,
            arrowsize=10,
            ax=ax
        )

        # Aristas críticas (rojo intenso y gruesas)
        nx.draw_networkx_edges(
            self.graph.nx_graph,
            pos,
            edgelist=crit_edges,
            edge_color="#C0392B",
            width=3.5,
            arrows=True,
            arrowsize=18,
            arrowstyle="-|>",
            connectionstyle="arc3,rad=0.06",
            ax=ax
        )

        # Etiquetas
        labels = {
            n: f"{n}\n({self.graph.nx_graph.nodes[n]['codigo']})"
            if n in crit_path else n
            for n in self.graph.nx_graph.nodes()
        }
        font_colors = {n: "#FFFFFF" if n in crit_path else "#7F8C8D" for n in self.graph.nx_graph.nodes()}
        for n, (x, y) in pos.items():
            ax.text(
                x, y, labels[n],
                fontsize=9 if n in crit_path else 7,
                fontweight="bold" if n in crit_path else "normal",
                color=font_colors[n],
                ha="center",
                va="center"
            )

        # Cuadro explicativo
        crit_names_str = " -> ".join([self.graph.get_course(cid).nombre for cid in crit_path])
        textbox = (
            f"LONGITUD DEL CAMINO CRÍTICO: {int(crit_info['distancia_maxima'])} niveles semestrales\n"
            f"SECUENCIA CRÍTICA ({len(crit_path)} materias):\n{crit_names_str}\n\n"
            f"NOTA TEÓRICA: La holgura (slack) de estas materias es 0. Reprobar cualquiera de ellas\n"
            f"retrasa de forma matemática directa el semestre mínimo de graduación."
        )
        ax.text(
            0.5, 0.02, textbox,
            transform=ax.transAxes,
            ha="center",
            va="bottom",
            fontsize=9.5,
            fontfamily="sans-serif",
            bbox=dict(boxstyle="round,pad=0.6", facecolor="#FDEDEC", edgecolor="#E74C3C", linewidth=1.5)
        )

        ax.set_title(
            "Camino Crítico (Critical Path Method - CPM) de la Carrera",
            fontsize=16,
            fontweight="bold",
            color="#2C3E50",
            pad=20
        )
        ax.axis("off")
        plt.tight_layout()

        output_path = os.path.join(self.output_dir, filename)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close(fig)
        return output_path

    # =========================================================================
    # 3. RANKINGS DE CENTRALIDAD Y CUELLOS DE BOTELLA
    # =========================================================================

    def plot_centrality_rankings(self, filename: str = "3_centralidad_cuellos_botella.png") -> str:
        """Genera gráficos de barras comparativos para métricas de centralidad."""
        df = self.graph.compute_centrality_metrics()

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7), dpi=300)

        # 1. Top Betweenness (Intermediación)
        top_betweenness = df.sort_values(by="intermediacion_betweenness", ascending=False).head(10)
        bars1 = ax1.barh(
            top_betweenness["nombre"],
            top_betweenness["intermediacion_betweenness"],
            color="#E67E22",
            edgecolor="#BA4A00"
        )
        ax1.invert_yaxis()
        ax1.set_xlabel("Centralidad de Intermediación (Betweenness)", fontweight="bold")
        ax1.set_title("Top 10 Cuellos de Botella Estructurales\n(Materias que conectan más caminos del pensum)", fontweight="bold")
        for bar in bars1:
            val = bar.get_width()
            ax1.text(val + 0.003, bar.get_y() + bar.get_height() / 2, f"{val:.4f}", va="center", fontsize=8.5)

        # 2. Top Out-Degree (Grado de salida)
        top_out = df.sort_values(by="grado_salida_outdegree", ascending=False).head(10)
        bars2 = ax2.barh(
            top_out["nombre"],
            top_out["grado_salida_outdegree"],
            color="#2980B9",
            edgecolor="#1B4F72"
        )
        ax2.invert_yaxis()
        ax2.set_xlabel("Grado de Salida (Out-Degree)", fontweight="bold")
        ax2.set_title("Top 10 Materias 'Llave' / Habilitadoras\n(Materias que desbloquean más asignaturas directas)", fontweight="bold")
        for bar in bars2:
            val = bar.get_width()
            ax2.text(val + 0.1, bar.get_y() + bar.get_height() / 2, f"{int(val)}", va="center", fontsize=8.5)

        plt.suptitle("Análisis de Centralidad y Vulnerabilidad en la Malla Curricular", fontsize=15, fontweight="bold", y=1.02)
        plt.tight_layout()

        output_path = os.path.join(self.output_dir, filename)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close(fig)
        return output_path

    # =========================================================================
    # 4. IMPACTO EN CASCADA ANTE REPROBACIÓN
    # =========================================================================

    def plot_cascade_impact(self, course_id: str, filename: Optional[str] = None) -> str:
        """Visualiza el mapa de impacto en cascada si un estudiante reprueba una asignatura."""
        impact_info = self.graph.analyze_cascade_impact(course_id)
        if filename is None:
            filename = f"4_impacto_cascada_{course_id}.png"

        direct_ids = {c["id"] for c in impact_info["bloqueo_inmediato"]}
        all_desc_ids = set()
        for lvl, names in impact_info["descendientes_por_nivel"].items():
            for n in self.graph.nx_graph.nodes():
                if self.graph.get_course(n).nombre in names:
                    all_desc_ids.add(n)

        indirect_ids = all_desc_ids - direct_ids

        fig, ax = plt.subplots(figsize=(19, 11), dpi=300)
        pos = self._compute_hierarchical_layout()

        node_colors = []
        node_sizes = []
        for n in self.graph.nx_graph.nodes():
            if n == course_id:
                node_colors.append("#C0392B")  # Origen de la falla (Rojo oscuro)
                node_sizes.append(2300)
            elif n in direct_ids:
                node_colors.append("#E67E22")  # Bloqueo inmediato (Naranja)
                node_sizes.append(1700)
            elif n in indirect_ids:
                node_colors.append("#F1C40F")  # Bloqueo indirecto a futuro (Amarillo)
                node_sizes.append(1400)
            else:
                node_colors.append("#ECEFF1")  # No afectada (Gris claro)
                node_sizes.append(1000)

        nx.draw_networkx_nodes(
            self.graph.nx_graph,
            pos,
            node_color=node_colors,
            node_size=node_sizes,
            edgecolors="#2C3E50",
            linewidths=1.5,
            ax=ax
        )

        # Dibujar aristas coloreando las involucradas en la cascada
        cascade_edges = []
        other_edges = []
        for u, v in self.graph.nx_graph.edges():
            if (u == course_id and v in direct_ids) or (u in all_desc_ids and v in all_desc_ids):
                cascade_edges.append((u, v))
            else:
                other_edges.append((u, v))

        nx.draw_networkx_edges(
            self.graph.nx_graph,
            pos,
            edgelist=other_edges,
            edge_color="#CFD8DC",
            alpha=0.35,
            width=1.0,
            arrows=True,
            ax=ax
        )
        nx.draw_networkx_edges(
            self.graph.nx_graph,
            pos,
            edgelist=cascade_edges,
            edge_color="#C0392B",
            width=2.5,
            arrows=True,
            arrowsize=14,
            arrowstyle="-|>",
            connectionstyle="arc3,rad=0.08",
            ax=ax
        )

        # Etiquetas
        for n, (x, y) in pos.items():
            color = "#FFFFFF" if n in (course_id, *direct_ids) else "#2C3E50"
            ax.text(
                x, y, n,
                fontsize=8.5 if n in (course_id, *direct_ids) else 7,
                fontweight="bold",
                color=color,
                ha="center",
                va="center"
            )

        # Leyenda y cuadro resumen
        c_obj = self.graph.get_course(course_id)
        info_box = (
            f"SIMULACIÓN DE REPROBACIÓN: {c_obj.nombre} ({c_obj.codigo})\n"
            f"• Bloqueo Inmediato (Nivel 1): {impact_info['total_bloqueo_inmediato']} asignaturas\n"
            f"• Bloqueo Total en Cascada: {impact_info['total_descendientes_bloqueados']} asignaturas\n"
            f"• Créditos Académicos Comprometidos: {impact_info['creditos_bloqueados']} créditos\n"
            f"• Nivel de Severidad en Retraso: {impact_info['severidad_retraso']}"
        )
        ax.text(
            0.5, 0.03, info_box,
            transform=ax.transAxes,
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.7", facecolor="#FDEDEC", edgecolor="#C0392B", linewidth=1.8)
        )

        ax.set_title(
            f"Impacto en Cascada y Cierre Transitivo por Reprobación de '{c_obj.nombre}'",
            fontsize=15,
            fontweight="bold",
            pad=20
        )
        ax.axis("off")
        plt.tight_layout()

        output_path = os.path.join(self.output_dir, filename)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close(fig)
        return output_path

    # =========================================================================
    # 5. WATERFALL / DASHBOARD DE EXPLICABILIDAD DE PREDICCIÓN
    # =========================================================================

    def plot_prediction_waterfall(
        self,
        pred: CoursePrediction,
        filename: Optional[str] = None
    ) -> str:
        """
        Gráfico de contribución aditiva de la Ecuación (1) que explica
        visualmente por qué la nota sube o baja respecto al promedio del estudiante.
        """
        if filename is None:
            filename = f"5_explicabilidad_prediccion_{pred.asignatura_id}.png"

        labels = [r"Promedio Estudiante ($\bar{y}_s$)", r"Dificultad Base ($b_c$)"]
        values = [pred.promedio_estudiante, pred.dificultad_base]
        colors = ["#3498DB", "#95A5A6"]

        for imp in pred.impactos_detallados:
            labels.append(f"{imp.nombre_prerrequisito}\n(w={imp.peso_arista}, Δ={imp.desviacion_nota:+.1f})")
            values.append(imp.impacto_calificacion)
            colors.append("#E74C3C" if imp.impacto_calificacion < 0 else "#2ECC71")

        labels.append(r"Nota Predicha ($\hat{y}_{s,c}$)")
        values.append(pred.nota_predicha)
        colors.append(self.SEMAPHORE_COLORS.get(pred.semaforo, "#34495E"))

        fig, ax = plt.subplots(figsize=(12, 6.5), dpi=300)
        bars = ax.bar(labels, values, color=colors, edgecolor="#2C3E50", linewidth=1.2, width=0.55)

        # Línea de aprobación institucional en Uninorte (3.0)
        ax.axhline(3.0, color="#E74C3C", linestyle="--", linewidth=1.5, label="Umbral de Aprobación Uninorte (3.0)")
        ax.axhline(0.0, color="#2C3E50", linewidth=0.8)

        # Anotaciones numéricas
        for bar, val in zip(bars, values):
            y_pos = bar.get_height()
            v_text = f"{val:.2f}" if abs(val) > 0.001 else "0.00"
            offset = 0.08 if val >= 0 else -0.22
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                y_pos + offset,
                v_text,
                ha="center",
                va="bottom" if val >= 0 else "top",
                fontweight="bold",
                fontsize=9.5
            )

        ax.set_ylabel("Calificación / Impacto Aditivo en Puntos", fontweight="bold")
        ax.set_title(
            f"Explicabilidad de Predicción: {pred.nombre} ({pred.codigo})\n"
            f"Semáforo: {pred.semaforo} | Riesgo: {pred.nivel_riesgo}",
            fontsize=13,
            fontweight="bold"
        )
        ax.legend(loc="upper left")
        plt.xticks(rotation=15, ha="right", fontsize=9)

        # Caja de texto explicativa
        ax.text(
            0.5, -0.32,
            f"DIAGNÓSTICO AUTOMÁTICO:\n{pred.explicacion_principal}",
            transform=ax.transAxes,
            ha="center",
            va="top",
            fontsize=9.5,
            bbox=dict(boxstyle="round,pad=0.5", facecolor="#EAEDED", edgecolor="#BDC3C7")
        )

        plt.tight_layout()
        output_path = os.path.join(self.output_dir, filename)
        plt.savefig(output_path, dpi=300, bbox_inches="tight")
        plt.close(fig)
        return output_path
