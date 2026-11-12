from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings, _parse_cors_origins
from app.db import crear_engine, init_db, normalizar_database_url
from app.main import create_app
from scripts.verificar_export import validar_csv

TOKEN = "token-de-prueba"
SECRETO_HASH = "secreto-prueba"


@pytest.fixture
def client():
    settings = Settings(database_url="sqlite://", admin_token=TOKEN, anon_hash_secret=SECRETO_HASH)
    with TestClient(create_app(settings)) as c:
        yield c


def donacion(**cambios):
    datos = {
        "consentimiento": True,
        "programa": "Ingeniería de Sistemas",
        "version_malla": "ejemplo",
        "notas": [
            {"materia": "CAL1", "periodo": "2025-1", "nota": 3.8},
            {"materia": "cal2", "periodo": "2025-2", "nota": 2.9},
        ],
    }
    return {**datos, **cambios}


def test_guarda_una_donacion_con_id_aleatorio(client):
    r = client.post("/donaciones", json=donacion())
    assert r.status_code == 201
    assert len(r.json()["id"]) == 32
    assert r.json()["notas_guardadas"] == 2
    assert client.get("/donaciones/resumen").json() == {"donaciones": 1, "notas": 2}


def test_sin_consentimiento_no_guarda_nada(client):
    r = client.post("/donaciones", json=donacion(consentimiento=False))
    assert r.status_code == 400
    assert client.get("/donaciones/resumen").json() == {"donaciones": 0, "notas": 0}


def test_rechaza_datos_personales(client):
    r = client.post("/donaciones", json=donacion(nombre="Pepito", codigo="200012345"))
    assert r.status_code == 422


@pytest.mark.parametrize("nota", [-1, 5.1])
def test_rechaza_notas_fuera_de_escala(client, nota):
    r = client.post("/donaciones", json=donacion(notas=[{"materia": "CAL1", "periodo": "2025-1", "nota": nota}]))
    assert r.status_code == 422


def test_rechaza_materias_que_no_estan_en_la_malla(client):
    r = client.post("/donaciones", json=donacion(notas=[{"materia": "XYZ", "periodo": "2025-1", "nota": 4}]))
    assert r.status_code == 400
    assert "XYZ" in r.json()["detail"]


def test_exportar_requiere_token(client):
    client.post("/donaciones", json=donacion())
    assert client.get("/donaciones/export.csv").status_code == 403
    assert client.get("/donaciones/export.csv", headers={"X-Admin-Token": "otro"}).status_code == 403

    r = client.get("/donaciones/export.csv", headers={"X-Admin-Token": TOKEN})
    assert r.status_code == 200
    lineas = r.text.strip().splitlines()
    assert lineas[0] == "estudiante,materia,periodo,nota"
    assert len(lineas) == 3
    assert lineas[2].split(",")[1:] == ["CAL2", "2025-2", "2.9"]


def test_salud(client):
    assert client.get("/salud").json() == {"estado": "ok"}


