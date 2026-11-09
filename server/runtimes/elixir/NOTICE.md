# elixir / 1.14.0

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Elixir 1.14.0 on Erlang/OTP 25.2.3. Single main.exs and fixed installed libraries, one BEAM scheduler and one async thread. 512 MiB, 3 seconds includes startup and compilation. No Mix/Hex online dependency installation, no distributed node.
