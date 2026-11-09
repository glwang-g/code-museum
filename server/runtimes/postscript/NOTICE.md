# postscript / 10.00.0

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Ghostscript 10.00.0, single main.ps, -q -dSAFER -dNODISPLAY -dBATCH -dNOPAUSE. 256 MiB / 3 seconds; PostScript stack/procedure/control flow and real text output only. Native stopped/error behavior retained. No rendered page, GUI/device output, file artifact download or printer; no online packages. SAFER restrictions remain enabled.
