FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema operativo para compilar Rust
RUN apt-get update && apt-get install -y curl build-essential

# Instalar Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Instalar Maturin
RUN pip install maturin

# Copiar el código fuente del proyecto
COPY . .

# Compilar la librería de Rust como un paquete de Python e instalarla
RUN cd rust_engine && maturin build --release
RUN pip install rust_engine/target/wheels/*.whl

# Instalar dependencias de Python (FastAPI, etc)
RUN pip install --no-cache-dir -r requirements.txt

# Exponer el puerto del Proxy/WebSockets
EXPOSE 8081

# Comando para ejecutar el motor de FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
