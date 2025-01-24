# Use Deno as the base image
FROM denoland/deno:alpine

# Set working directory
WORKDIR /app

# Install Docker CLI
RUN apk add --no-cache docker-cli

# Copy application files
COPY . .

# Cache dependencies
RUN deno cache provisioner.ts

# Expose API port
EXPOSE 8080

# Start the service
CMD ["deno", "run", "--allow-net", "--allow-run", "--allow-read=/var/run/docker.sock", "--allow-write", "provisioner.ts"]
