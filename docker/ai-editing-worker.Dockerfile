FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
RUN npm install -g bun

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# The repository root is bind-mounted over /app, so node_modules comes from the
# host (macOS) and carries only the darwin binaries of workerd and esbuild.
# Keep both Linux platform packages in the image and let their require.resolve
# find them through NODE_PATH; the entrypoint refreshes them if the mounted
# versions move.
ENV NODE_PATH=/opt/linux-platform/workerd/node_modules:/opt/linux-platform/esbuild/node_modules
# Сборка идёт и на Apple Silicon, и на обычных серверах x86_64: пакеты платформы
# выбираются по архитектуре машины, иначе npm отказывается ставить чужую сборку.
RUN case "$(uname -m)" in \
		x86_64) WORKERD_ARCH=64; ESBUILD_ARCH=x64 ;; \
		*) WORKERD_ARCH=arm64; ESBUILD_ARCH=arm64 ;; \
	esac \
	&& npm install --prefix /opt/linux-platform/workerd --no-save --no-package-lock \
		"@cloudflare/workerd-linux-${WORKERD_ARCH}@1.20260708.1" \
	&& npm install --prefix /opt/linux-platform/esbuild --no-save --no-package-lock \
		"@esbuild/linux-${ESBUILD_ARCH}@0.28.1"

WORKDIR /app/services/ai-editing-worker
EXPOSE 8933

COPY docker/ai-editing-worker-entrypoint.sh /usr/local/bin/ai-editing-worker-entrypoint
ENTRYPOINT ["/usr/local/bin/ai-editing-worker-entrypoint"]

CMD ["sh", "-c", "\
  bun scripts/generate-sandbox.ts && \
  printf 'OPENAI_API_KEY=%s\\nANTHROPIC_API_KEY=%s\\nCEREBRAS_API_KEY=%s\\n' \
    \"${OPENAI_API_KEY}\" \
    \"${ANTHROPIC_API_KEY}\" \
    \"${CEREBRAS_API_KEY}\" \
    > .dev.vars && \
  npx wrangler dev \
    --env local \
    --ip 0.0.0.0 \
    --var SYNC_WS_BASE:ws://sync-service:8787\
"]
