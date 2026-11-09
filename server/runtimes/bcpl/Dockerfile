FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /tmp/bcpl-assets/
RUN cat /tmp/bcpl-assets/bcpl-20261109.tar.gz.part* > /tmp/bcpl.tgz && echo "3bb90e3faadd651a3089bcca9a7708085c0703028f9caa14744e1fc2cf030b20  /tmp/bcpl.tgz" | sha256sum -c - && mkdir /opt/bcpl && tar -xzf /tmp/bcpl.tgz -C /opt/bcpl --strip-components=1 && cd /opt/bcpl/cintcode && patch -p0 < /tmp/bcpl-assets/cintcode-noninteractive.patch && make clean64 && make -j2 -o cin64/syscin/sysblib -o cin64/syscin/sysboot -o cin64/syscin/sysdlib -o cin64/syscin/syscli bin/cintsys64 CC="gcc -std=gnu11 -O2 -DforLinux -DCALLC -DEXTavail" SDLlibs= GLlibs= ASOUND= SDLcflags= GLcflags= && BCPLROOT=/opt/bcpl/cintcode BCPLPATH=/opt/bcpl/cintcode/cin64 BCPLHDRS=/opt/bcpl/cintcode/g /opt/bcpl/cintcode/bin/cintsys64 -q -c bcpl /tmp/bcpl-assets/museum-bcpl-runner.b to /opt/bcpl/museum-runner t64 && test -s /opt/bcpl/museum-runner && chmod -R a+rX /opt/bcpl/cintcode && rm -rf /tmp/bcpl-assets /tmp/bcpl.tgz
ENV LANG=C.UTF-8 TZ=UTC BCPLROOT=/opt/bcpl/cintcode BCPLPATH=/opt/bcpl/cintcode/cin64 BCPLHDRS=/opt/bcpl/cintcode/g
WORKDIR /work
USER 65534:65534
