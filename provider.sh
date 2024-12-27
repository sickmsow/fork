#!/bin/bash

# Check if the script is run as root
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ This script must be run as root or with sudo."
    exit 1
fi

# Check if Docker is already installed
if command -v docker &>/dev/null; then
    echo "✅ Docker is already installed."
    docker --version
    exit 0
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

# Verify installation
if command -v docker &>/dev/null; then
    echo "🎉 Docker has been successfully installed! Jaajef !!!"
    docker --version
else
    echo "❌ Docker installation failed."
    exit 1
fi
