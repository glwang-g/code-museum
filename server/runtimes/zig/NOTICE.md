# Zig 0.14.1

The original official x86_64 Linux archive is retained unchanged. Its 49,086,504 bytes and SHA-256 match the saved official download index. All 13 licensing/copyright members are extracted unchanged and mapped in acquisition.json; the full SDK, standard library and vendor source notices also remain in the original archive.

Offline extraction uses only fixed local inputs and the existing pinned GCC base. The self-authored Python launcher restricts only compiler CPU affinity to one already-allowed CPU, matching the one-CPU quota and limiting compiler thread fan-out. It executes the unmodified full Zig compiler and LLVM/linker backend in Debug mode, with both caches under /work. No backend features or runtime checks are disabled.

Single main.zig, standard library, native executable. 1024 MiB / 30 seconds compilation / 3 seconds execution. No zig build package downloads, external dependencies or interactive REPL. This is Zig 0.14.1, not a claim of newer Zig API compatibility.
