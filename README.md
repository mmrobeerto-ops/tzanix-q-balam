# TZANiX Q-Guard (Edición Comunitaria)

![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Rust Engine](https://img.shields.io/badge/Rust_Core-v0.2.0-orange)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)

Q-Guard es un middleware avanzado de ofuscación y auditoría post-cuántica. Está diseñado para mitigar la amenaza de **"Cosechar Ahora, Desencriptar Después"** inyectando entropía matemática en los flujos de datos y detectando intentos de exfiltración masiva en tiempo real.

## El Problema
Los adversarios actualmente interceptan y almacenan datos encriptados (Cosechar Ahora) con la intención de desencriptarlos una vez que las computadoras cuánticas rompan los estándares RSA/ECC actuales (Desencriptar Después). Actualizar toda una infraestructura a algoritmos post-cuánticos NIST lleva años.

## La Solución: Q-Guard
Q-Guard actúa como un **Sidecar Proxy** ligero. Lo colocas entre tu aplicación y tu base de datos sin cambiar una sola línea de tu lógica de negocio central.

Funciona según el Modelo Topológico 4D ($[X, Y, Z, T]$):
* **$X$ (Vector de Origen)**: IP/Puerto del cliente.
* **$Y$ (Magnitud)**: Volumen de datos solicitados.
* **$Z$ (Entropía)**: Ruido matemático inyectado para ofuscar el patrón de exfiltración.
* **$T$ (Tiempo)**: Latencia y marca de tiempo.

Al analizar el Rango Verdadero Promedio (ATR) de la magnitud $Y$ a lo largo del tiempo, Q-Guard detecta anomalías volumétricas (exfiltraciones masivas) y activa un **Kill-Switch** para cortar la conexión instantáneamente.

---

## ⚡ Quick Start

### 1. Ejecutar el Proxy
```bash
python src/proxy.py
```
El proxy escuchará en `127.0.0.1:8080` y reenviará el tráfico a `127.0.0.1:9000`.

### 2. Ejecutar la Suite de Validación
Incluimos una batería de pruebas en la carpeta `/tests` para demostrar la resiliencia de Q-Guard. Abre múltiples pestañas de terminal y ejecuta:

```bash
# Iniciar una base de datos objetivo en el puerto 9000
python tests/target_server.py

# Lanzar un ataque volumétrico para probar el Kill-Switch ATR
python tests/stress_tester.py

# Simular una interceptación para auditar la Entropía de Shannon
python tests/entropy_auditor.py

# Fuzzeo al proxy para garantizar la resiliencia Fail-Safe
python tests/fuzzer.py

# Ejecutar el Benchmark A/B End-to-End (Python Puro vs TZANiX Rust Core)
python tests/benchmark_e2e.py
```

### 🏆 Benchmark de Impacto E2E (Red TCP Real)

Sometimos a Q-Guard a una prueba de estrés I/O bajo tráfico masivo de conexiones TCP concurrentes, comparando la inspección en Python Puro vs. **TZANiX Swarm Engine (Rust)**:

| Métrica | Legacy (Python Puro) | TZANiX Swarm (Rust) | Impacto |
| :--- | :--- | :--- | :--- |
| **Latencia Media** | 50.56 ms | **5.87 ms** | 📉 **88.4% de reducción** |
| **Latencia Máxima (Spikes)** | 199.48 ms | **20.31 ms** | 🛡️ **89.8% de estabilización** |
| **Uso de Memoria RAM** | 31.89 MB | **31.77 MB** | ⚡ **Consumo estático** |

> **💡 Ventaja en Ciberseguridad:** Al eliminar el *lag* de procesamiento en la capa de inspección, el Kill-Switch basado en ATR detecta y neutraliza ráfagas de exfiltración volumétrica en milisegundos sin estrangular conexiones legítimas.

### 🛡️ Pruebas de Resistencia Enterprise (Estabilidad B2B)
Además del rendimiento bruto, la arquitectura ha superado pruebas de infraestructura de grado militar:
* **Anti-Slowloris (Agotamiento de FD)**: Desconexión asíncrona estricta (`Idle Timeout: 5s`), destruyendo 50+ conexiones "zombie" concurrentes y protegiendo los sockets del sistema.
* **Red Sucia (Jitter & TCP Coalescing)**: El *Swarm Buffer* y la capa inercial de Rust absorben payloads fragmentados asimétricos con 50ms de latencia de inyección, reensamblando el tráfico sin un solo byte corrupto.
* **Foco de Incendio (Memory Leak Soak Test)**: Tras bombardeos sostenidos ininterrumpidos, la memoria asignada (RAM) por el puente Python-Rust (PyO3) se aplana matemáticamente en un límite de **42.2 MB** (Cero Fugas).

### 3. Dashboard (UI)
Un panel visual basado en React está disponible en el directorio `/dashboard`.
```bash
cd dashboard
npm install
npm run dev
```

---

## 💎 Núcleo abierto: Comunidad vs. Empresa

Este repositorio contiene la **Edición Comunitaria** de Q-Guard (Licencia Apache 2.0), totalmente funcional para desarrollo local y pequeñas arquitecturas.

Para despliegues de alto rendimiento, soporte dedicado o integración en clusters de Kubernetes:
* ✉️ **Contacto Directo / Enterprise:** mmrobeerto@gmail.com
* 📦 **Motor Acelerado:** Integrado vía `tzanix-core` (PyPI)

## 🤝 Contribuyendo
¡Damos la bienvenida a las contribuciones de la comunidad! Por favor, lee `CONTRIBUTING.md` antes de enviar un Pull Request.
