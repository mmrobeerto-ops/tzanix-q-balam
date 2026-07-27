import asyncio
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - STRESS TEST - %(message)s')

async def send_request(size: int, is_attack: bool = False):
    try:
        reader, writer = await asyncio.open_connection('127.0.0.1', 8080)
        payload = b"X" * size
        
        logging.info(f"Enviando {'ATAQUE MASIVO' if is_attack else 'Peticion Normal'}: {size} bytes")
        writer.write(payload)
        await writer.drain()
        
        # Esperar respuesta
        data = await reader.read(8192)
        if data:
            logging.info(f"Respuesta recibida: {len(data)} bytes")
        else:
            if is_attack:
                logging.warning("¡CONEXIÓN CERRADA POR EL PROXY! (Kill-Switch funcionó)")
            else:
                logging.error("Conexión cerrada inesperadamente")
                
        writer.close()
        await writer.wait_closed()
    except Exception as e:
        if is_attack:
            logging.warning(f"¡Kill-Switch Exitoso! Error esperado al atacar: {e}")
        else:
            logging.error(f"Fallo en petición normal: {e}")

async def run_stress_test():
    logging.info("=== INICIANDO ENTRENAMIENTO ATR ===")
    # 1. Enviar tráfico estable para establecer la Media Móvil (SMA) y el ATR
    for i in range(5):
        await send_request(size=1024) # 1 KB
        await asyncio.sleep(0.5)
        
    logging.info("=== ENTRENAMIENTO COMPLETADO. ATR ESTABLECIDO ===")
    await asyncio.sleep(2)
    
    logging.info("=== LANZANDO ATAQUE DE EXFILTRACIÓN (HARVEST NOW) ===")
    # 2. Ráfaga masiva simulando extracción de base de datos
    await send_request(size=50 * 1024 * 1024, is_attack=True) # 50 MB

if __name__ == "__main__":
    asyncio.run(run_stress_test())
