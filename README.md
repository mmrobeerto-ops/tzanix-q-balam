# TZANiX Q-Balam (Edición Comunitaria)

![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Rust Engine](https://img.shields.io/badge/Rust_Core-v0.2.0-orange)
![Quantum Engine](https://img.shields.io/badge/Frontend-WASM_3D-purple)

**El Firewall Cuántico con la Visualización Holográfica más avanzada del mercado.**

TZANiX es una plataforma dual diseñada para mitigar la amenaza de **"Cosechar Ahora, Desencriptar Después"** (Harvest Now, Decrypt Later). Protege bases de datos inyectando entropía y bloqueando exfiltraciones masivas en milisegundos, al mismo tiempo que vuelve visible lo invisible a través de una matriz 3D en tiempo real.

## La Arquitectura Definitiva: Fusión Mastermind

TZANiX no es solo un proxy invisible en una terminal; es un ecosistema completo compuesto por dos piezas tecnológicas que se comunican a la velocidad de la luz:

### 1. TZANiX Q-Balam (El Escudo Activo / Backend)
Escrito en Python (con núcleo acelerado en Rust), Q-Balam es el proxy inverso que está en la trinchera.
*   **Inyección de Entropía ($Z$):** Intercepta el tráfico y añade ruido matemático para que cualquier dato robado sea ruido blanco estadísticamente indescifrable.
*   **Filtro Volumétrico ATR:** Mide el *Average True Range* del volumen de datos ($Y$). Si detecta una exfiltración masiva (ej. ataque DDoS Slowloris o volcado masivo de base de datos), activa un **Kill-Switch** que decapita el socket TCP del atacante instantáneamente.

### 2. TZANiX Quantum Engine (El Radar Holográfico / Frontend)
Escrito en **Rust + WebAssembly + Three.js** (Próximamente integrado en este repositorio), este es el cerebro visual.
*   Q-Balam transmite la telemetría del tráfico a través de **WebSockets** hacia el Quantum Engine.
*   El motor renderiza a 60 FPS en el navegador una topología cuántica en 3D. Un CEO, CTO o inversor puede *ver* cómo fluyen los datos y observar en tiempo real cómo un servidor se ilumina en rojo y destruye un ataque antes de que afecte la red.

---

## ⚡ Quick Start (Backend Actual)

### 1. Ejecutar el Escudo Q-Balam
```bash
python src/proxy.py
```
El proxy escuchará en `127.0.0.1:8080`, reenviará el tráfico a `127.0.0.1:9000` y transmitirá telemetría vía WebSockets.

### 2. Ejecutar la Suite de Validación
Abre múltiples pestañas de terminal y ejecuta las pruebas de estrés para ver el escudo en acción:

```bash
# Iniciar una base de datos objetivo en el puerto 9000
python tests/target_server.py

# Lanzar un ataque volumétrico masivo
python tests/stress_tester.py

# Simular interceptación (Auditoría de Entropía)
python tests/entropy_auditor.py

# Fuzzeo de capa 7 (Slowloris simulado)
python tests/fuzzer.py
```

---

## 🏆 Benchmark de Impacto E2E (Red TCP Real)

Sometimos a Q-Guard a una prueba de estrés I/O bajo tráfico masivo de conexiones TCP concurrentes, comparando la inspección en Python Puro vs. **TZANiX Swarm Engine (Rust)**:

| Métrica | Legacy (Python Puro) | TZANiX Swarm (Rust) | Impacto |
| :--- | :--- | :--- | :--- |
| **Latencia Media** | 50.56 ms | **5.87 ms** | 📉 **88.4% de reducción** |
| **Latencia Máxima (Spikes)** | 199.48 ms | **20.31 ms** | 🛡️ **89.8% de estabilización** |
| **Uso de Memoria RAM** | 31.89 MB | **31.77 MB** | ⚡ **Consumo estático** |

> **💡 Ventaja:** Al eliminar el *lag* de procesamiento en la capa de inspección, el Kill-Switch ATR detecta ráfagas volumétricas en milisegundos sin estrangular conexiones legítimas, enviando esta información al instante al motor 3D.

---

## 💎 TZANiX Enterprise Edition: El Producto Completo

Este repositorio contiene la base comunitaria de intercepción (Apache 2.0).
Sin embargo, el verdadero valor comercial para bancos, exchanges y corporaciones se encuentra en **TZANiX Enterprise**.

Mientras el Ingeniero de Redes utiliza la eficiencia de Q-Balam para asegurar los endpoints, los Directores de Seguridad (CISO) utilizan el **Quantum Engine 3D** desde pantallas de control para tener una consciencia situacional sin precedentes de las amenazas y bloqueos, convirtiendo datos aburridos en inteligencia de ciberseguridad premium.

* ✉️ **Contacto Directo / Enterprise:** mmrobeerto@gmail.com
* 📖 **Ingeniería detrás de Q-Balam:** [Deep-dive case study](https://dev.to/mmrobeertoops/how-we-built-an-ultra-low-latency-security-proxy-in-rust-python-2pan)
