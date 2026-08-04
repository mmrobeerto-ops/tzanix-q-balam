# TZANiX Q-Guard (Community Edition)

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Status](https://img.shields.io/badge/status-Alpha-orange.svg)

Q-Guard is an advanced post-quantum auditing and obfuscation middleware. It is designed to mitigate the **"Harvest Now, Decrypt Later"** threat by injecting mathematical entropy into data streams and detecting massive exfiltration attempts in real-time.

## The Problem
Adversaries are currently intercepting and storing encrypted data (Harvest Now) with the intention of decrypting it once quantum computers break current RSA/ECC standards (Decrypt Later). Upgrading an entire infrastructure to NIST post-quantum algorithms takes years. 

## The Solution: Q-Guard
Q-Guard acts as a lightweight **Sidecar Proxy**. You place it between your application and your database without changing a single line of your core business logic.

It operates on the **Tesseract Model ($X, Y, Z, T$)**:
*   **$X$ (Source Vector):** The IP and port of the client.
*   **$Y$ (Magnitude):** The volume of data requested.
*   **$Z$ (Entropy):** The mathematical noise injected to obfuscate the data.
*   **$T$ (Time):** The latency and timestamp.

By analyzing the Average True Range (ATR) of the $Y$ magnitude over time, Q-Guard detects volumetric anomalies (massive exfiltrations) and triggers a **Kill-Switch** to sever the connection instantly.

---

## 🚀 Quick Start

### 1. Run the Proxy
```bash
python src/proxy.py
```
The proxy will listen on `127.0.0.1:8080` and forward traffic to `127.0.0.1:9000`.

### 2. Run the Validation Suite
We include a battery of tests in the `/tests` folder to prove Q-Guard's resilience. Open multiple terminal tabs and run:

```bash
# Start a dummy target database on port 9000
python tests/target_server.py

# Launch a volumetric attack to test the ATR Kill-Switch
python tests/stress_tester.py

# Simulate an interception to audit the Shannon Entropy
python tests/entropy_auditor.py

# Fuzz the proxy to ensure Fail-Safe resilience
python tests/fuzzer.py

# Run the End-to-End A/B Validation Benchmark (Pure Python vs TZANiX Rust Core)
python tests/benchmark_e2e.py
```

### 🏆 Benchmark de Impacto B2B (TZANiX Swarm Engine)
Nuestra integración con el motor `tzanix-core` logra un desempeño industrial masivo en capa de red:
* **Latencia Media**: -88.4% de reducción (De 50.5 ms en Python puro a **5.8 ms** con Rust).
* **Consumo de CPU**: Eliminación completa del cuello de botella (0.0% CPU I/O bound vs picos en Python).
* **Escalabilidad**: Absorbe picos de ataques bloqueando a los intrusos sin estrangular conexiones legítimas gracias a su **Swarm Buffer** y *Flush Latch* dinámico.

### 3. Dashboard (UI)
A React-based visual dashboard is available in the `/dashboard` directory.
```bash
cd dashboard
npm install
npm run dev
```

---

## 💎 Open Core: Community vs Enterprise

This repository contains the **Community Edition** of Q-Guard, released under the Apache 2.0 license. It is fully functional and open for peer review and community contributions.

**TZANiX Q-Guard Enterprise Edition** is our commercial offering for Fintech, Quantitative Funds, and high-security sectors. It includes:
- Advanced Machine Learning anomaly detection (beyond basic SMA/ATR).
- Production-grade Kubernetes sidecar injection.
- Seamless integration with major SQL/NoSQL databases.
- Real-time SIEM integration.
- 24/7 Enterprise Support.

For enterprise inquiries, please visit our website.

## 🤝 Contributing
We welcome community contributions! Please read `CONTRIBUTING.md` before submitting a Pull Request.
