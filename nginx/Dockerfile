FROM nginx:1.27-alpine

ARG NGINX_CONF=nginx.prod.conf

RUN rm /etc/nginx/conf.d/default.conf
COPY ${NGINX_CONF} /etc/nginx/nginx.conf
