# smalltalk / GNU Smalltalk 3.2.5

Fixed Debian packages acquired from official signed repositories. InRelease signatures and package-index hashes were verified by Debian APT in a disposable network-disabled container. Every package matches the signed-index SHA-256; exact versions, URLs and hashes are in acquisition.json. Original package metadata and signature verification logs are in metadata/, and original copyright texts are in licenses/. Debian source package names and upstream links are in those records.

The offline build uses only saved packages and the fixed base image. Site builds and execution tasks never download dependencies. This is a modern named implementation, not a historical-machine reproduction.

GNU Smalltalk 3.2.5, modern GNU implementation, not the original Xerox Smalltalk environment. Single-file console programs, stdin/stdout only, no GUI or online package installation. Private 512 MiB / 3 second container. Bytecode VM, JIT disabled; system libffi, libltdl and libsigsegv from fixed packages/base image. Build dependencies are acquired separately; image builds and execution are offline. Runtime and browser compatibility remain subject to actual acceptance tests.

Project portability patch assets/iconv-glibc.patch changes only the iconv input-buffer pointer from const char* to char*, matching the glibc iconv(char**) interface for this fixed Linux build. The buffer points to mutable Smalltalk String storage. Original GNU source archive is unchanged; patch bytes are hashed separately. No compiler error suppression is used.

Project portability patch assets/expat-callback.patch adds the third integer parameter required by the installed Expat skipped-entity callback signature. Existing event payload behavior is retained; the added flag is unused by this old binding. This is a C interface compatibility patch, not a claim of full XML conformance.

Project CLI-status adapter assets/cli-status.patch records genuinely reported parser/compiler errors and returns status 1 at CLI shutdown, instead of upstream main.c always returning 0. Errors explicitly handled by a compiler error block do not set the status. The default action for an unhandled exception retains its native report/backtrace and exits with status 1. Explicitly handled errors and normal output remain under program control. This is a documented museum CLI adaptation; the original archive is unchanged, patches and complete corresponding source are retained.
