# Stage 1: build the wheel with the Deno binary bundled
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /build
COPY pyproject.toml README.md ./
COPY src/ ./src/

ENV DENO_VERSION=2.6.6
RUN mkdir -p src/context_agent/bin \
    && curl -fsSL \
       "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" \
       -o /tmp/deno.zip \
    && unzip -o /tmp/deno.zip deno -d src/context_agent/bin/ \
    && chmod +x src/context_agent/bin/deno \
    && rm /tmp/deno.zip

RUN uv build --out-dir /dist

# Stage 2: minimal runtime image
FROM python:3.12-slim

RUN useradd -r -u 1000 -m appuser

COPY --from=builder /dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl

COPY workflow-testing/exec-dir/ /app/exec-dir/
RUN chown -R appuser:appuser /app

USER appuser
WORKDIR /app

EXPOSE 8080

CMD ["ct-agent", "serve", "--exec-dir", "/app/exec-dir", "--port", "8080"]