def test_normaliza_espacios_y_mayusculas_en_materia(client):
    r = client.post("/donaciones", json=donacion(notas=[{"materia": " cal1 ", "periodo": "2025-1", "nota": 4.2}]))
    assert r.status_code == 201
    csv_text = client.get("/donaciones/export.csv", headers={"X-Admin-Token": TOKEN}).text
    assert ",CAL1,2025-1,4.2" in csv_text


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_rechaza_nota_nan_o_infinito(client, literal):
    r = client.post(
        "/donaciones",
        content=(
            '{"consentimiento": true, "programa": "Ingeniería de Sistemas", "version_malla": "ejemplo", '
            f'"notas": [{{"materia": "CAL1", "periodo": "2025-1", "nota": {literal}}}]}}'
        ),
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 422


def test_rechaza_materia_duplicada_mismo_periodo(client):
    r = client.post(
        "/donaciones",
        json=donacion(
            notas=[
                {"materia": "CAL1", "periodo": "2025-1", "nota": 3.5},
                {"materia": "cal1", "periodo": "2025-1", "nota": 4.0},
            ]
        ),
    )
    assert r.status_code == 400
    assert "CAL1 (2025-1)" in r.json()["detail"]


def test_permite_materia_repetida_en_distinto_periodo(client):
    r = client.post(
        "/donaciones",
        json=donacion(
            notas=[
                {"materia": "CAL1", "periodo": "2024-2", "nota": 2.4},
                {"materia": "CAL1", "periodo": "2025-1", "nota": 3.7},
            ]
        ),
    )
    assert r.status_code == 201
    assert r.json()["notas_guardadas"] == 2


def test_deduplica_reenvio_identico_con_huella(client):
    notas = [
        {"materia": "CAL1", "periodo": "2024-1", "nota": 3.8},
        {"materia": "PROG1", "periodo": "2024-1", "nota": 4.1},
        {"materia": "CAL2", "periodo": "2024-2", "nota": 3.2},
    ]
    r1 = client.post("/donaciones", json=donacion(notas=notas))
    assert r1.status_code == 201

    # Mismas notas en distinto orden: debe detectarse como duplicada (409) sin guardar otra fila.
    r2 = client.post("/donaciones", json=donacion(notas=list(reversed(notas))))
    assert r2.status_code == 409
    assert client.get("/donaciones/resumen").json() == {"donaciones": 1, "notas": 3}

    # Si cambia una nota, sí se guarda.
    notas_distintas = [*notas[:2], {"materia": "CAL2", "periodo": "2024-2", "nota": 3.3}]
    r3 = client.post("/donaciones", json=donacion(notas=notas_distintas))
    assert r3.status_code == 201
    assert client.get("/donaciones/resumen").json() == {"donaciones": 2, "notas": 6}


def test_exportar_filtra_por_version_malla_y_programa(client):
    client.post(
        "/donaciones",
        json=donacion(
            version_malla="ejemplo",
            notas=[{"materia": "CAL1", "periodo": "2024-1", "nota": 3.5}],
        ),
    )
    client.post(
        "/donaciones",
        json=donacion(
            programa="Ingeniería Civil",
            version_malla="oficial-2026",
            notas=[{"materia": "CAL2", "periodo": "2025-1", "nota": 4.3}],
        ),
    )

    r_ver = client.get("/donaciones/export.csv?version_malla=oficial-2026", headers={"X-Admin-Token": TOKEN})
    assert r_ver.status_code == 200
    lineas = r_ver.text.strip().splitlines()
    assert len(lineas) == 2
    assert lineas[1].split(",")[1:] == ["CAL2", "2025-1", "4.3"]

    r_prog = client.get(
        "/donaciones/export.csv?programa=Ingeniería%20de%20Sistemas",
        headers={"X-Admin-Token": TOKEN},
    )
    assert len(r_prog.text.strip().splitlines()) == 2
    assert "CAL1" in r_prog.text


def test_meta_y_estadisticas(client):
    meta = client.get("/donaciones/meta")
    assert meta.status_code == 200
    cuerpo = meta.json()
    assert cuerpo["programa"] == "Ingeniería de Sistemas"
    assert any(m["id"] == "CAL1" for m in cuerpo["materias"])

    client.post("/donaciones", json=donacion())
    stats = client.get("/donaciones/estadisticas")
    assert stats.status_code == 200
    d = stats.json()
    assert d["donaciones"] == 1
    assert d["notas"] == 2
    assert d["por_version"][0]["version_malla"] == "ejemplo"
    assert d["por_materia"] == {"CAL1": 1, "CAL2": 1}


def test_formulario_donar_sirve_html(client):
    r = client.get("/donar")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Ley 1581 de 2012" in r.text


def test_rate_limit_bloquea_rafaga():
    settings = Settings(database_url="sqlite://", admin_token=TOKEN, rate_limit_max=2, rate_limit_window_sec=60)
    with TestClient(create_app(settings)) as c:
        assert c.post("/donaciones", json=donacion()).status_code == 201
        assert c.post("/donaciones", json=donacion()).status_code == 201
        r3 = c.post("/donaciones", json=donacion())
        assert r3.status_code == 429


def test_salud_devuelve_503_si_falla_db(client, monkeypatch):
    def fallar(_engine):
        raise SQLAlchemyError("db caída")

    monkeypatch.setattr("app.main.verificar_db", fallar)
    r = client.get("/salud")
    assert r.status_code == 503


def test_falla_al_arrancar_si_falta_malla():
    settings = Settings(database_url="sqlite://", malla_path=Path("no_existe_malla.json"))
    with pytest.raises(FileNotFoundError):
        with TestClient(create_app(settings)):
            pass


def test_utilidades_config_y_postgres_url():
    assert normalizar_database_url("postgres://user:pass@host:5432/db") == "postgresql+psycopg://user:pass@host:5432/db"
    assert (
        normalizar_database_url("postgresql://user:pass@host:5432/db")
        == "postgresql+psycopg://user:pass@host:5432/db"
    )
    assert normalizar_database_url("sqlite:///./gradly.db") == "sqlite:///./gradly.db"
    assert _parse_cors_origins(" https://gradly.vercel.app , http://localhost:5173 , ") == [
        "https://gradly.vercel.app",
        "http://localhost:5173",
    ]


def test_init_db_migra_columna_huella_si_falta():
    engine = crear_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text("CREATE TABLE donacion (id VARCHAR PRIMARY KEY, fecha DATE, programa VARCHAR, version_malla VARCHAR)")
        )
    init_db(engine)
    cols = {c["name"] for c in inspect(engine).get_columns("donacion")}
    assert "huella" in cols
    engine.dispose()


def test_validar_csv_exportado(client):
    notas = [
        {"materia": "CAL1", "periodo": "2024-1", "nota": 3.8},
        {"materia": "CAL2", "periodo": "2024-2", "nota": 3.1},
        {"materia": "ED", "periodo": "2025-1", "nota": 3.5},
    ]
    assert client.post("/donaciones", json=donacion(notas=notas)).status_code == 201
    csv_text = client.get("/donaciones/export.csv", headers={"X-Admin-Token": TOKEN}).text
    res = validar_csv(csv_text)
    assert res["errores"] == []
    assert res["estudiantes"] == 1
    assert res["estudiantes_multi_periodo"] == 1
    assert res["total_notas"] == 3
