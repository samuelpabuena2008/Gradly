import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TOKEN = "token-de-prueba"


@pytest.fixture
def client():
    settings = Settings(database_url="sqlite://", admin_token=TOKEN)
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
