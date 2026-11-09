# oberon / 0.17.2

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

OBNC 0.17.2 implements the final Oberon language revision from 2016 (Oberon-07 family), not historical Ceres Oberon or Oberon-2. Main.obn / MODULE Main, C backend with GCC, Boehm GC and default runtime checks, INTEGER C int (32-bit), REAL double (64-bit). 512 MiB / compile 10 seconds / run 3 seconds. Fixed text/basic libraries, no SDL Input/XYplane graphics, external modules or online package installation.

Complete official OBNC 0.17.2 source archive retained (233,220 bytes), MD5 matched the independently downloaded official MD5SUMS list. SHA-256 f672663e295df6daba53ac59a0280011732b0e7f95078d7944aa8c328b5f47ec pins the retained bytes; no upstream SHA-256 or PGP signature claim. Compiler GPL-3.0-or-later and libraries MPL-2.0 retained. Optional SDL-dependent Input and XYplane are omitted; textual In/Out, Files, Math, Strings and ext libraries are installed.
