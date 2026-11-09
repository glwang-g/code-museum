GET "libhdr"
STATIC { originalwrch = 0 }
LET textwrch(ch) = VALOF
{ LET ok = originalwrch(ch | 256)
  IF ch='*n' | ch='*p' DO deplete(output())
  RESULTIS ok
}
LET start() = VALOF
{ LET argv = VEC 4
  LET seg, entry, code = 0, 0, 0
  UNLESS rdargs("", argv, 4) RESULTIS 20
  seg := loadseg("/work/program")
  UNLESS seg DO { writes("Cannot load compiled program*n"); RESULTIS 20 }
  UNLESS globin(seg) DO { writes("Cannot initialize compiled program*n"); RESULTIS 20 }
  entry := (@globsize)!1
  originalwrch := wrch
  wrch := textwrch
  code := entry()
  deplete(output())
  cli_returncode := code
  sys(Sys_quit, 0)
  RESULTIS code
}
