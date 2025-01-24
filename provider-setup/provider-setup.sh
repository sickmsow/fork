#!/bin/bash
set -e
trap 'echo "❌ An error occurred. Exiting..."; exit 1;' ERR

exec > >(tee -i /var/log/docker_install.log) 2>&1

# Ensure script runs with sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "🔒 Rerunning script with sudo privileges..."
    exec sudo bash "$0" "$@"
fi

# Ensure safe Git directory and correct ownership
INSTALL_DIR="/opt/kumulus-provider"
if [ -d "$INSTALL_DIR" ]; then
    git config --global --add safe.directory "$INSTALL_DIR"
    chown -R $(logname):$(logname) "$INSTALL_DIR"
fi

REPO_URL="https://github.com/kollectyve-labs/kumulus-provider.git"

echo "🚀 Starting Provider Setup..."

# Check if Docker is already installed
if command -v docker &>/dev/null; then
    echo "✅ Docker is already installed."
    docker --version
else
    echo "🔄 Docker is not installed. Installing Docker..."

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" ]]; then
            echo "❌ Unsupported OS: $ID"
            exit 1
        fi
    else
        echo "❌ Unable to detect OS. Exiting..."
        exit 1
    fi

    # Uninstall conflicting packages
    echo "🔄 Uninstalling conflicting packages..."
    sudo apt-get remove -y docker docker-engine docker.io containerd runc || echo "ℹ️ No conflicting packages found."

    # Set up Docker's apt repository
    echo "📦 Setting up Docker's apt repository..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg apt-transport-https
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo "🌍 Adding Docker's repository to sources list..."
    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update

    # Install Docker Engine, CLI, containerd, and Docker Compose
    echo "🚀 Installing Docker Engine, CLI, containerd, and Docker Compose..."
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start Docker service
    echo "⚙️ Starting Docker service..."
    sudo systemctl enable docker
    sudo systemctl start docker

    # Add the current user to the Docker group
    echo "🔒 Adding the current user to the Docker group..."
    sudo usermod -aG docker $USER
    echo "⚠️ You need to log out and log back in to use Docker without sudo."

    # Verify installation
    if command -v docker &>/dev/null; then
        echo "🎉 Docker has been successfully installed!"
        docker --version
    else
        echo "❌ Docker installation failed."
        exit 1
    fi
fi

# Clone the main repository
if [ -d "$INSTALL_DIR" ]; then
    echo "🔄 Repository already exists. Pulling the latest changes..."
    cd "$INSTALL_DIR"
    git stash
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Ensure Docker group ID is set
DOCKER_GID=$(getent group docker | cut -d: -f3)
if [ -z "$DOCKER_GID" ]; then
    echo "❌ Docker group not found. Creating it..."
    sudo groupadd docker
    DOCKER_GID=$(getent group docker | cut -d: -f3)
fi
echo "✅ Docker Group ID: $DOCKER_GID"
export DOCKER_GID

# Create .txt file for provider mnemonic
if [ ! -f "${INSTALL_DIR}/mnemonic.txt" ]; then
    echo "🔑 Configuring mnemonic..."
    read -p "Enter your MNEMONIC SECRET: " MNEMONIC_SECRET
    echo "${MNEMONIC_SECRET}" > "${INSTALL_DIR}/mnemonic.txt"
fi

# Build the stats-collector using buildx
echo "🔨 Building kumulus-agent with buildx..."
cd "$INSTALL_DIR/kumulus-agent"
docker buildx build -t kumulus-agent .

# Go back to the main directory
cd "$INSTALL_DIR"

# Set up and run Docker services
echo "🚀 Starting provider services..."
docker compose up -d --build

# Ensure services restart automatically after reboot
echo "🔄 Enabling auto-start for Docker services..."
(crontab -l 2>/dev/null || true; echo "@reboot cd $INSTALL_DIR && docker compose up -d") | crontab -

echo "🎉 Setup complete! The provider is now running."
