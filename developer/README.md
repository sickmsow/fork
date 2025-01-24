# Developer Virtual Machine

Virtual Machine (Ubuntu for now) that will be built for developers when
requesting VM.

## The commands belows are for isolated testing

#### To Build this image run :

```sh
# Build the container
docker build \
  --build-arg USERNAME=mydevuser \
  --build-arg SSH_KEY="ssh-rsa AAAAB3..." \
  -t ssh-container .

# Run the container with resource limits
docker run -d \
  --name ssh-dev \
  --memory="512m" \
  --cpus="1" \
  -p 2222:22 \
  ssh-container
```

#### To connect via ssh from localhost

```sh
ssh -p 2222 mydevuser@localhost
```

#### Stopping and removing the container

```sh
# Stopping the container
docker stop ssh-dev
# Removing the container
docker rm ssh-dev
```

Increasing the resources capacities.( We let it be flexible at this stage
without using cgroups but define it a runtime )

```sh
# Run with increased resources
docker run -d \
  --name ssh-dev \
  --memory="1g" \    # Increased to 1GB
  --cpus="2" \       # Increased to 2 CPUs
  -p 2222:22 \
  ssh-container

# Or with decreased resources
docker run -d \
  --name ssh-dev \
  --memory="256m" \  # Decreased to 256MB
  --cpus="0.5" \     # Decreased to half a CPU
  -p 2222:22 \
  ssh-container
```

#### For updating Network Resources

```sh
# Run container with network rate limiting
docker run -d \
  --name ssh-dev \
  --memory="512m" \
  --cpus="1" \
  --network-tbf rate=1mbit burst=2mbit latency=50ms \
  -p 2222:22 \
  ssh-container

# Or with higher bandwidth
docker run -d \
  --name ssh-dev \
  --memory="512m" \
  --cpus="1" \
  --network-tbf rate=10mbit burst=20mbit latency=50ms \
  -p 2222:22 \
  ssh-container
```

or set with

```sh
--network-tbf rate=1048576bps  # Bits per second
--network-tbf rate=128kbps     # Kilobits per second
--network-tbf rate=1mbps       # Megabits per second
```

Network traffic shaping requires your Docker host to have the appropriate kernel
modules loaded (tc and tbf). Most modern Linux distributions include these by
default.

```sh
docker update --network-tbf rate=5mbit burst=10mbit latency=50ms ssh-dev
```
