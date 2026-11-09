FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN dpkg -i /opt/museum-assets/*.deb && install -m 0444 /opt/museum-assets/version.tcl /opt/museum-version.tcl && rm -rf /opt/museum-assets
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
