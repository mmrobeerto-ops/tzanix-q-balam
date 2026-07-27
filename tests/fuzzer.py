import socket
import logging
import random
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - FUZZER - %(message)s')

def generate_malformed_packet():
    # Generar bytes completamente basura sin formato válido
    return bytes([random.randint(0, 255) for _ in range(random.randint(100, 2000))])

def fuzz_proxy():
    host = '127.0.0.1'
    port = 8080
    
    logging.info("=== INICIANDO PRUEBA DE RESILIENCIA (FUZZING) ===")
    
    for i in range(10):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            s.connect((host, port))
            
            # Prueba 1: Enviar basura malformada
            junk = generate_malformed_packet()
            logging.info(f"Iteración {i+1}: Inyectando paquete corrupto ({len(junk)} bytes)")
            s.send(junk)
            
            # Prueba 2: Conexión entreabierta (Drop de conexión repentino)
            if i % 2 == 0:
                logging.info(f"Iteración {i+1}: Cerrando socket inesperadamente (Slowloris simulado)")
                s.close()
                continue
                
            try:
                response = s.recv(1024)
            except socket.timeout:
                pass
                
            s.close()
            time.sleep(0.1)
        except Exception as e:
            logging.warning(f"Iteración {i+1} bloqueada por Fail-Safe: {e}")
            
    logging.info("=== PRUEBA DE FUZZING COMPLETADA ===")
    logging.info("Si el proxy sigue en pie y sirviendo peticiones normales, la prueba es un ÉXITO.")

if __name__ == "__main__":
    fuzz_proxy()
