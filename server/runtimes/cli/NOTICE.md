# CLI runtime source and license notices

This preparation context contains fixed official binary distributions, not locally
invented language interpreters. No assets in this directory are served to website
visitors. The site can be built without Docker or network access.

- TypeScript 5.9.3: Microsoft, Apache-2.0. Full license and third-party notices are
  in `licenses/`. The official npm archive includes the compiler source distribution
  in JavaScript and standard declaration libraries. Upstream TypeScript source:
  https://github.com/microsoft/TypeScript/tree/v5.9.3
- Bash 5.3.9, GNU awk 5.3.2 and GNU sed 4.9: GPL-3.0-or-later. Readline 8.3.3:
  GPL-3.0-or-later. Package metadata, exact Alpine source recipes and their source
  archive checksums are linked by `sourceRecipe` in `manifest.json`. GNU sources:
  https://ftp.gnu.org/gnu/bash/ , https://ftp.gnu.org/gnu/gawk/ ,
  https://ftp.gnu.org/gnu/sed/ , https://ftp.gnu.org/gnu/readline/
  License: https://www.gnu.org/licenses/gpl-3.0.html
- PHP 8.3.36: PHP-3.01, BSD-3-Clause, LGPL-2.0-or-later, MIT and Zend-2.0.
  https://www.php.net/license/ and https://www.php.net/
- Perl 5.42.2: Artistic-1.0-Perl OR GPL-1.0-or-later.
  https://dev.perl.org/licenses/ and https://www.perl.org/
- libxslt 1.1.43 and libxml2 2.13.9: X11 and MIT respectively.
  https://gitlab.gnome.org/GNOME/libxslt , https://gitlab.gnome.org/GNOME/libxml2
- SQLite 3.53.4: public domain / blessing. https://sqlite.org/copyright.html
- musl 1.2.6: MIT. https://musl.libc.org/copyright.html
- ncurses 6.6: X11. https://invisible-island.net/ncurses/ncurses-license.html
- The fixed official Node base image has its own Node, Alpine and third-party
  notices; installing these APKs does not replace those licenses. Node license:
  https://github.com/nodejs/node/blob/v22.23.2/LICENSE

The APK archives are copied unchanged from the official Alpine repository and
their signatures are checked by the base image's `apk`. `manifest.json` records
their SHA-256, package versions, license metadata, download URLs and exact aports
source recipe revisions. Source recipes identify corresponding upstream source
archives and patches. Keep these notices and corresponding source availability
when redistributing the prepared image or its packages.
