FROM eclipse-temurin@sha256:43f4431cc895d37ceb115e2e1f160545ec45caee9c1cb4246fc6bb879d58aeda
COPY assets/ /opt/museum-assets/
WORKDIR /opt
RUN /opt/java/openjdk/bin/jar xf /opt/museum-assets/groovy-4.0.26.zip && mv groovy-4.0.26 groovy && rm -rf /opt/museum-assets
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
