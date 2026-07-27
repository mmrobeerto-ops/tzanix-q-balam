import asyncio
import math
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - ENTROPY AUDIT - %(message)s')

def calculate_shannon_entropy(data: bytes) -> float:
    """Calcula la Entropía de Shannon de una secuencia de bytes (0 a 8.0)"""
    if not data:
        return 0.0
    entropy = 0
    for x in range(256):
        p_x = data.count(x) / len(data)
        if p_x > 0:
            entropy += - p_x * math.log2(p_x)
    return entropy

async def intercept_traffic():
    # Conectamos directamente al proxy para "interceptar" el flujo ofuscado
    # Enviamos datos muy repetitivos (entropía bajísima) y verificamos lo que sale
    
    try:
        reader, writer = await asyncio.open_connection('127.0.0.1', 8080)
        
        # Payload muy predecible: entropía cercana a 0
        raw_payload = b"A" * 5000 
        logging.info(f"Enviando payload predecible. Entropía original: {calculate_shannon_entropy(raw_payload):.2f}")
        
        writer.write(raw_payload)
        await writer.drain()
        
        # El proxy responde con el payload + ruido (porque target_server devuelve "DATOS_CONFIDENCIALES: " + raw)
        # pero envuelto en ofuscación.
        data = await reader.read(8192)
        
        if data:
            entropy = calculate_shannon_entropy(data)
            logging.info(f"Paquete interceptado en red. Tamaño: {len(data)} bytes")
            logging.info(f"Entropía de Shannon del paquete: {entropy:.4f} / 8.0")
            
            if entropy > 7.5:
                logging.info("ÉXITO: Entropía casi perfecta (Ruido Blanco). Imposible de descifrar lógicamente.")
            else:
                logging.warning("FALLO: La entropía es muy baja. Los datos son vulnerables.")
        
        writer.close()
        await writer.wait_closed()
        
    except Exception as e:
        logging.error(f"Error en auditoría: {e}")

if __name__ == "__main__":
    logging.info("=== INICIANDO AUDITORÍA DE ENTROPÍA (SIMULACIÓN DE INTERCEPCIÓN) ===")
    asyncio.run(intercept_traffic())
