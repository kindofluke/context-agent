# Dockerfile for Cloud Run deployment of context-agent in multi-tenant session mode
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    unzip \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install --no-cache-dir uv

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/deno && \
    chmod +x /usr/local/bin/deno

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock README.md ./
COPY src/ ./src/

# Sync dependencies and install the project using uv
RUN uv sync --frozen

# Copy template files (economic-advisor example)
COPY examples/economic-advisor /app/template/

# Create sessions directory
RUN mkdir -p /tmp/sessions

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH=/app/src

# Expose the port Cloud Run will use (default 8080)
EXPOSE 8080

# Run in session mode with template directory
# Use shell form to allow PORT variable substitution
CMD uv run ct-agent serve \
    --session-mode \
    --template-dir /app/template \
    --allowed-domains api.stlouisfed.org \
    --port ${PORT:-8080} \
    --host 0.0.0.0
