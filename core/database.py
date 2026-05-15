import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.db')
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'schema.sql')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DB_PATH):
        with open(SCHEMA_PATH, 'r') as f:
            schema_script = f.read()
        conn = get_db()
        cursor = conn.cursor()
        cursor.executescript(schema_script)
        conn.commit()
        conn.close()

def query_db(query, args=(), one=False):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    rv = cursor.fetchall()
    conn.commit()
    conn.close()
    return (rv[0] if rv else None) if one else rv

def insert_db(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    conn.commit()
    last_id = cursor.lastrowid
    conn.close()
    return last_id

def delete_db(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    conn.commit()
    conn.close()

def update_db(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, args)
    conn.commit()
    conn.close()
