FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN cat /opt/museum-assets/dart-3.9.4.zip.part* > /tmp/dart.zip && echo "61b4b9488e1b4255b94be17ad48ae2ddb23c6fbe67824cf8103d0b28fa8ab816  /tmp/dart.zip" | sha256sum -c - && unzip -q /tmp/dart.zip -d /opt && rm -rf /opt/museum-assets /tmp/dart.zip
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
