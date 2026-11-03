FROM node@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
ARG SOURCE_DATE_EPOCH=1793548800
COPY assets/ /opt/museum-assets/
RUN apk add --repositories-file /dev/null --no-cache --no-network /opt/museum-assets/*.apk \
    && mkdir /opt/typescript \
    && tar -xzf /opt/museum-assets/typescript-5.9.3.tgz -C /opt/typescript --strip-components=1 \
    && rm -rf /opt/museum-assets
WORKDIR /work
USER 65534:65534
CMD ["/bin/false"]
