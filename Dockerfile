# Construcción (Usamos Nginx ligero)
FROM nginx:alpine

# Borrar configuración por defecto de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar los archivos compilados OFUSCADOS del dashboard
COPY ./dashboard/dist /usr/share/nginx/html

# Copiar nuestro script de protección de 33 días
COPY entrypoint.sh /entrypoint.sh

# Darle permisos de ejecución al script
RUN chmod +x /entrypoint.sh

# Exponer el puerto
EXPOSE 80

# Inyectar la fecha de construcción en segundos de Epoch
ARG BUILD_DATE
ENV BUILD_DATE=${BUILD_DATE}

# Iniciar nuestro script de protección en lugar de Nginx directamente
ENTRYPOINT ["/entrypoint.sh"]
