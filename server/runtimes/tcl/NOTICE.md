# tcl / 8.6.13

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Tcl 8.6.13, single main.tcl and fixed bundled Tcl standard library, no Tk GUI or online package installation. 256 MiB, 3 seconds includes interpreter startup, text input/output. Tcl 8.6 behavior, not a Tcl 9 compatibility claim.

The saved version.tcl prints the actual interpreter info patchlevel; it is not a hardcoded version output.
