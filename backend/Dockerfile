FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

# Exponer el puerto del Proxy/WebSockets
EXPOSE 8081

# Comando para ejecutar el motor de FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
