# syntax=docker/dockerfile:1.6
# 多阶段构建：1) 编译前端  2) 安装后端依赖  3) 运行时镜像
# 基础镜像如果拉不到，可改成内部镜像源，例如：
#   FROM dockerproxy.com/library/node:18-slim
#   或在 Docker daemon 配置 registry-mirrors

# ---------- Stage 1: 前端构建 ----------
FROM docker.m.daocloud.io/library/node:18-slim AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm install --no-audit --no-fund

COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src

# 生产环境前端 API 走相对路径，由 Express 统一服务
RUN echo "VITE_API_URL=/api" > .env.production \
 && npm run build

# ---------- Stage 2: 后端依赖 + Prisma client ----------
FROM docker.m.daocloud.io/library/node:18-slim AS backend-deps
WORKDIR /app/server

# 安装 openssl，让 Prisma 正确检测平台为 debian-openssl-3.0.x
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Prisma 二进制走国内镜像
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

COPY server/package*.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm install --omit=dev --no-audit --no-fund

COPY server/prisma ./prisma
RUN npx prisma generate

# ---------- Stage 3: 运行时镜像 ----------
FROM docker.m.daocloud.io/library/node:18-slim
WORKDIR /app

# Prisma 5 在 Debian slim 上需要 openssl
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-deps /app/server ./server
COPY server/src ./server/src

ENV NODE_ENV=production \
    PORT=3006

EXPOSE 3006
WORKDIR /app/server
CMD ["node", "src/index.js"]
