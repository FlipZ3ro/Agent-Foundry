FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json tsconfig.build.json ./
COPY packages ./packages
COPY services ./services
COPY apps ./apps
RUN npm install --omit=optional --no-audit --no-fund

FROM deps AS build
RUN npm run build:core

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3210
ENV RUNS_DIR=/data/runs
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
RUN mkdir -p /data/runs
VOLUME ["/data/runs"]
EXPOSE 3210
CMD ["node", "dist/services/http/src/app.js"]
