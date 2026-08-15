import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), 'tzanix.db')

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        # Activar modo WAL para alta concurrencia
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS blocked_ips (
                ip TEXT PRIMARY KEY,
                blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                entropy_score REAL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS traffic_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source_ip TEXT,
                destination TEXT,
                entropy_score REAL,
                bytes_transferred INTEGER,
                action_taken TEXT
            )
        ''')
        conn.commit()

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    try:
        yield conn
    finally:
        conn.close()

def block_ip(ip: str, reason: str, entropy: float):
    with get_db() as conn:
        conn.execute('''
            INSERT OR IGNORE INTO blocked_ips (ip, reason, entropy_score) 
            VALUES (?, ?, ?)
        ''', (ip, reason, entropy))
        conn.commit()

def is_ip_blocked(ip: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute('SELECT 1 FROM blocked_ips WHERE ip = ?', (ip,))
        return cursor.fetchone() is not None

def log_traffic(source_ip: str, destination: str, entropy: float, bytes_transferred: int, action: str):
    with get_db() as conn:
        conn.execute('''
            INSERT INTO traffic_logs (source_ip, destination, entropy_score, bytes_transferred, action_taken)
            VALUES (?, ?, ?, ?, ?)
        ''', (source_ip, destination, entropy, bytes_transferred, action))
        conn.commit()
