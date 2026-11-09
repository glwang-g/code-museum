# d / GNU D 12.2.0

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

D through GNU D 12.2.0 (GCC gdc-12), single main.d and fixed D runtime/Phobos standard library. 768 MiB, compilation 10 seconds / execution 3 seconds, no dub or online dependency installation. This named GNU implementation is not a claim of DMD version equivalence or complete conformance.
