"""
Módulo Central de Teoría de Grafos y Matemáticas Discretas
Implementación rigurosa de algoritmos sobre Grafos Dirigidos Acíclicos (DAG).
"""

from typing import List, Dict, Set, Tuple, Optional, Any
from collections import deque
import networkx as nx
import pandas as pd
from .curriculum import CurriculumDataset, Course, PrerequisiteEdge


class CurriculumGraph:
    """
    Modelado formal de la malla curricular como un Grafo Dirigido G = (V, E).
    Proporciona algoritmos de Matemáticas Discretas para análisis estructural.
    """

    def __init__(self, dataset: CurriculumDataset, include_soft_edges: bool = True):
        self.dataset = dataset
        self.include_soft_edges = include_soft_edges
        self.nx_graph: nx.DiGraph = nx.DiGraph()
        self._build_graph()

    def _build_graph(self) -> None:
        """Construye el DiGraph de NetworkX con atributos de nodos y aristas."""
        self.nx_graph.clear()

        # Agregar nodos (V)
        for c in self.dataset.courses.values():
            self.nx_graph.add_node(
                c.id,
                codigo=c.codigo,
                nombre=c.nombre,
                creditos=c.creditos,
                semestre=c.semestre,
                area=c.area,
                dificultad_base=c.dificultad_base
            )

        # Agregar aristas (E)
        for e in self.dataset.edges:
            if not self.include_soft_edges and e.tipo == "blanda":
                continue
            self.nx_graph.add_edge(
                e.source,
                e.target,
                tipo=e.tipo,
                peso=e.peso,
                weight=1.0  # Peso unitario por salto para camino más largo en semestres
            )

    @property
    def nodes(self) -> List[str]:
        return list(self.nx_graph.nodes())

    @property
    def edges(self) -> List[Tuple[str, str]]:
        return list(self.nx_graph.edges())

    def get_course(self, course_id: str) -> Course:
        if course_id not in self.dataset.courses:
            raise KeyError(f"Asignatura no encontrada: {course_id}")
        return self.dataset.courses[course_id]

    # =========================================================================
    # 1. VERIFICACIÓN DE GRAFO DIRIGIDO ACÍCLICO (DAG) Y DETECCIÓN DE CICLOS
    # =========================================================================

    def is_dag(self) -> bool:
        """
        Verifica si el grafo es un DAG (no contiene ciclos dirigidos).
        """
        return nx.is_directed_acyclic_graph(self.nx_graph)

    def find_cycles_dfs(self) -> List[List[str]]:
        """
        Algoritmo clásico de detección de ciclos por coloreado DFS (Blanco, Gris, Negro).
        Retorna la lista de ciclos dirigidos encontrados si existieran.
        
        Estados:
        - 0 (Blanco): Nodo no visitado
        - 1 (Gris): Nodo en la pila de recursión actual (ancestro activo)
        - 2 (Negro): Nodo y todos sus descendientes completamente procesados
        """
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {n: WHITE for n in self.nx_graph.nodes()}
        parent = {n: None for n in self.nx_graph.nodes()}
        cycles: List[List[str]] = []

        def dfs_visit(u: str, path: List[str]):
            color[u] = GRAY
            path.append(u)

            for v in self.nx_graph.successors(u):
                if color[v] == GRAY:
                    # Se detectó una arista hacia atrás (Back-Edge): ¡Ciclo encontrado!
                    idx = path.index(v)
                    cycle = path[idx:] + [v]
                    cycles.append(cycle)
                elif color[v] == WHITE:
                    parent[v] = u
                    dfs_visit(v, path)

            path.pop()
            color[u] = BLACK

        for node in list(self.nx_graph.nodes()):
            if color[node] == WHITE:
                dfs_visit(node, [])

        return cycles

    # =========================================================================
    # 2. ORDEN TOPOLÓGICO (TOPOLOGICAL SORT - ALGORITMO DE KAHN)
    # =========================================================================

    def topological_sort_kahn(self) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Calcula el orden topológico mediante el Algoritmo de Kahn (basado en grado de entrada).
        
        Retorna:
        - order: Lista de IDs ordenados topológicamente.
        - trace: Pasos ejecutados paso a paso (útil con fines pedagógicos para la clase).
        """
        in_degree = {n: self.nx_graph.in_degree(n) for n in self.nx_graph.nodes()}
        queue = deque([n for n, deg in in_degree.items() if deg == 0])
        order: List[str] = []
        trace: List[Dict[str, Any]] = []

        step = 0
        while queue:
            step += 1
            u = queue.popleft()
            order.append(u)

            reduced_neighbors = []
            for v in self.nx_graph.successors(u):
                in_degree[v] -= 1
                if in_degree[v] == 0:
                    queue.append(v)
                    reduced_neighbors.append(v)

            trace.append({
                "paso": step,
                "nodo_extraido": u,
                "grado_cero_nuevos": reduced_neighbors,
                "cola_actual": list(queue)
            })

        if len(order) != self.nx_graph.number_of_nodes():
            raise ValueError("El grafo contiene ciclos. No existe un orden topológico completo.")

        return order, trace

    def verify_topological_order(self, order: List[str]) -> bool:
        """
        Verifica formalmente la propiedad de orden topológico:
        Para cada arista dirigida (u, v) in E, la posición de u debe ser menor a la posición de v.
        """
        pos = {node: i for i, node in enumerate(order)}
        for u, v in self.nx_graph.edges():
            if pos[u] >= pos[v]:
                return False
        return True

    # =========================================================================
    # 3. CAMINO MÁS LARGO Y CAMINO CRÍTICO (CRITICAL PATH METHOD - CPM)
    # =========================================================================

    def compute_critical_path(self, weight_attr: Optional[str] = None) -> Dict[str, Any]:
        """
        Calcula el Camino Crítico (Longest Path en un DAG) mediante Programación Dinámica
        sobre el Orden Topológico en complejidad O(|V| + |E|).
        
        En la malla curricular, representa la cadena de prerrequisitos más extensa que
        determina el tiempo mínimo teórico para culminar el plan de estudios.
        
        Parámetros:
        - weight_attr: Atributo de ponderación (None para contar saltos/semestres, 'creditos' para créditos acumulados).
        """
        order, _ = self.topological_sort_kahn()

        # Distancias más largas hacia adelante (Earliest Start / Longest Path to node)
        dist_forward: Dict[str, float] = {n: 0.0 for n in order}
        pred_map: Dict[str, Optional[str]] = {n: None for n in order}

        for u in order:
            for v in self.nx_graph.successors(u):
                edge_w = 1.0 if not weight_attr else float(self.nx_graph.nodes[u].get(weight_attr, 1.0))
                if dist_forward[u] + edge_w > dist_forward[v]:
                    dist_forward[v] = dist_forward[u] + edge_w
                    pred_map[v] = u

        # Nodo final con mayor distancia
        max_dist = max(dist_forward.values())
        terminal_nodes = [n for n, d in dist_forward.items() if d == max_dist]
        end_node = terminal_nodes[0]

        # Reconstrucción del camino crítico
        critical_path = []
        curr = end_node
        while curr is not None:
            critical_path.append(curr)
            curr = pred_map[curr]
        critical_path.reverse()

        # Cálculo de holgura (Slack) para cada nodo:
        # Longitud máxima total
        total_len = max_dist

        # Distancia inversa hacia atrás (Latest Start)
        dist_backward: Dict[str, float] = {n: total_len for n in reversed(order)}
        sinks = [n for n in order if self.nx_graph.out_degree(n) == 0]
        for s in sinks:
            dist_backward[s] = dist_forward[s]

        for u in reversed(order):
            for v in self.nx_graph.successors(u):
                edge_w = 1.0 if not weight_attr else float(self.nx_graph.nodes[u].get(weight_attr, 1.0))
                dist_backward[u] = min(dist_backward[u], dist_backward[v] - edge_w)

        slack: Dict[str, float] = {}
        for n in order:
            slack[n] = max(0.0, round(dist_backward[n] - dist_forward[n], 4))

        critical_nodes = [n for n, s in slack.items() if s == 0.0]

        return {
            "distancia_maxima": max_dist,
            "camino_critico": critical_path,
            "materias_camino_critico": [self.get_course(cid).nombre for cid in critical_path],
            "holgura": slack,
            "nodos_criticos_holgura_cero": critical_nodes,
            "distancias_adelante": dist_forward,
            "distancias_atras": dist_backward
        }

    # =========================================================================
    # 4. ANÁLISIS DE CENTRALIDAD Y CUELLOS DE BOTELLA
    # =========================================================================

    def compute_centrality_metrics(self) -> pd.DataFrame:
        """
        Calcula métricas clave de centralidad para cada asignatura:
        - In-Degree (Prerrequisitos directos necesarios)
        - Out-Degree (Materias que desbloquea directamente - Llaves)
        - Betweenness Centrality (Frecuencia en que actúa como puente/cuello de botella)
        - Closeness Centrality (Cercanía a toda la red)
        - PageRank (Relevancia estructural)
        """
        in_degrees = dict(self.nx_graph.in_degree())
        out_degrees = dict(self.nx_graph.out_degree())
        betweenness = nx.betweenness_centrality(self.nx_graph, normalized=True)
        closeness = nx.closeness_centrality(self.nx_graph)
        try:
            pagerank = nx.pagerank(self.nx_graph, alpha=0.85)
        except Exception:
            pagerank = {n: 0.0 for n in self.nx_graph.nodes()}

        data = []
        for n in self.nx_graph.nodes():
            c = self.get_course(n)
            desc_count = len(nx.descendants(self.nx_graph, n))
            anc_count = len(nx.ancestors(self.nx_graph, n))
            data.append({
                "id": n,
                "codigo": c.codigo,
                "nombre": c.nombre,
                "semestre": c.semestre,
                "area": c.area,
                "creditos": c.creditos,
                "grado_entrada_indegree": in_degrees[n],
                "grado_salida_outdegree": out_degrees[n],
                "total_descendientes": desc_count,
                "total_ancestros": anc_count,
                "intermediacion_betweenness": round(betweenness[n], 4),
                "cercania_closeness": round(closeness[n], 4),
                "pagerank": round(pagerank[n], 4)
            })

        df = pd.DataFrame(data)
        # Ordenar por mayor impacto estructural (Betweenness y Out-Degree)
        df = df.sort_values(by=["intermediacion_betweenness", "grado_salida_outdegree"], ascending=False)
        return df.reset_index(drop=True)

    # =========================================================================
    # 5. ANÁLISIS DE IMPACTO EN CASCADA (DESCENDIENTES Y ANCESTROS)
    # =========================================================================

    def analyze_cascade_impact(self, course_id: str) -> Dict[str, Any]:
        """
        Evalúa el impacto en cascada de perder una asignatura:
        - Descendientes inmediatos (Nivel 1 de bloqueo)
        - Todos los descendientes transitivos (Bloqueo a mediano y largo plazo)
        - Créditos académicos bloqueados
        - Impacto en retraso potencial de grado
        """
        if course_id not in self.nx_graph:
            raise KeyError(f"Asignatura {course_id} no existe en el grafo.")

        course = self.get_course(course_id)
        direct_children = list(self.nx_graph.successors(course_id))
        all_descendants = set(nx.descendants(self.nx_graph, course_id))

        # Agrupar descendientes por nivel de distancia
        levels: Dict[int, List[str]] = {}
        for desc in all_descendants:
            paths = list(nx.all_simple_paths(self.nx_graph, course_id, desc))
            min_dist = min(len(p) - 1 for p in paths)
            levels.setdefault(min_dist, []).append(desc)

        blocked_credits = sum(self.get_course(d).creditos for d in all_descendants)

        # Verificar si está en el camino crítico
        crit_info = self.compute_critical_path()
        is_critical = course_id in crit_info["camino_critico"]

        return {
            "asignatura_origen": course.to_dict(),
            "bloqueo_inmediato": [self.get_course(d).to_dict() for d in direct_children],
            "total_bloqueo_inmediato": len(direct_children),
            "total_descendientes_bloqueados": len(all_descendants),
            "creditos_bloqueados": blocked_credits,
            "descendientes_por_nivel": {
                lvl: [self.get_course(cid).nombre for cid in cids]
                for lvl, cids in sorted(levels.items())
            },
            "pertenece_a_camino_critico": is_critical,
            "severidad_retraso": "CRÍTICA (Retrasa graduación directamente)" if is_critical else "ALTA" if len(all_descendants) > 5 else "MODERADA"
        }

    # =========================================================================
    # 6. ESTRATIFICACIÓN TOPOLÓGICA POR NIVELES SEMESTRALES
    # =========================================================================

    def compute_topological_levels(self) -> Dict[int, List[str]]:
        """
        Agrupa los nodos en capas o niveles topológicos basados en la distancia
        máxima desde cualquier nodo fuente (in-degree == 0).
        Esto define el semestre mínimo teórico en el cual se puede matricular cada materia.
        """
        order, _ = self.topological_sort_kahn()
        node_level: Dict[str, int] = {}

        for u in order:
            preds = list(self.nx_graph.predecessors(u))
            if not preds:
                node_level[u] = 1
            else:
                node_level[u] = max(node_level[p] for p in preds) + 1

        levels: Dict[int, List[str]] = {}
        for node, lvl in node_level.items():
            levels.setdefault(lvl, []).append(node)

        return dict(sorted(levels.items()))

    # =========================================================================
    # 7. EXPORTACIÓN PARA VISUALIZACIÓN WEB (CYTOSCAPE / JSON)
    # =========================================================================

    def to_cytoscape_elements(self) -> List[Dict[str, Any]]:
        """
        Exporta el grafo al formato estándar de Cytoscape.js o React Flow,
        alineado con la arquitectura web del proyecto mencionada en la Sección 3.1 del informe.
        """
        elements = []
        for n, data in self.nx_graph.nodes(data=True):
            elements.append({
                "group": "nodes",
                "data": {
                    "id": n,
                    "label": f"{data['nombre']}\n({n})",
                    "codigo": data["codigo"],
                    "creditos": data["creditos"],
                    "semestre": data["semestre"],
                    "area": data["area"],
                    "dificultad": data["dificultad_base"]
                }
            })

        for u, v, data in self.nx_graph.edges(data=True):
            elements.append({
                "group": "edges",
                "data": {
                    "id": f"{u}->{v}",
                    "source": u,
                    "target": v,
                    "tipo": data.get("tipo", "oficial"),
                    "peso": data.get("peso", 0.5)
                }
            })

        return elements

