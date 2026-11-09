# clojure / Clojure 1.11.1 / Java 17

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

Clojure 1.11.1 on the existing pinned Eclipse Temurin Java 17 image. Single-file clojure.main programs and the fixed bundled Clojure/spec/JSR166y libraries only; no tools.deps, Leiningen, Maven/network dependency restore or GUI. Private 768 MiB container, JVM heap 256 MiB, one active processor, Serial GC, 3 second budget including JVM startup. UTF-8 text stdin/stdout, temporary task files, no persistent workspace or network. Only the Java archives are unpacked from verified Debian packages; Debian native packages are not installed into the Temurin base.
