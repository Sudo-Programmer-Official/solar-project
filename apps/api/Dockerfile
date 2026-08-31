FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts

RUN npm ci
RUN npm run build:api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/apps/api/src/server.js"]
