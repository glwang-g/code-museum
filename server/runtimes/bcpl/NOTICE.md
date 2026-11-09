# BCPL Cintcode64 source snapshot acquired 2026-11-09

Original complete author archive retained in three parts, 95200146 bytes, SHA-256 3bb90e3faadd651a3089bcca9a7708085c0703028f9caa14744e1fc2cf030b20. Acquired over HTTPS from https://www.cl.cam.ac.uk/~mr10/BCPL/bcpl.tgz ; this is a local integrity pin, not a published upstream digest or signature claim. Archive includes C VM sources, BCPL sources and original bootstrap Cintcode.

Author distribution terms in original README: free of charge for individual private use and academic institutions. Original README and bundled GNU licence retained; no claim that the entire distribution is permissively licensed or cleared for arbitrary commercial redistribution. Current work is private preparation only, with no publication/deployment.

Modern 64-bit Cintcode interpreter, GCC gnu11/O2 on pinned Linux/amd64 base, no optional graphics/audio libraries. Compiler and program run in isolated container with fixed standard headers, no online dependencies, historical machine emulation or full conformance claim.

Build uses the original fixed cin64/syscin bootstrap files; make -o prevents timestamp-triggered bootstrap regeneration before the first native VM exists. The C VM objects are rebuilt from the retained sources after make clean64.

Original archive directories are mode 0700. Image build normalizes toolchain read/search permissions with chmod -R a+rX; submitted tasks remain uid/gid 65534 with read-only root filesystem.

Fixed CLI adaptations (source and patch retained): the runner consumes its own empty argument line before passing raw stdin to the submitted start() function, then sets cli_returncode and exits the VM immediately so leftover input cannot become CLI commands. It uses the original wrch with the binary-character marker and flushes line endings to output LF instead of the original terminal LF+CR. The C VM's positive Sys_interpret stop codes become nonzero process exits (codes 1..125 retained, larger mapped to 1), with numeric code/PC diagnostics, avoiding interactive fault debugging and false success. Normal start() return codes and ordinary stderr remain native; no diagnostic-text matching. Compiler diagnostics remain original.
