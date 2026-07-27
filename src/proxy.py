import asyncio
import time
import logging
import random
import collections

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class QGuardSidecar:
    def __init__(self, target_host, target_port, listen_host='127.0.0.1', listen_port=8080):
        self.target_host = target_host
        self.target_port = target_port
        self.listen_host = listen_host
        self.listen_port = listen_port
        
        # Estado para el Filtro Dinámico (ATR / Volatilidad)
        self.connection_history = collections.defaultdict(lambda: collections.deque(maxlen=10))
        self.ATR_MULTIPLIER = 3.0 # Sensibilidad del Kill-Switch
        
    def inject_entropy(self, data: bytes) -> bytes:
        """
        Fase 3: Capa de Enmascaramiento y Ruido.
        Inyecta ruido matemático al payload. (Simulación de ofuscación poscuántica).
        """
        noise = bytes([random.randint(0, 255) for _ in range(len(data))])
        # XOR básico simulando cifrado de alta entropía
        obfuscated = bytes([a ^ b for a, b in zip(data, noise)])
        return obfuscated

    def check_anomaly_atr(self, x_vector: str, y_magnitude: int) -> bool:
        """
        Fase 4: Filtros Dinámicos (Volumen Delta / ATR)
        Calcula si el volumen de la petición actual es anómalo respecto al historial de este IP.
        """
        history = self.connection_history[x_vector]
        
        if len(history) < 3:
            # No hay suficiente historial, asumimos que es normal por ahora
            history.append(y_magnitude)
            return False
            
        # Calcular media móvil simple (SMA)
        sma = sum(history) / len(history)
        
        # Calcular ATR simplificado (desviación media)
        atr = sum(abs(v - sma) for v in history) / len(history)
        if atr == 0:
            atr = 1.0 # Evitar división por cero
            
        # Determinar si la magnitud actual rompe el rango de volatilidad normal
        upper_band = sma + (self.ATR_MULTIPLIER * atr)
        
        if y_magnitude > upper_band:
            logging.warning(f"¡ANOMALÍA DETECTADA! (Kill-Switch) IP: {x_vector} | Magnitud: {y_magnitude} | Límite: {upper_band:.2f}")
            return True # Es anómalo
            
        history.append(y_magnitude)
        return False
        
    async def calculate_tesseract_metrics(self, data: bytes, addr: tuple):
        """
        Mapeo del modelo Tesseract ($X,Y,Z,T$)
        X: Source Vector (IP, Puerto)
        Y: Transfer Magnitude (Tamaño del payload en bytes)
        Z: Entropy/Noise (Nivel de ofuscación, por implementar)
        T: Time (Marca temporal de la transacción)
        """
        x_vector = f"{addr[0]}:{addr[1]}"
        y_magnitude = len(data)
        
        # Se calcula la entropía del paquete (Z). Para el PoC, usamos la ofuscación inyectada.
        z_entropy = random.uniform(0.8, 1.0) # Representa % de ofuscación
        t_time = time.time()
        
        logging.info(f"TESSERACT MAP -> X:[{x_vector}] Y:[{y_magnitude} bytes] Z:[{z_entropy:.2f}] T:[{t_time}]")
        return x_vector, y_magnitude, z_entropy, t_time

    async def handle_client(self, reader, writer):
        addr = writer.get_extra_info('peername')
        logging.info(f"Conexión entrante interceptada desde {addr}")

        try:
            # Conectar con el destino real (ej. la Base de Datos del cliente)
            target_reader, target_writer = await asyncio.open_connection(
                self.target_host, self.target_port)
            
            async def forward(src, dst, direction):
                try:
                    while True:
                        data = await src.read(4096)
                        if not data:
                            break
                            
                        # Intercepción & Mapeo
                        if direction == "Client->Target":
                            x_vector, y_magnitude, _, _ = await self.calculate_tesseract_metrics(data, addr)
                            
                            # Filtro Dinámico (Kill-Switch)
                            is_anomaly = self.check_anomaly_atr(x_vector, y_magnitude)
                            if is_anomaly:
                                logging.error(f"Kill-Switch Activado. Desconectando {x_vector}")
                                return # Corta la conexión inmediatamente
                                
                            # Capa de Enmascaramiento y Ruido
                            data = self.inject_entropy(data)
                            
                        dst.write(data)
                        await dst.drain()
                except Exception as e:
                    logging.error(f"Error en el puente {direction}: {e}")
                finally:
                    dst.close()

            # Iniciar el reenvío bidireccional
            await asyncio.gather(
                forward(reader, target_writer, "Client->Target"),
                forward(target_reader, writer, "Target->Client")
            )
        except Exception as e:
            logging.error(f"Conexión bloqueada o destino inalcanzable: {e}")
        finally:
            writer.close()

    async def start(self):
        server = await asyncio.start_server(
            self.handle_client, self.listen_host, self.listen_port)

        addrs = ', '.join(str(sock.getsockname()) for sock in server.sockets)
        logging.info(f"TZANiX Q-Guard (Sidecar) activado y escuchando en {addrs}")
        logging.info(f"Protegiendo destino: {self.target_host}:{self.target_port}")

        async with server:
            await server.serve_forever()

if __name__ == "__main__":
    # Simulación: Protegiendo una DB o API que corre en el puerto 9000
    # Q-Guard escucha en el 8080
    proxy = QGuardSidecar(target_host='127.0.0.1', target_port=9000, listen_port=8080)
    try:
        asyncio.run(proxy.start())
    except KeyboardInterrupt:
        logging.info("TZANiX Q-Guard detenido.")
