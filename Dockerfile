# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Full install (dev deps included) to compile TypeScript.
FROM base AS build
COPY package.json yarn.lock .yarnrc.yml ./
RUN HUSKY=0 yarn install --immutable
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN yarn build

# Production dependencies only. The root postinstall (git hooks) has no use here.
FROM base AS prod-deps
COPY package.json yarn.lock .yarnrc.yml ./
RUN npm pkg delete scripts.postinstall && yarn workspaces focus --production

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "node dist/shared/infrastructure/database/migrate.js && node dist/shared/infrastructure/database/seed.js && exec node dist/main.js"]
