import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - TARGET DB - %(message)s')

async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    logging.info(f"Conexión desde Proxy/Cliente: {addr}")
    try:
        while True:
            data = await reader.read(8192)
            if not data:
                break
            # Simulamos devolver datos planos "legibles"
            response = b"DATOS_CONFIDENCIALES: " + data
            writer.write(response)
            await writer.drain()
    except Exception as e:
        logging.error(f"Error de conexión: {e}")
    finally:
        writer.close()

async def main():
    server = await asyncio.start_server(handle_client, '127.0.0.1', 9000)
    logging.info("Servidor destino escuchando en 127.0.0.1:9000 (Sin Encriptar)")
    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
