CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    status TEXT NOT NULL,
    response_speed REAL
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    assigned_service_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_service_id) REFERENCES services(id)
);
