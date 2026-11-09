# PowerShell 7.5.4 / Linux x64

Complete official Microsoft Debian 12 package retained in three ordered parts. Full SHA-256 matches the official GitHub release asset digest independently retrieved over HTTPS; package control metadata and five shipped license/notice files retained. No APT/PGP signature verification claim. Offline image build reassembles/checks the original DEB, extracts unmodified package files on the pinned GCC base and installs a separate source-retained CLI entry adapter.

main.ps1 is invoked with NoLogo/NoProfile/NonInteractive. The entry adapter sets ErrorActionPreference=Stop by default, plain text and UTF-8 console encoding, and propagates a failed final invocation or explicit nonzero script exit. Explicit catches and ordinary stderr are not classified by text matching. User error handling may override the default preference. Diagnostics remain PowerShell-generated.

768 MiB / 3 seconds including startup. Preinstalled Linux core modules only; no online Gallery installation or Windows/Office host. Site builds/tasks never download the runtime/modules. Fixed preparation is not runtime/webpage acceptance.
