# forth / Gforth 0.7.3

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Gforth 0.7.3, modern ANS Forth implementation; not a historical hardware Forth system. Single file, text stdin/stdout, no interactive REPL. The runner evaluates the file and then bye, keeping interpreter errors as failures. Dynamic superinstructions are disabled, dictionary size 16 MiB and data/return stacks 1 MiB each. Private 256 MiB container, 3 second execution, non-root, no network, read-only root, disposable files. No package installation or graphics. Stack-based code must leave balanced stacks when required by the program; actual underflow/errors remain visible.
