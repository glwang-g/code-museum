# WebAssembly / Wasmtime 50.0.1

Complete official Linux/amd64 SDK archive retained (11,577,424 bytes), matching SHA-256 in the official GitHub release asset metadata. Original Apache-2.0 WITH LLVM-exception license retained. No signature verification claimed.

Source: https://github.com/bytecodealliance/wasmtime/releases/tag/v50.0.1

Single main.wat core module, _start entry with WASI Preview 1 stdin/stdout/stderr; no preopened directories, inherited environment, sockets or browser/JavaScript host imports. Component model and Wasm threads disabled; linear memory at most 256 MiB. 512 MiB / 3 seconds including WAT translation and JIT. Guest traps and proc_exit preserve actual status. This is a modern Wasmtime host, not a browser Wasm engine or a full WASI platform.

Offline build requires only these fixed inputs and the pinned base image.
