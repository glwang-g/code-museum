FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN mkdir -p /opt/julia && cat /opt/museum-assets/julia-1.11.7.tar.gz.part* > /tmp/julia.tar.gz && echo "aa5924114ecb89fd341e59aa898cd1882b3cb622ca4972582c1518eff5f68c05  /tmp/julia.tar.gz" | sha256sum -c - && tar -xzf /tmp/julia.tar.gz -C /opt/julia --strip-components=1 && rm -rf /opt/museum-assets /tmp/julia.tar.gz
ENV LANG=C.UTF-8 TZ=UTC JULIA_LOAD_PATH=@stdlib JULIA_DEPOT_PATH=/work/julia-depot:/opt/julia/local/share/julia:/opt/julia/share/julia JULIA_PKG_OFFLINE=true JULIA_NUM_THREADS=1 JULIA_NUM_GC_THREADS=1 OPENBLAS_NUM_THREADS=1
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
