FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN mkdir -p /opt/swift && cat /opt/museum-assets/swift-6.1.3.tar.gz.part* > /tmp/swift.tar.gz && echo "4db73efef24931f66045970d9da0d3d3b25980903c957941774932bdd1af1166  /tmp/swift.tar.gz" | sha256sum -c - && tar -xzf /tmp/swift.tar.gz -C /opt/swift --strip-components=1 && rm -rf /opt/museum-assets /tmp/swift.tar.gz
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
