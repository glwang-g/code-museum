# Lua WebAssembly runtime

Wasmoon 1.16.0 npm release: https://registry.npmjs.org/wasmoon/-/wasmoon-1.16.0.tgz

Package integrity verified against npm SHA-512 before extraction. `wasmoon.js` and `glue.wasm` are unchanged release bytes; SHA-256 values are in `manifest.json`, checked before build replaces dist. No npm installation or online download is required to build or run the site.

Release git commit: 87c783a8d0bf65afeda933fa47d8dc996be53bb3. Its Lua submodule points to be908a7d4d8130264ad67c5789169769f824c5d1; lua.h identifies Lua 5.4.5. `LICENSE` preserves both Wasmoon and this Lua source's MIT notices. Upstream source mapping does not constitute a local compiler rebuild of the vendor binary.

Runtime files total 423,233 bytes (about 413 KiB) uncompressed. They load only in the Lua Worker. Each program gets a fresh VM, print output is bounded to 20,000 characters, and the page terminates execution after 2 seconds (loading budget: 30 seconds). File/system/module access and JS object/proxy injection are disabled. This is a short-program playground, not a full OS environment or a guarantee against device memory exhaustion.
