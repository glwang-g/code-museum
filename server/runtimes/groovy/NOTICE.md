# groovy / 4.0.26

Original official release ZIP, verified against its separately downloaded official SHA-256. This is checksum verification, not a signature verification claim. Original archive and all bundled license/notice documents are retained.

Release: https://archive.apache.org/dist/groovy/4.0.26/distribution/

Offline preparation reuses the exact existing Temurin Java 17 base digest and its jar extraction tool. Website builds and execution tasks never download dependencies.

Single main.groovy, fixed bundled core JAR only. 768 MiB, JVM heap 256 MiB, 3 seconds includes startup. No Grape/Ivy/Maven restore, plugins, GUI or interactive REPL.
