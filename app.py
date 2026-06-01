# ======================================================
# HYDRORANDO - BACKEND FLASK
# ======================================================

from flask import Flask, jsonify, render_template, request
import sqlite3
import json
import os


# ======================================================
# CONFIGURATION
# ======================================================

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)


DB_PATH = os.path.join(
    BASE_DIR,
    "data",
    "hydrorando.db"
)


# ======================================================
# CONNEXION BASE
# ======================================================

def get_conn():

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn


def empty_feature_collection():

    return {
        "type": "FeatureCollection",
        "features": []
    }


# ======================================================
# CREATION TABLE CONTRIBUTIONS
# ======================================================

def init_db():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            geojson TEXT,
            distance REAL
        )
    """)

    conn.commit()

    conn.close()


init_db()


# ======================================================
# PAGE PRINCIPALE
# ======================================================

@app.route("/")
def index():

    return render_template("index.html")


# ======================================================
# API DONNEES
# ======================================================

@app.route("/api/sentiers")
def get_sentiers():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT geojson
        FROM sentiers
    """)

    data = [
        json.loads(row["geojson"])
        for row in cur.fetchall()
    ]

    conn.close()

    return jsonify(data)


@app.route("/api/fontaines")
def get_fontaines():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT geojson
        FROM fontaines
    """)

    row = cur.fetchone()

    conn.close()

    if row is None:
        return jsonify(empty_feature_collection())

    return jsonify(json.loads(row["geojson"]))


@app.route("/api/lacs")
def get_lacs():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT geojson
        FROM lacs
    """)

    row = cur.fetchone()

    conn.close()

    if row is None:
        return jsonify(empty_feature_collection())

    return jsonify(json.loads(row["geojson"]))


@app.route("/api/rivieres")
def get_rivieres():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT geojson
        FROM rivieres
    """)

    row = cur.fetchone()

    conn.close()

    if row is None:
        return jsonify(empty_feature_collection())

    return jsonify(json.loads(row["geojson"]))


@app.route("/api/limite")
def get_limite():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT geojson
        FROM limite
    """)

    row = cur.fetchone()

    conn.close()

    if row is None:
        return jsonify(empty_feature_collection())

    return jsonify(json.loads(row["geojson"]))


# ======================================================
# CONTRIBUTIONS
# ======================================================

@app.route("/api/save_route", methods=["POST"])
def save_route():

    data = request.json or {}

    geometry = data.get("geometry")

    distance = data.get("distance", None)

    if not geometry:
        return jsonify({"status": "error"}), 400

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        INSERT INTO routes (geojson, distance)
        VALUES (?, ?)
    """, (
        geometry,
        distance
    ))

    conn.commit()

    conn.close()

    return jsonify({"status": "success"})


@app.route("/api/update_route", methods=["POST"])
def update_route():

    data = request.json or {}

    route_id = data.get("id")

    geometry = data.get("geometry")

    distance = data.get("distance", None)

    if not route_id or not geometry:
        return jsonify({"status": "error"}), 400

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        UPDATE routes
        SET geojson = ?, distance = ?
        WHERE id = ?
    """, (
        geometry,
        distance,
        route_id
    ))

    conn.commit()

    conn.close()

    return jsonify({"status": "success"})


@app.route("/api/routes")
def get_routes():

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        SELECT id, geojson
        FROM routes
    """)

    rows = cur.fetchall()

    data = []

    for row in rows:

        try:

            geojson = json.loads(row["geojson"])

            if isinstance(geojson, dict):

                geojson["route_id"] = row["id"]

                data.append(geojson)

        except Exception as e:

            print("Erreur GeoJSON :", e)

    conn.close()

    return jsonify(data)


@app.route("/api/delete_route", methods=["POST"])
def delete_route():

    data = request.json or {}

    route_id = data.get("id")

    if not route_id:
        return jsonify({"status": "error"}), 400

    conn = get_conn()

    cur = conn.cursor()

    cur.execute("""
        DELETE FROM routes
        WHERE id = ?
    """, (
        route_id,
    ))

    conn.commit()

    conn.close()

    return jsonify({"status": "success"})


# ======================================================
# LANCEMENT
# ======================================================

if __name__ == "__main__":

    app.run(debug=True)
