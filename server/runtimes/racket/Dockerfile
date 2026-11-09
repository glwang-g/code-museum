FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/racket-minimal-8.7-x86_64-linux-cs.tgz /opt/museum-racket.tgz
RUN mkdir /opt/racket && tar -xzf /opt/museum-racket.tgz -C /opt/racket --strip-components=1 && rm /opt/museum-racket.tgz
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
