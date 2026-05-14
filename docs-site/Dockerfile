# Dockerfile for docs-site frontend (Fresh + Deno)
FROM denoland/deno:2.6.6

WORKDIR /app

# Copy dependency manifests first for better caching
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno install --entrypoint main.ts || true

# Copy all source files (includes examples symlink)
COPY . .

# Build the Fresh app (creates _fresh/ directory)
RUN deno task build

# Copy examples into the _fresh/server directory where the built code expects them
# The playground route resolves ../examples/ relative to _fresh/server/assets/
RUN cp -r examples _fresh/server/examples

# Set environment variables
ENV PORT=8000
ENV DENO_DEPLOYMENT_ID=cloud-run

# Expose the port
EXPOSE 8000

# Start the server
# Note: -A grants all permissions (required for Fresh + sandbox operations)
CMD ["deno", "serve", "-A", "--port", "8080", "--host", "0.0.0.0", "_fresh/server.js"]
