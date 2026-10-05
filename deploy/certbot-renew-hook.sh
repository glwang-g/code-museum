#!/bin/sh
set -eu
case " ${RENEWED_DOMAINS:-} " in
    *" codemuseum.freexlib.com "*)
        /usr/sbin/nginx -t
        /usr/bin/systemctl reload nginx
        ;;
esac
