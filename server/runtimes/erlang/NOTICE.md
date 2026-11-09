# erlang / 25.2.3

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Erlang/OTP 25.2.3, single main.erl exporting main/0. Compilation uses the bundled compiler and execution uses the BEAM VM, with one scheduler, one async thread and one dirty scheduler of each type. 512 MiB, 10 seconds compilation / 3 seconds execution. Standard bundled libraries only, no rebar3 or online dependency installation, no distributed node.
