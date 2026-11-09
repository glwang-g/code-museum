# ada / GNAT 12.2.0 / Ada 2012

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

GNAT 12.2.0 / Ada 2012 mode, a named modern implementation, not a historical Ada system or a full standard-conformance certificate. Single file /work/main.adb with procedure Main as the entry point. gnatmake-12 -gnat2012 -gnatwa compiles and links a native executable with the fixed GNAT runtime. Private 512 MiB container; 10 second compilation, 3 second execution. Compiler failure prevents execution and diagnostics remain separate from program output. Standard text I/O and preinstalled runtime libraries; no Alire/online packages, GUI, hardware, network or persistent task files. Runtime checks and Ada exception handling remain enabled.

Both Debian GNAT packages link /usr/share/doc/<package> to gcc-12-base. The original common GCC 12 copyright, explicitly covering gnat-12 and libgnat-12 including the runtime exception, is retained as licenses/gcc-12.copyright; its fixed repository provenance and digest are in acquisition.json.
