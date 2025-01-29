# kumulus-provider

Kumulus Cloud provider setup  codebase

### Provider Setup

The provider setup (dev) via the script `provider-setup.sh` can be done via `curl`

```bash
curl -sL https://raw.githubusercontent.com/kollectyve-labs/kumulus-provider/main/provider-setup/provider-setup.sh | sudo bash
```
## Other Components

### Stats Collector Service 🩺

#### To build the image (in isolation)

```sh
docker buildx build -t provider-healthchecks .
```

#### To run locally and test

cd into `provider-healthchecks` folder

```sh
# To run
docker run --network=host \
  --mount type=bind,source="$(pwd)"/mnemonic.txt,target=/run/secrets/MNEMONIC_SECRET \
  --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
  --group-add $(getent group docker | cut -d: -f3) \
  provider-healthchecks
```

### Provisioner Service 📦
