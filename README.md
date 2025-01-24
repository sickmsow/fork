# kumulus-provider

Kumulus Cloud provider setup  codebase

### Provider Setup

The provider setup (dev) script `provider.sh` is deployed at

`https://p8mdr58z51.execute-api.eu-north-1.amazonaws.com/default/kollectyve-provider-setup`

So the setup can be done via `curl`

```bash
curl -sL https://p8mdr58z51.execute-api.eu-north-1.amazonaws.com/default/kollectyve-provider-setup | bash
```

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
