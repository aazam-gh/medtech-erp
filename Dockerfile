FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS web-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_BASE_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run web:build

FROM node:22-alpine AS api-builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run api:build

FROM nginx:1.27-alpine AS web
COPY --from=web-builder /app/dist /usr/share/nginx/html
COPY deploy/web-nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=api-builder /app/dist ./dist
COPY package.json ./
COPY templates ./templates
EXPOSE 3001
CMD ["node", "dist/apps/api/apps/api/src/main.js"]
