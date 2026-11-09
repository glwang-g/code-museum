FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/marst-2.8.tar.gz /opt/marst-source.tar.gz
RUN mkdir /opt/marst-build && tar -xzf /opt/marst-source.tar.gz -C /opt/marst-build --strip-components=1 && cd /opt/marst-build && ./configure --prefix=/opt/marst --disable-shared CFLAGS="-O0 -std=gnu89" && make -j2 && make install && rm -rf /opt/marst-build /opt/marst-source.tar.gz
COPY compile /usr/local/bin/museum-algol60-compile
RUN chmod 755 /usr/local/bin/museum-algol60-compile
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
