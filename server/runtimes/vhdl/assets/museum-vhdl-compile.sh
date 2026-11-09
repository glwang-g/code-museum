#!/bin/sh
set -eu
/usr/bin/ghdl-mcode -a --std=08 --workdir=/work /work/main.vhd
exec /usr/bin/ghdl-mcode -e --std=08 --workdir=/work main
