# Fixed Pascal and R runtime inputs

Prepared 2026-11-03 for linux/amd64 on the pinned official GCC / Debian 12 image. These are explicitly prepared runtime inputs, never downloaded by a site build or user job. Debian binary packages and required dependencies are installed offline with dpkg. Upstream copyright and license texts are copied unchanged below licenses/. libgfortran5 links its copyright to gcc-12-base in the pinned base image; that original copyright is included here.

Free Pascal 3.2.2: ObjFPC mode (-Mobjfpc), AnsiString (-Sh), RTL only; this does not claim ISO Pascal or historical Turbo Pascal compatibility.

R 4.2.2: Rscript --vanilla, preinstalled base packages, text output only. No CRAN restore or package downloads, graphics/files are not exported. Read redirected input with file("stdin") or scan("stdin", ...).

| Package | Version | Source and licensing |
| --- | --- | --- |
| fp-compiler-3.2.2 | 3.2.2+dfsg-20 | [Debian source](https://sources.debian.org/src/fpc/3.2.2+dfsg-20/) / [copyright](licenses/fp-compiler-3.2.2.copyright) |
| fp-units-rtl-3.2.2 | 3.2.2+dfsg-20 | [Debian source](https://sources.debian.org/src/fpc/3.2.2+dfsg-20/) / [copyright](licenses/fp-units-rtl-3.2.2.copyright) |
| r-base-core | 4.2.2.20221110-2 | [Debian source](https://sources.debian.org/src/r-base/4.2.2.20221110-2/) / [copyright](licenses/r-base-core.copyright) |
| zip | 3.0-13 | [Debian source](https://sources.debian.org/src/zip/3.0-13/) / [copyright](licenses/zip.copyright) |
| libpaper-utils | 1.1.29 | [Debian source](https://sources.debian.org/src/libpaper/1.1.29/) / [copyright](licenses/libpaper-utils.copyright) |
| libpaper1 | 1.1.29 | [Debian source](https://sources.debian.org/src/libpaper/1.1.29/) / [copyright](licenses/libpaper1.copyright) |
| xdg-utils | 1.1.3-4.1 | [Debian source](https://sources.debian.org/src/xdg-utils/1.1.3-4.1/) / [copyright](licenses/xdg-utils.copyright) |
| libblas3 | 3.11.0-2 | [Debian source](https://sources.debian.org/src/lapack/3.11.0-2/) / [copyright](licenses/libblas3.copyright) |
| liblapack3 | 3.11.0-2 | [Debian source](https://sources.debian.org/src/lapack/3.11.0-2/) / [copyright](licenses/liblapack3.copyright) |
| libgfortran5 | 12.2.0-14+deb12u1 | [Debian source](https://sources.debian.org/src/gcc-12/12.2.0-14+deb12u1/) / [copyright](licenses/libgfortran5.copyright) |
| libtcl8.6 | 8.6.13+dfsg-2 | [Debian source](https://sources.debian.org/src/tcl8.6/8.6.13+dfsg-2/) / [copyright](licenses/libtcl8.6.copyright) |
| libtk8.6 | 8.6.13-2 | [Debian source](https://sources.debian.org/src/tk8.6/8.6.13-2/) / [copyright](licenses/libtk8.6.copyright) |
| libxft2 | 2.3.6-1 | [Debian source](https://sources.debian.org/src/xft/2.3.6-1/) / [copyright](licenses/libxft2.copyright) |
| libxss1 | 1:1.2.3-1 | [Debian source](https://sources.debian.org/src/libxss/1%3A1.2.3-1/) / [copyright](licenses/libxss1.copyright) |
