# octave / 7.3.0

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

GNU Octave 7.3.0 CLI, single main.m script and preinstalled core libraries. GUI/window system, startup files and history disabled; OpenBLAS/OMP threads initially 1. 512 MiB / 3 seconds, no online pkg installation, plotting or notebook UI. A GNU Octave environment, no MATLAB identity or full compatibility claim. Execution errors retain prior stdout.
