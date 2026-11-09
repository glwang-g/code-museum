#!/bin/sh
set -eu
/usr/bin/nasm -f elf64 -Wall -o /work/main.o /work/main.asm
exec /usr/bin/ld -m elf_x86_64 -z noexecstack -e _start -o /work/program /work/main.o
