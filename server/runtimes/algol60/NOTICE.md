# GNU MARST 2.8 / ALGOL 60

Fixed upstream source: https://ftp.gnu.org/gnu/marst/marst-2.8.tar.gz
SHA-256: d77f4703b0b44b50be57908f9d556ee6c3bedd97d638c42949d6aec84f8070ba
GNU MARST is GPL-3.0-or-later; complete source is retained in assets and the original COPYING is in licenses.
Base image is the existing pinned official GCC 14.3.0 image. Preparation is offline after explicit acquisition; tasks never download dependencies.

This is a modern ALGOL 60 to C translation chain, not a historical machine. Generated C is compiled with C89 and no optimization. MARST can generate unsequenced global_dsa accesses for call-by-name expressions: warnings are retained in compiler diagnostics. Sample success is not a proof of general call-by-name correctness or full ALGOL 60 conformance. Do not suppress the warning or call this a corrected translator.
