# Stats Collection Component

Collecting Provider Stats

```sh
docker buildx build -t stats-collector .
```

#### To run locally and test

cd into `stats-collector` folder

```sh
# To run
docker run --network=host \
  --mount type=bind,source="$(pwd)"/mnemonic.txt,target=/run/secrets/MNEMONIC_SECRET \
  --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
  --group-add $(getent group docker | cut -d: -f3) \
  stats-collector
```
