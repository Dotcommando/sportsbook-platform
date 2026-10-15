FROM node:24.14.0-bookworm@sha256:5a593d74b632d1c6f816457477b6819760e13624455d587eef0fa418c8d0777b
WORKDIR /workspace
RUN npm install --global pnpm@12.11.2
COPY . .
ENV NX_DAEMON=false NX_ISOLATE_PLUGINS=false
RUN --mount=type=cache,id=sportsbook-pnpm12,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile && pnpm build
ARG SOURCE_TREE_SHA256
LABEL sportsbook.source-tree-sha256=$SOURCE_TREE_SHA256
USER node
