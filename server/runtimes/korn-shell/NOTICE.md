# korn-shell / 93u+m/1.0.4

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Korn shell through ksh93u+m 1.0.4, single main.ksh, noninteractive privileged mode (-p) ignores ENV/startup configuration. 256 MiB / 3 seconds, core commands available inside the fixed container; no online package installation. Native shell exit semantics preserved; a later successful command can handle an earlier nonzero status. Modern named implementation, not ksh88 or a historical machine reproduction.
