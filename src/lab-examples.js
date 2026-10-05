// Original short examples. Browser execution is available for JavaScript and Python.
window.MUSEUM_LAB_EXAMPLES = [
  {id:'javascript',file:'museum.js',code:'const languages = ["C", "Lisp", "JavaScript"];\nfor (const name of languages) {\n  console.log(`Hello, ${name}!`);\n}\n'},
  {id:'python',file:'museum.py',code:'languages = ["C", "Lisp", "Python"]\nfor name in languages:\n    print(f"Hello, {name}!")\n'},
  {id:'c',file:'museum.c',code:'#include <stdio.h>\n\nint main(void) {\n    puts("Hello, Code Museum!");\n    return 0;\n}\n'},
  {id:'cpp',file:'museum.cpp',code:'#include <iostream>\n\nint main() {\n    std::cout << "Hello, Code Museum!\\n";\n}\n'},
  {id:'java',file:'Museum.java',code:'class Museum {\n    public static void main(String[] args) {\n        System.out.println("Hello, Code Museum!");\n    }\n}\n'},
  {id:'ruby',file:'museum.rb',code:'["C", "Lisp", "Ruby"].each do |name|\n  puts "Hello, #{name}!"\nend\n'},
  {id:'go',file:'museum.go',code:'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, Code Museum!")\n}\n'},
  {id:'rust',file:'museum.rs',code:'fn main() {\n    println!("Hello, Code Museum!");\n}\n'},
  {id:'bash',file:'museum.bash',note:'本示例已在 Bash 3.2 本机核验；网页尚未接入该语言的运行环境。',code:'s=0; for ((i=1;i<=10;i++)); do s=$((s+i)); done; printf "%s\\n" "$s"\n'},
  {id:'korn-shell',file:'museum.ksh',note:'本示例已在 ksh93u+ 本机核验；网页尚未接入该语言的运行环境。',code:'typeset -i total=0\nfor ((i=1; i<=10; i++)); do total=$((total+i)); done\nprint -r -- "$total"\n'},
  {id:'tcsh',file:'museum.tcsh',note:'本示例已在 tcsh 6.21 本机核验；网页尚未接入该语言的运行环境。',code:'@ total = 0\nforeach number (1 2 3 4 5 6 7 8 9 10)\n  @ total = $total + $number\nend\necho "$total"\n'}
];
