import asyncio
import time
import logging
import random
import collections
import numpy as np
import tzanix_core
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

USE_RUST = os.getenv("USE_RUST", "1") == "1"

class QGuardSidecar:
    def __init__(self, target_host, target_port, listen_host='127.0.0.1', listen_port=8080):
        self.target_host = target_host
        self.target_port = target_port
        self.listen_host = listen_host
        self.listen_port = listen_port
        
        self.connection_history = collections.defaultdict(lambda: collections.deque(maxlen=10))
        self.ATR_MULTIPLIER = 3.0

        self.swarm_buffer = []
        self.buffer_lock = asyncio.Lock()
        self.MAX_BUFFER_SIZE = 50
        self.TOKEN_VALIDO = "434c49454e545f49443a545a414e49582d50524f2d544553547c45585049524154494f4e3a323032362d31322d3331.2bf385b34f59deb0e733485307c3712153ad7ba4e08354c1e114169a7046e80f2aa441c432f613ca52970542e022bc21e1f50b89930b406647a07c8648001301"

    async def flush_buffer(self, force=False):
        if len(self.swarm_buffer) < self.MAX_BUFFER_SIZE and not force:
            return
        if not self.swarm_buffer:
            return
            
        data_matrix = np.array(self.swarm_buffer, dtype=np.float64)
        self.swarm_buffer.clear()
        data_3d = np.expand_dims(data_matrix, 0)
        
        if USE_RUST:
            try:
                t0 = time.perf_counter()
                tzanix_core.process_stream_4d(data_3d, license_token=self.TOKEN_VALIDO)
                t1 = time.perf_counter()
                logging.info(f"⚡ [SWARM RUST] Completó en {(t1-t0)*1000:.2f} ms")
            except Exception as e:
                logging.error(f"Error en TZANiX Core: {e}")
        else:
            try:
                t0 = time.perf_counter()
                # Simulación en Python puro del filtro inercial (carga CPU)
                for drone in data_3d:
                    for i in range(len(drone)):
                        if i >= 20:
                            window = drone[i-20:i]
                            # Simular carga pesada de CPU en Python
                            std_dev = np.std(window, axis=0)
                            drone[i] = drone[i] + std_dev * 0.001
                t1 = time.perf_counter()
                logging.info(f"🐍 [PYTHON PURO] Completó en {(t1-t0)*1000:.2f} ms")
            except Exception as e:
                logging.error(f"Error en Python puro: {e}")
        
    def inject_entropy(self, data: bytes) -> bytes:
        noise = bytes([random.randint(0, 255) for _ in range(len(data))])
        obfuscated = bytes([a ^ b for a, b in zip(data, noise)])
        return obfuscated

    def check_anomaly_atr(self, x_vector: str, y_magnitude: int) -> bool:
        history = self.connection_history[x_vector]
        if len(history) < 3:
            history.append(y_magnitude)
            return False
            
        sma = sum(history) / len(history)
        atr = sum(abs(v - sma) for v in history) / len(history)
        if atr == 0:
            atr = 1.0 
            
        upper_band = sma + (self.ATR_MULTIPLIER * atr)
        if y_magnitude > upper_band:
            logging.warning(f"¡ANOMALÍA DETECTADA! (Kill-Switch) IP: {x_vector} | Magnitud: {y_magnitude} | Límite: {upper_band:.2f}")
            return True 
            
        history.append(y_magnitude)
        return False
        
    async def calculate_tesseract_metrics(self, data: bytes, addr: tuple):
        x_vector = f"{addr[0]}:{addr[1]}"
        y_magnitude = len(data)
        z_entropy = random.uniform(0.8, 1.0)
        t_time = time.time()
        return x_vector, y_magnitude, z_entropy, t_time

    async def handle_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        try:
            target_reader, target_writer = await asyncio.open_connection(
                self.target_host, self.target_port)
            
            async def forward(src, dst, direction):
                try:
                    while True:
                        data = await src.read(8192)
                        if not data:
                            break
                            
                        if direction == "Client->Target":
                            x_vector, y_magnitude, z_entropy, t_time = await self.calculate_tesseract_metrics(data, addr)
                            
                            async with self.buffer_lock:
                                self.swarm_buffer.append([float(addr[1]), float(y_magnitude), float(z_entropy), float(t_time)])
                                await self.flush_buffer()

                            is_anomaly = self.check_anomaly_atr(x_vector, y_magnitude)
                            if is_anomaly:
                                return 
                                
                            data = self.inject_entropy(data)
                            
                        dst.write(data)
                        await dst.drain()
                except Exception as e:
                    pass
                finally:
                    dst.close()

            await asyncio.gather(
                forward(reader, target_writer, "Client->Target"),
                forward(target_reader, writer, "Target->Client")
            )
        except Exception as e:
            pass
        finally:
            writer.close()

    async def _auto_flush_loop(self):
        """Fuerza el vaciado del buffer cada 2 milisegundos si hay tráfico rezagado."""
        while True:
            await asyncio.sleep(0.002)
            async with self.buffer_lock:
                if self.swarm_buffer:
                    # Padding: Rust core requiere mínimo 20 eventos para su ventana inercial.
                    while len(self.swarm_buffer) < 20:
                        self.swarm_buffer.append(self.swarm_buffer[-1])
                    await self.flush_buffer(force=True)

    async def start(self):
        server = await asyncio.start_server(
            self.handle_client, self.listen_host, self.listen_port)
        mode = "RUST (TZANiX Swarm)" if USE_RUST else "PYTHON PURO (Legacy)"
        logging.info(f"TZANiX Q-Guard (Sidecar) activado en modo: {mode}")
        
        # Iniciar el recolector de latencia asíncrono
        asyncio.create_task(self._auto_flush_loop())
        
        async with server:
            await server.serve_forever()

if __name__ == "__main__":
    proxy = QGuardSidecar(target_host='127.0.0.1', target_port=9000, listen_port=8080)
    try:
        asyncio.run(proxy.start())
    except KeyboardInterrupt:
        logging.info("TZANiX Q-Guard detenido.")
