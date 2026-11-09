# Julia 1.11.7 / Linux x86_64

Complete original Julia archive retained in nine ordered 32 MiB parts. A mirror download is checked against the independently retrieved official Julia release SHA-256 list. Original SDK-shipped license and notice files are retained. No PGP verification claim.

Offline build uses only fixed parts and the original pinned GCC base digest (a local OCI layout may be supplied). Site builds and execution tasks never download dependencies, and SDK bytes are not browser assets.

Single main.jl and shipped standard libraries. Startup and history files disabled; one Julia, GC and OpenBLAS thread at startup. Load path restricted to shipped standard libraries, temporary depot plus immutable SDK depots, offline Pkg setting. Existing compiled modules/pkgimages may be used, new precompile cache generation disabled. Normal Julia JIT remains enabled. Planned 768 MiB / 3 seconds including startup and JIT; no online Pkg install, plotting or notebook UI. Preparation is not runtime/webpage acceptance.
