# Dart 3.9.4 / Linux x64

Complete original Dart SDK ZIP retained in ordered 32 MiB parts, each with SHA-256 and byte length. Downloaded via storage.flutter-io.cn and verified against the independently retrieved official Google Dart archive SHA-256. The official VERSION and checksum, acquisition URLs and SDK-shipped license/notice files are retained. No upstream signature claim.

Offline image build reassembles and checks the original archive, using the original pinned GCC base digest (a local OCI layout may be supplied). Site builds and tasks never download dependencies; SDK bytes are server-side inputs, not browser assets.

Single main.dart compiled to a Linux native executable with the bundled AOT compiler and standard libraries, analytics suppressed. No Flutter, browser UI or pub online dependency resolution. Planned 768 MiB / compile 15 seconds / run 3 seconds. Fixed input preparation is not runtime/webpage acceptance.
