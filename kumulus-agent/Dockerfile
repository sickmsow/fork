# Use Deno Alpine as base image
FROM denoland/deno:alpine

# Install required system dependencies
RUN apk add --no-cache bash curl procps docker-cli

# Set working directory
WORKDIR /app

# Copy application files
COPY . .

# Cache dependencies
RUN deno cache main.ts

# Create a directory for secrets
RUN mkdir -p /run/secrets

# Set proper permissions
RUN chown -R deno:deno /app && \
    chmod -R 755 /app

# Switch to deno user
USER deno

# Mount secret and start application
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["export MNEMONIC=$(cat /run/secrets/MNEMONIC_SECRET) && deno run --allow-net --allow-env --allow-run --allow-read --allow-write --unstable-cron main.ts"]