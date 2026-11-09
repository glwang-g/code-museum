# Scala 2.13.16 / Java 17

Original official Scala 2.13.16 distribution retained unchanged. Its byte count matches the saved official release API, and its compiler JAR matches the separately fetched official Maven SHA-1. All saved bytes have fixed SHA-256 inventories; this is not a whole-archive official SHA-256 or PGP signature claim. acquisition.json records the precise extraction member names and hashes. All distribution and embedded JAR license/notice texts are retained.

The offline image copies only the six original distribution JARs into the exact existing pinned Temurin Java 17 base. No online dependency downloads occur during builds or tasks. Single Main.scala / object Main with main(args: Array[String]); Scala 2.13 syntax and standard libraries, not Scala 3 compatibility. 768 MiB, compiler heap 384 MiB / 30 seconds compile, runtime heap 256 MiB / 3 seconds run. No sbt/Maven/Coursier restore or interactive REPL.
