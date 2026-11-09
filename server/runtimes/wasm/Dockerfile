FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/wasmtime-v50.0.1-x86_64-linux.tar.xz /tmp/wasmtime.tar.xz
RUN echo "685466455dd42a14774a86c36c8f2e45cbb9bd6d92a850139315df60a75498a5  /tmp/wasmtime.tar.xz" | sha256sum -c - && mkdir /opt/wasmtime && tar -xJf /tmp/wasmtime.tar.xz -C /opt/wasmtime --strip-components=1 && rm /tmp/wasmtime.tar.xz
ENV LANG=C.UTF-8 TZ=UTC
