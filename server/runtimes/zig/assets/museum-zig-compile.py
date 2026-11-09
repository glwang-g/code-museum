#!/usr/bin/python3
"""Run the unmodified Zig compiler on one allowed CPU; inputs stay in /work."""
import os
allowed = os.sched_getaffinity(0)
os.sched_setaffinity(0, {min(allowed)})
zig = "/opt/zig/zig"
os.execv(zig, [zig, "build-exe", "-O", "Debug", "--cache-dir", "/work/zig-cache", "--global-cache-dir", "/work/zig-global-cache", "-femit-bin=/work/program", "/work/main.zig"])
