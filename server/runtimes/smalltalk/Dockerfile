FROM gcc@sha256:5e927c284bf55a7dc796262e311a0703344f62f41f5621eb56843111b1d37e15
COPY assets/ /opt/museum-assets/
RUN dpkg -i /opt/museum-assets/libsigsegv2_2.14-1_amd64.deb && dpkg -i /opt/museum-assets/*.deb && mkdir /opt/gst-build && tar -xzf /opt/museum-assets/smalltalk-3.2.5.tar.gz -C /opt/gst-build --strip-components=1 && cd /opt/gst-build && patch -p1 < /opt/museum-assets/iconv-glibc.patch && patch -p1 < /opt/museum-assets/expat-callback.patch && patch -p1 < /opt/museum-assets/cli-status.patch && ./configure --prefix=/opt/smalltalk --disable-jit --disable-gtk --without-emacs --with-system-libffi --with-system-libltdl --with-system-libsigsegv CFLAGS="-O2 -fcommon" && make -j2 && make install && rm -rf /opt/gst-build /opt/museum-assets
ENV LANG=C.UTF-8 TZ=UTC
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
