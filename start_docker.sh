docker run \
  -v ~/.letta/.persist/pgdata:/var/lib/postgresql/data \
  -p 8283:8283 \
  -p 7428:7428 \
  --add-host=host.docker.internal:host-gateway \
  letta/letta:latest
