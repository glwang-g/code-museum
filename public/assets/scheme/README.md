# Scheme browser interpreter

BiwaScheme 0.8.3 (JavaScript, not WebAssembly), MIT.
Release: https://registry.npmjs.org/biwascheme/-/biwascheme-0.8.3.tgz
Commit: c52385d0ca3aa4dc58ec3b4a78c9651701a29530

The tarball SHA-512 was verified against npm metadata. `biwascheme-source.mjs` preserves the exact upstream ES module; `LICENSE` comes from that commit's MIT-LICENSE.txt. `biwascheme-core.mjs` retains the source prefix before `const current_input = new Port.CustomInput(function (callback) {`, then appends `export default BiwaScheme$1;`. This removes DOM/jQuery integration and automatic page-script execution without replacing Scheme evaluation. Build checks both SHA-256 values and this exact derivation. All inputs are local; no install, bundler or online download is needed to build or execute.

Only the core is fetched by the module Worker. Each run uses a new Worker and environment. The wrapper captures display/write output and the final expression value, prioritizes errors within 20,000 characters, removes JS interop/timer extensions, and allows 30 seconds to load then 2 seconds to execute. File/DOM/network facilities and third-party libraries are not provided.

Upstream documents support for most R7RS small features, including continuations and proper tail calls; syntax-rules, exceptions and the library system are incomplete, strings are immutable, and integers are not distinguished from JS floating-point numbers. This is not GNU Guile, Common Lisp, full Scheme standard conformance, or a guarantee against device memory exhaustion. This adapter does not add support to other Lisp-family nodes.
