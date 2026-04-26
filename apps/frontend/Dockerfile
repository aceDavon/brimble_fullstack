FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# The build output in /app/dist is copied into the Caddy image
# via a multi-stage build in caddy/Dockerfile
FROM scratch AS export
COPY --from=build /app/dist /dist
