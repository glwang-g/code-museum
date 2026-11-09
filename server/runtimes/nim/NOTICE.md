# nim / 1.6.10

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Nim 1.6.10, single main.nim compiled via the fixed installed GNU C compiler and Nim standard library. 768 MiB, compilation 20 seconds / execution 3 seconds; compilation cache stays inside /work. No Nimble or online packages, no Nim 2 compatibility claim.
