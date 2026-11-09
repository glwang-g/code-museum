FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN cat /opt/museum-assets/powershell-7.5.4.deb.part* > /tmp/powershell.deb && echo "17036f67f65d81ed2b23d0d247edc2b2ac58abeb721f08927aed8a3dffe41d42  /tmp/powershell.deb" | sha256sum -c - && dpkg-deb -x /tmp/powershell.deb / && install -D -m 0644 /opt/museum-assets/museum-powershell-entry.ps1 /opt/museum/powershell-entry.ps1 && rm -rf /opt/museum-assets /tmp/powershell.deb
ENV LANG=C.UTF-8 TZ=UTC TERM=dumb POWERSHELL_TELEMETRY_OPTOUT=1 DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
