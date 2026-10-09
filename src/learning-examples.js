// Original learning programs; version labels describe syntax, not guaranteed installed runtimes.
window.MUSEUM_LESSONS={
  "topics": [
    {
      "id": "variables",
      "name": "变量与输出",
      "task": "定义名字与年份并输出；观察类型声明与字符串。"
    },
    {
      "id": "loops",
      "name": "循环与累加",
      "task": "计算 1 到 10 的总和；观察范围端点与循环结构。"
    },
    {
      "id": "functions",
      "name": "函数",
      "task": "定义平方函数并调用；观察参数与返回值。"
    },
    {
      "id": "collections",
      "name": "集合与遍历",
      "task": "把 3、1、2 逐项乘以 2；输出格式因语言习惯而异。"
    }
  ],
  "languages": {
    "javascript": {
      "version": "ECMAScript 2015+",
      "goal": "浏览器脚本与通用动态编程",
      "source": "https://tc39.es/ecma262/",
      "runtime": "浏览器原生 · 无需下载",
      "examples": {
        "variables": {
          "code": "const name = \"Museum\";\nconst year = 2026;\nconsole.log(name, year);\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "let total = 0;\nfor (let i = 1; i <= 10; i++) total += i;\nconsole.log(total);\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "function square(n) { return n * n; }\nconsole.log(square(7));\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "const values = [3, 1, 2];\nconst doubled = values.map(n => n * 2);\nconsole.log(doubled.join(\", \"));\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "python": {
      "version": "Python 3",
      "goal": "强调可读性与通用脚本编程",
      "source": "https://docs.python.org/3/tutorial/",
      "runtime": "浏览器 Pyodide / 私有远端",
      "examples": {
        "variables": {
          "code": "name = \"Museum\"\nyear = 2026\nprint(name, year)\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "total = 0\nfor i in range(1, 11):\n    total += i\nprint(total)\n",
          "note": "range(1, 11) 不包含右端点 11。"
        },
        "functions": {
          "code": "def square(n):\n    return n * n\n\nprint(square(7))\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "values = [3, 1, 2]\ndoubled = [n * 2 for n in values]\nprint(\", \".join(str(n) for n in doubled))\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "lua": {
      "version": "Lua 5.4",
      "goal": "轻量、可嵌入的动态语言",
      "source": "https://www.lua.org/manual/5.4/",
      "runtime": "浏览器 Wasmoon · 约413 KiB",
      "examples": {
        "variables": {
          "code": "local name = \"Museum\"\nlocal year = 2026\nprint(name, year)\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "local total = 0\nfor i = 1, 10 do\n  total = total + i\nend\nprint(total)\n",
          "note": "数值 for 包含端点 10。"
        },
        "functions": {
          "code": "local function square(n)\n  return n * n\nend\nprint(square(7))\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "local values = {3, 1, 2}\nlocal doubled = {}\nfor i, n in ipairs(values) do\n  doubled[i] = n * 2\nend\nprint(table.concat(doubled, \", \"))\n",
          "note": "table 作为连续序列，ipairs 遍历，索引从 1 开始。"
        }
      }
    },
    "scheme": {
      "version": "BiwaScheme 0.8.3 支持的 Scheme 子集",
      "goal": "以过程和词法作用域探索计算表达",
      "source": "https://www.scheme.org/schemers/",
      "runtime": "浏览器 BiwaScheme · 约244 KiB，非Wasm",
      "examples": {
        "variables": {
          "code": "(define name \"Museum\")\n(define year 2026)\n(display name) (display \" \")\n(display year) (newline)\n",
          "note": "define 将名字绑定到值。"
        },
        "loops": {
          "code": "(define (sum-to n)\n  (let loop ((i 1) (total 0))\n    (if (> i n) total\n        (loop (+ i 1) (+ total i)))))\n(display (sum-to 10)) (newline)\n",
          "note": "命名 let 表达循环，使用尾递归。"
        },
        "functions": {
          "code": "(define (square n) (* n n))\n(display (square 7)) (newline)\n",
          "note": "过程也是值，使用前缀形式调用。"
        },
        "collections": {
          "code": "(define values '(3 1 2))\n(define doubled (map (lambda (n) (* n 2)) values))\n(for-each (lambda (n) (display n) (display \" \")) doubled)\n(newline)\n",
          "note": "这里使用链表；for-each 的输出是空格分隔。"
        }
      }
    },
    "ruby": {
      "version": "Ruby 3",
      "goal": "面向对象的动态编程",
      "source": "https://docs.ruby-lang.org/en/master/",
      "runtime": "私有远端 · 需令牌",
      "examples": {
        "variables": {
          "code": "name = \"Museum\"\nyear = 2026\nputs \"#{name} #{year}\"\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "total = 0\n(1..10).each { |i| total += i }\nputs total\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "def square(n)\n  n * n\nend\nputs square(7)\n",
          "note": "最后一个表达式的值作为返回值。"
        },
        "collections": {
          "code": "values = [3, 1, 2]\ndoubled = values.map { |n| n * 2 }\nputs doubled.join(\", \")\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "c": {
      "version": "C11",
      "goal": "面向系统编程，提供低层数据与操作能力",
      "source": "https://www.open-std.org/jtc1/sc22/wg14/",
      "runtime": "私有远端编译执行 · 需令牌",
      "examples": {
        "variables": {
          "code": "#include <stdio.h>\nint main(void) {\n    const char *name = \"Museum\";\n    int year = 2026;\n    printf(\"%s %d\\n\", name, year);\n    return 0;\n}\n",
          "note": "const char * 是字符串指针，int 明确整数类型。"
        },
        "loops": {
          "code": "#include <stdio.h>\nint main(void) {\n    int total = 0;\n    for (int i = 1; i <= 10; ++i) total += i;\n    printf(\"%d\\n\", total);\n    return 0;\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "#include <stdio.h>\nint square(int n) { return n * n; }\nint main(void) {\n    printf(\"%d\\n\", square(7));\n    return 0;\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "#include <stdio.h>\nint main(void) {\n    int values[] = {3, 1, 2};\n    for (int i = 0; i < 3; ++i) {\n        printf(\"%s%d\", i ? \", \" : \"\", values[i] * 2);\n    }\n    puts(\"\");\n    return 0;\n}\n",
          "note": "固定长度数组，逐项处理；此例不使用动态集合。"
        }
      }
    },
    "cpp": {
      "version": "C++17",
      "goal": "系统编程并支持抽象、泛型与面向对象",
      "source": "https://isocpp.org/std/the-standard",
      "runtime": "私有远端编译执行 · 需令牌",
      "examples": {
        "variables": {
          "code": "#include <iostream>\n#include <string>\nint main() {\n    std::string name = \"Museum\";\n    int year = 2026;\n    std::cout << name << \" \" << year << \"\\n\";\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "#include <iostream>\nint main() {\n    int total = 0;\n    for (int i = 1; i <= 10; ++i) total += i;\n    std::cout << total << \"\\n\";\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "#include <iostream>\nint square(int n) { return n * n; }\nint main() { std::cout << square(7) << \"\\n\"; }\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "#include <iostream>\n#include <vector>\nint main() {\n    std::vector<int> values{3, 1, 2};\n    for (std::size_t i = 0; i < values.size(); ++i)\n        std::cout << (i ? \", \" : \"\") << values[i] * 2;\n    std::cout << \"\\n\";\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "java": {
      "version": "Java 17",
      "goal": "静态类型、面向对象及跨平台运行",
      "source": "https://docs.oracle.com/javase/specs/jls/se17/html/index.html",
      "runtime": "私有远端编译执行 · 需令牌",
      "examples": {
        "variables": {
          "code": "class Museum {\n    public static void main(String[] args) {\n        String name = \"Museum\";\n        int year = 2026;\n        System.out.println(name + \" \" + year);\n    }\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "class Museum {\n    public static void main(String[] args) {\n        int total = 0;\n        for (int i = 1; i <= 10; i++) total += i;\n        System.out.println(total);\n    }\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "class Museum {\n    static int square(int n) { return n * n; }\n    public static void main(String[] args) {\n        System.out.println(square(7));\n    }\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "class Museum {\n    public static void main(String[] args) {\n        int[] values = {3, 1, 2};\n        for (int i = 0; i < values.length; i++)\n            System.out.print((i == 0 ? \"\" : \", \") + values[i] * 2);\n        System.out.println();\n    }\n}\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "csharp": {
      "version": "C# 10 / .NET 6",
      "goal": "静态类型、面向对象及 .NET 平台编程",
      "source": "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/",
      "runtime": "仅编辑 · 未接入在线运行",
      "examples": {
        "variables": {
          "code": "using System;\nstring name = \"Museum\";\nint year = 2026;\nConsole.WriteLine($\"{name} {year}\");\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "loops": {
          "code": "using System;\nint total = 0;\nfor (int i = 1; i <= 10; i++) total += i;\nConsole.WriteLine(total);\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "functions": {
          "code": "using System;\nint Square(int n) => n * n;\nConsole.WriteLine(Square(7));\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        },
        "collections": {
          "code": "using System;\nint[] values = {3, 1, 2};\nint[] doubled = Array.ConvertAll(values, n => n * 2);\nConsole.WriteLine(string.Join(\", \", doubled));\n",
          "note": "这是原创完整示例，展示一种常见写法。"
        }
      }
    },
    "rust": {
      "version": "Rust 2021",
      "goal": "强调内存安全的系统编程",
      "source": "https://doc.rust-lang.org/book/",
      "runtime": "私有远端编译执行 · 需令牌",
      "examples": {
        "variables": {
          "code": "fn main() {\n    let name = \"Museum\";\n    let year: i32 = 2026;\n    println!(\"{} {}\", name, year);\n}\n",
          "note": "let 默认不可变，i32 明确整数类型。"
        },
        "loops": {
          "code": "fn main() {\n    let mut total = 0;\n    for i in 1..=10 { total += i; }\n    println!(\"{}\", total);\n}\n",
          "note": "mut 允许修改累加器，1..=10 包含右端点。"
        },
        "functions": {
          "code": "fn square(n: i32) -> i32 { n * n }\nfn main() { println!(\"{}\", square(7)); }\n",
          "note": "末尾表达式不加分号，作为返回值。"
        },
        "collections": {
          "code": "fn main() {\n    let values = vec![3, 1, 2];\n    let doubled: Vec<String> = values.iter().map(|n| (n * 2).to_string()).collect();\n    println!(\"{}\", doubled.join(\", \"));\n}\n",
          "note": "Vec 是动态数组，迭代器把逐项结果收集成新集合。"
        }
      }
    },
    "go": {
      "version": "Go",
      "goal": "强调简洁与并发的通用编程",
      "source": "https://go.dev/ref/spec",
      "runtime": "私有远端编译执行 · 需令牌",
      "examples": {
        "variables": {
          "code": "package main\nimport \"fmt\"\nfunc main() {\n    name := \"Museum\"\n    year := 2026\n    fmt.Println(name, year)\n}\n",
          "note": ":= 声明变量并推断类型。"
        },
        "loops": {
          "code": "package main\nimport \"fmt\"\nfunc main() {\n    total := 0\n    for i := 1; i <= 10; i++ { total += i }\n    fmt.Println(total)\n}\n",
          "note": "for 是 Go 的循环结构，此例包含端点 10。"
        },
        "functions": {
          "code": "package main\nimport \"fmt\"\nfunc square(n int) int { return n * n }\nfunc main() { fmt.Println(square(7)) }\n",
          "note": "参数和返回类型写在名字后面。"
        },
        "collections": {
          "code": "package main\nimport (\"fmt\"; \"strconv\"; \"strings\")\nfunc main() {\n    values := []int{3, 1, 2}\n    doubled := make([]string, 0, len(values))\n    for _, n := range values { doubled = append(doubled, strconv.Itoa(n * 2)) }\n    fmt.Println(strings.Join(doubled, \", \"))\n}\n",
          "note": "slice 表示序列，range 遍历；这里只使用标准库。"
        }
      }
    }
  }
};
