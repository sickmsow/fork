#!/bin/bash

# 🩺 Provider Node Health Check Script

# Collecting some system stats
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')
MEMORY_FREE=$(free -m | awk '/Mem:/ { print $7 }')
DISK_FREE=$(df -h / | awk 'NR==2 { print $4 }')
DOCKER_STATUS=$(systemctl is-active docker)
RUNNING_CONTAINERS=$(docker ps -q | wc -l)
UNHEALTHY_CONTAINERS=$(docker ps --filter "health=unhealthy" -q | wc -l)

# Generating the message to sign
MESSAGE="CPU Usage: $CPU_USAGE, Memory Free: $MEMORY_FREE, Disk Free: $DISK_FREE, Docker Status: $DOCKER_STATUS, Running Containers: $RUNNING_CONTAINERS, Unhealthy Containers: $UNHEALTHY_CONTAINERS"

# Signing the message
SIGNED_MESSAGE="SIGNED_MESSAGE_PLACEHOLDER"
PROVIDER_PUBLIC_KEY="PROVIDER_PUBLIC_KEY_PLACEHOLDER"

# Sending health check 
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "cpu_usage": "'"$CPU_USAGE"'",
    "memory_free": "'"$MEMORY_FREE"'",
    "disk_free": "'"$DISK_FREE"'",
    "docker_status": "'"$DOCKER_STATUS"'",
    "running_containers": "'"$RUNNING_CONTAINERS"'",
    "unhealthy_containers": "'"$UNHEALTHY_CONTAINERS"'",
    "provider_public_key": "'"$PROVIDER_PUBLIC_KEY"'",
    "signed_message": "'"$SIGNED_MESSAGE"'"
  }' https://providers-healthcheck.kumulus.kollectyve.network

