FROM denoland/deno:alpine-2.1.2

EXPOSE 8000

WORKDIR /app

USER deno

COPY . .

RUN deno cache main.ts

RUN timeout 10s deno -A main.ts || [ $? -eq 124 ] || exit 1

CMD ["run", "--allow-net", "sign.ts"]