import os
import asyncio
import httpx
import json
from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from core.entropy import calculate_shannon_entropy
from core.db import init_db, is_ip_blocked, block_ip, log_traffic
from core.soc_logger import log_soc_event

app = FastAPI(title="TZANiX Q-Balam Proxy Engine")

# Configuración de Seguridad
SECURITY_MODE = os.getenv("SECURITY_MODE", "AUDIT") # AUDIT o ENFORCE
ENTROPY_THRESHOLD = 7.5
TARGET_URL = os.getenv("TARGET_URL", "http://localhost:8000") # Donde viva la BD/API real

# Inicializar DB SQLite
init_db()

# Clientes WebSockets conectados (Dashboard de React)
ws_clients = []

async def broadcast_ws_event(event_type: str, source_ip: str, entropy: float):
    if not ws_clients:
        return
    msg = json.dumps({
        "event_type": event_type,
        "source_ip": source_ip,
        "entropy_score": entropy
    })
    for client in ws_clients:
        try:
            await client.send_text(msg)
        except Exception:
            pass

@app.on_event("startup")
async def startup_event():
    print(f"🚀 TZANiX Proxy Iniciado. Modo: {SECURITY_MODE}")

@app.get("/health")
async def health_check():
    """
    Endpoint para Fail-Open. El balanceador verifica este endpoint para saber si debe bypassar el proxy.
    """
    return {"status": "ok", "latency": "sub-ms", "mode": SECURITY_MODE}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    ws_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_clients.remove(websocket)

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def reverse_proxy(request: Request, path: str):
    """
    Interceptor principal. Inspecciona el payload, calcula la entropía, registra en SOC, y reenvía (Proxy).
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # 1. Chequeo de IP Bloqueada en SQLite (Caché rápido)
    if is_ip_blocked(client_ip):
        return Response(content="Blocked by TZANiX ATR", status_code=403)
        
    # 2. Extraer Payload para análisis (sin persistir en texto plano)
    payload_bytes = await request.body()
    entropy_score = calculate_shannon_entropy(payload_bytes)
    payload_len = len(payload_bytes)
    
    action_taken = "ALLOW"
    mitre_tags = []
    
    # 3. Reglas Analíticas
    if entropy_score > ENTROPY_THRESHOLD:
        mitre_tags.append("T1190") # Exploit Public-Facing Application (Alta entropía entrante)
        
        if SECURITY_MODE == "ENFORCE":
            block_ip(client_ip, "Alta Entropía - Zero-Day Inbound", entropy_score)
            action_taken = "BLOCK"
            
            # Emitir Evento Crítico a SIEM
            log_soc_event(client_ip, TARGET_URL, entropy_score, payload_len, action_taken, mitre_tags)
            log_traffic(client_ip, TARGET_URL, entropy_score, payload_len, action_taken)
            
            # Avisar al Holograma 3D para animación carmesí
            asyncio.create_task(broadcast_ws_event("ATR_KILL_SWITCH", client_ip, entropy_score))
            
            return Response(content="Anomaly detected and neutralized", status_code=403)
            
        else:
            # Modo Auditoría
            action_taken = "SIMULATED_BLOCK"
            asyncio.create_task(broadcast_ws_event("TRAFFIC_FLOW", client_ip, entropy_score))

    else:
        # Flujo Normal
        asyncio.create_task(broadcast_ws_event("TRAFFIC_FLOW", client_ip, entropy_score))

    # Emitir Evento SOC regular (si se requiere traza de todo, o solo de anomalías)
    # En producción a gran escala solo se emiten logs de anomalías para ahorrar storage SIEM
    if action_taken != "ALLOW":
        log_soc_event(client_ip, TARGET_URL, entropy_score, payload_len, action_taken, mitre_tags)
    
    log_traffic(client_ip, TARGET_URL, entropy_score, payload_len, action_taken)

    # 4. Proxy Forwarding (Reenvío al backend real)
    async with httpx.AsyncClient() as client:
        # Nota: En un proxy real de producción se deben sanear los headers
        try:
            proxy_response = await client.request(
                method=request.method,
                url=f"{TARGET_URL}/{path}",
                headers=dict(request.headers),
                content=payload_bytes,
                params=request.query_params
            )
            return Response(
                content=proxy_response.content,
                status_code=proxy_response.status_code,
                headers=dict(proxy_response.headers)
            )
        except httpx.RequestError:
            # Backend caído
            return Response(content="Target Backend Unavailable", status_code=502)

if __name__ == "__main__":
    import uvicorn
    # Iniciar servidor proxy
    uvicorn.run("main:app", host="0.0.0.0", port=8081, log_level="info")
