"""
Módulo de Definición y Carga de la Malla Curricular
Representa los nodos (asignaturas) y aristas (prerrequisitos oficiales y blandos).
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Any
import json
from pathlib import Path
import pandas as pd


@dataclass
class Course:
    """Representa un nodo del grafo (Asignatura)."""
    id: str
    codigo: str
    nombre: str
    creditos: int
    semestre: int
    area: str
    dificultad_base: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PrerequisiteEdge:
    """Representa una arista dirigida entre dos asignaturas (u -> v)."""
    source: str
    target: str
    tipo: str  # 'oficial' o 'blanda'
    peso: float = 0.5

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CurriculumDataset:
    """Gestor de datos de la malla curricular."""

    def __init__(self, data_path: Optional[str] = None):
        self.programa: str = "Ingeniería de Sistemas"
        self.universidad: str = "Universidad del Norte"
        self.departamento: str = "Departamento de Ingeniería de Sistemas"
        self.courses: Dict[str, Course] = {}
        self.edges: List[PrerequisiteEdge] = []

        if data_path:
            self.load_from_json(data_path)

    def add_course(self, course: Course) -> None:
        self.courses[course.id] = course

    def add_edge(self, edge: PrerequisiteEdge) -> None:
        self.edges.append(edge)

    def load_from_json(self, file_path: str) -> None:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"No se encontró el archivo: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.programa = data.get("programa", self.programa)
        self.universidad = data.get("universidad", self.universidad)
        self.departamento = data.get("departamento", self.departamento)

        self.courses = {}
        for item in data.get("asignaturas", []):
            course = Course(
                id=item["id"],
                codigo=item["codigo"],
                nombre=item["nombre"],
                creditos=int(item["creditos"]),
                semestre=int(item["semestre"]),
                area=item["area"],
                dificultad_base=float(item.get("dificultad_base", 0.0))
            )
            self.courses[course.id] = course

        self.edges = []
        for item in data.get("aristas", []):
            edge = PrerequisiteEdge(
                source=item["source"],
                target=item["target"],
                tipo=item.get("tipo", "oficial"),
                peso=float(item.get("peso", 0.5))
            )
            self.edges.append(edge)

    def to_dataframes(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        """Exporta los nodos y aristas a DataFrames de Pandas."""
        df_nodes = pd.DataFrame([c.to_dict() for c in self.courses.values()])
        df_edges = pd.DataFrame([e.to_dict() for e in self.edges])
        return df_nodes, df_edges

    def export_csv(self, nodes_csv_path: str, edges_csv_path: str) -> None:
        """Exporta la información a archivos CSV estructurados."""
        df_nodes, df_edges = self.to_dataframes()
        df_nodes.to_csv(nodes_csv_path, index=False, encoding="utf-8")
        df_edges.to_csv(edges_csv_path, index=False, encoding="utf-8")

