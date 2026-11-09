# standard-ml / 5.7.1

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Standard ML via Poly/ML 5.7.1, single main.sml and installed Standard Basis library. 512 MiB, 3 seconds includes script compilation and runtime startup. No online MLton/SML/NJ package installation, no interactive REPL or complete Standard ML conformance claim.
