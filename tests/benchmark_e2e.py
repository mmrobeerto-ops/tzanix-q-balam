import asyncio
import time
import psutil
import subprocess
import os
import sys

# Test configuration
TEST_DURATION_SECONDS = 30
CONCURRENCY = 20
PAYLOAD_SIZE = 1024 # 1 KB

async def client_worker(worker_id, results):
    """Simula un cliente enviando datos de telemetría constantemente y midiendo latencia RTT."""
    latencies = []
    end_time = time.time() + TEST_DURATION_SECONDS
    
    while time.time() < end_time:
        try:
            # Conectar al proxy
            reader, writer = await asyncio.open_connection('127.0.0.1', 8080)
            payload = b"X" * PAYLOAD_SIZE
            
            t0 = time.time()
            writer.write(payload)
            await writer.drain()
            
            # Esperar respuesta del target (a través del proxy)
            data = await reader.read(8192)
            t1 = time.time()
            
            if data:
                latencies.append((t1 - t0) * 1000) # En ms
                
            writer.close()
            await writer.wait_closed()
            # Breve pausa para no agotar los sockets del OS instantáneamente
            await asyncio.sleep(0.01)
        except Exception as e:
            await asyncio.sleep(0.1)
            
    results[worker_id] = latencies

async def resource_monitor(proxy_pid, monitor_results):
    """Monitorea el consumo de CPU y RAM del proceso Proxy."""
    try:
        process = psutil.Process(proxy_pid)
        cpu_percentages = []
        ram_mb = []
        
        end_time = time.time() + TEST_DURATION_SECONDS
        while time.time() < end_time:
            cpu_percentages.append(process.cpu_percent(interval=0.5))
            ram_mb.append(process.memory_info().rss / (1024 * 1024))
            
        monitor_results['cpu'] = cpu_percentages
        monitor_results['ram'] = ram_mb
    except psutil.NoSuchProcess:
        pass

async def run_benchmark(mode="RUST"):
    print(f"\n{'='*50}")
    print(f"🚀 INICIANDO BENCHMARK E2E MODO: {mode}")
    print(f"{'='*50}")
    
    # Iniciar Target Server
    target_server = subprocess.Popen([sys.executable, 'tests/target_server.py'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Iniciar Proxy Server con la variable de entorno correspondiente
    env = os.environ.copy()
    env["USE_RUST"] = "1" if mode == "RUST" else "0"
    proxy_server = subprocess.Popen([sys.executable, 'src/proxy.py'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print(f"[*] Servidores iniciados. Esperando 2 segundos para estabilización...")
    await asyncio.sleep(2)
    
    print(f"[*] Iniciando bombardeo de red ({CONCURRENCY} clientes concurrentes durante {TEST_DURATION_SECONDS} segundos)...")
    
    results = {}
    monitor_results = {}
    
    # Iniciar workers y monitor en paralelo
    workers = [client_worker(i, results) for i in range(CONCURRENCY)]
    monitor_task = asyncio.create_task(resource_monitor(proxy_server.pid, monitor_results))
    
    await asyncio.gather(*workers, monitor_task)
    
    # Detener servidores
    proxy_server.terminate()
    target_server.terminate()
    proxy_server.wait()
    target_server.wait()
    
    # Calcular métricas
    all_latencies = []
    for lat_list in results.values():
        all_latencies.extend(lat_list)
        
    avg_latency = sum(all_latencies) / len(all_latencies) if all_latencies else 0
    max_latency = max(all_latencies) if all_latencies else 0
    total_reqs = len(all_latencies)
    
    cpu_list = monitor_results.get('cpu', [0])
    ram_list = monitor_results.get('ram', [0])
    avg_cpu = sum(cpu_list) / len(cpu_list) if cpu_list else 0
    avg_ram = sum(ram_list) / len(ram_list) if ram_list else 0
    
    return {
        "mode": mode,
        "total_requests": total_reqs,
        "requests_per_sec": total_reqs / TEST_DURATION_SECONDS,
        "avg_latency_ms": avg_latency,
        "max_latency_ms": max_latency,
        "avg_cpu_percent": avg_cpu,
        "avg_ram_mb": avg_ram
    }

async def main():
    print("Iniciando Pipeline de Validación de Impacto Comercial (A/B Test)...\n")
    
    res_python = await run_benchmark(mode="PYTHON")
    await asyncio.sleep(3) # Cooldown
    res_rust = await run_benchmark(mode="RUST")
    
    print("\n\n" + "="*70)
    print("📊 RESULTADOS DEL BENCHMARK DE IMPACTO (VALIDACIÓN B2B) 📊")
    print("="*70)
    print(f"{'Métrica':<25} | {'Legacy (Python Puro)':<20} | {'TZANiX Swarm (Rust)':<20}")
    print("-" * 70)
    print(f"{'Rendimiento (Req/s)':<25} | {res_python['requests_per_sec']:<20.2f} | {res_rust['requests_per_sec']:<20.2f}")
    print(f"{'Latencia Media (ms)':<25} | {res_python['avg_latency_ms']:<20.2f} | {res_rust['avg_latency_ms']:<20.2f}")
    print(f"{'Latencia Máxima (ms)':<25} | {res_python['max_latency_ms']:<20.2f} | {res_rust['max_latency_ms']:<20.2f}")
    print(f"{'Uso CPU Promedio (%)':<25} | {res_python['avg_cpu_percent']:<20.2f} | {res_rust['avg_cpu_percent']:<20.2f}")
    print(f"{'Uso RAM Promedio (MB)':<25} | {res_python['avg_ram_mb']:<20.2f} | {res_rust['avg_ram_mb']:<20.2f}")
    print("="*70)
    
    # Business Value Pitch
    cpu_reduction = ((res_python['avg_cpu_percent'] - res_rust['avg_cpu_percent']) / res_python['avg_cpu_percent']) * 100 if res_python['avg_cpu_percent'] > 0 else 0
    lat_reduction = ((res_python['avg_latency_ms'] - res_rust['avg_latency_ms']) / res_python['avg_latency_ms']) * 100 if res_python['avg_latency_ms'] > 0 else 0
    
    print("\n💡 EL IMPACTO DE NEGOCIO (TU PITCH PARA CTOs):")
    print(f"«Al migrar nuestro proxy a TZANiX Core, redujimos la latencia de red en un {lat_reduction:.1f}%,")
    print(f"y bajamos el consumo de CPU de la instancia en un {cpu_reduction:.1f}%, permitiendo ")
    print(f"procesar más tráfico con hardware más barato.»\n")

if __name__ == "__main__":
    asyncio.run(main())
