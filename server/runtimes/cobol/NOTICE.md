# cobol / GnuCOBOL 3.1.2

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

GnuCOBOL 3.1.2, named modern compiler; not an IBM mainframe or historical COBOL environment. Single-file free-format source with -std=cobol2014, compiled to a native executable with the existing fixed C toolchain. Private 512 MiB container, 10 second compilation and 3 second execution. Compilation errors prevent execution; compiler diagnostics and program output stay separate. Text stdin/stdout, temporary task files; no external databases, terminals, network, online COPYBOOK/package installation or persistent files. This is not a claim of full COBOL standard conformance.
