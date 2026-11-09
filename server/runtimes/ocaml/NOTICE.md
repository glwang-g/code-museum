# ocaml / 4.13.1

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

OCaml 4.13.1 single-file bytecode compiler (ocamlc), main.ml. 512 MiB container memory, 10 seconds compilation and 3 seconds execution. Standard library only; no opam, dune or online installation. The runtime is a modern compiler, not a historical-machine reproduction.
