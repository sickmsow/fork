#!/bin/bash
set -e
trap 'echo "❌ An error occurred. Exiting..."; exit 1;' ERR

exec > >(tee -i /var/log/docker_install.log) 2>&1

# Check if the script is run as root or with sudo privileges
if [ "$(id -u)" -eq 0 ]; then
    echo "⚠️ Warning: This script is running as root. Proceeding..."
else
    echo "🔒 Running as a non-root user. Sudo privileges are required for installation."
    if ! sudo -v; then
        echo "❌ You must have sudo privileges to run this script."
        exit 1
    fi
fi

# Check if Docker is already installed
if command -v docker &>/dev/null; then
    echo "✅ Docker is already installed."
    docker --version
    exit 0
fi

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
