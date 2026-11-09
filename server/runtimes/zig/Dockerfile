FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN test -x /usr/bin/python3 && tar -xJf /opt/museum-assets/zig-x86_64-linux-0.14.1.tar.xz -C /opt && mv /opt/zig-x86_64-linux-0.14.1 /opt/zig && install -m 0755 /opt/museum-assets/museum-zig-compile.py /usr/local/bin/museum-zig-compile && rm -rf /opt/museum-assets
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
