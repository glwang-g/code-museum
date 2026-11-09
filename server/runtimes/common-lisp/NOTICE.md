# Common Lisp / SBCL 2.2.9

Fixed Debian bookworm package sbcl 2:2.2.9-1 (binary filename 2.2.9-1).
Source: https://deb.debian.org/debian/pool/main/s/sbcl/sbcl_2.2.9-1_amd64.deb
SHA-256 verified against https://packages.debian.org/bookworm/amd64/sbcl/download : 60a5f82ccad1cdb08bc93a104132b99397bb6672b5a0ce0d50b01d47bd0b4765

Original Debian copyright and all upstream notices are retained in licenses/sbcl.copyright. SBCL includes public-domain, BSD-style and other components; consult the original notice for exact scope. Debian source: https://deb.debian.org/debian/pool/main/s/sbcl/ .

Uses the existing fixed Debian 12 / GCC base image. No package restore during build or execution. Single file with the bundled Common Lisp environment; no Quicklisp, third-party libraries, GUI or historical LISP emulation. SBCL runs without startup files or interactive debugger, with 128 MiB dynamic space and 8 MiB control stack inside a bounded private container.
