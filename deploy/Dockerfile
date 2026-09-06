# Runtime-only image: the bundle is built on the CI runner and arrives as dist/, so this
# image carries no Node toolchain and builds on the server in seconds.
# The build context is the repository root (see docker-compose.deploy.yml).
FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
