# x86-assembly / 2.16.01

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

NASM 2.16.01 and the pinned GCC base GNU ld, x86-64 Linux ELF64 with _start and Linux syscall ABI. Single main.asm, no libc or external object dependencies, 256 MiB / compile 10 seconds / run 3 seconds. Native CPU execution, not 8086, DOS, Windows or an emulator. Compilation and linking must both succeed before execution.
