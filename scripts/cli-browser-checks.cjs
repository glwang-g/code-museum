const assert=require('node:assert/strict');
module.exports=async function({evaluate,wait,page,screenshot,results,token}){
  const samples=[
    ['typescript','function sum(n:number):number{let total=0;for(let i=1;i<=n;i++)total+=i;return total;}console.log(sum(10));','','55\n'],
    ['sql','CREATE TABLE n(v INTEGER);INSERT INTO n VALUES(2),(5),(8);SELECT SUM(v) FROM n;','','15\n'],
    ['bash','while IFS= read -r line;do printf "[%s]\\n" "$line";done','hello\n博物馆\n','[hello]\n[博物馆]\n'],
    ['awk','{sum+=$2} END{print NR,sum}','C 2\nLisp 5\nPython 8\n','3 15\n'],
    ['sed','s/world/Museum/g','Hello world\nworld river\n','Hello Museum\nMuseum river\n'],
    ['php','<?php echo array_sum(range(1,10)), PHP_EOL;','','55\n'],
    ['perl','my $total = 0; $total += $_ for 1 .. 10; print "$total\\n";','','55\n'],
    ['xslt','<?xml version="1.0"?><xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"><xsl:output method="text"/><xsl:template match="/"><xsl:value-of select="sum(/museum/year)"/><xsl:text>&#10;</xsl:text></xsl:template></xsl:stylesheet>','<?xml version="1.0"?><museum><year>1972</year><year>1958</year><year>1991</year></museum>','5921\n'],
    ['csharp','using System; class Museum { static void Main() { Console.WriteLine(1972 + 1958 + 1991); } }','','5921\n'],
    ['fortran','program museum\n  implicit none\n  print \'(I0)\', 1972 + 1958 + 1991\nend program museum\n','','5921\n'],
    ['pascal','program Museum; var total,i: integer; begin total:=0; for i:=1 to 10 do total:=total+i; writeln(total); end.','','55\n'],
    ['r','cat(sum(1:10), "\\n", sep="")','','55\n']
  ];
  const compiled=new Set(['typescript','csharp','fortran','pascal']);
  let lastRun=0;
  async function edit(code){await evaluate(`(()=>{const e=document.querySelector('#lab-code');e.value=${JSON.stringify(code)};e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
  async function clickRun(){
    const delay=Math.max(0,6500-(Date.now()-lastRun));if(delay)await new Promise(ok=>setTimeout(ok,delay));lastRun=Date.now();
    await evaluate(`document.querySelector('#lab-run').click()`);
  }
  async function output(text){await wait(`document.querySelector('#lab-result').dataset.state==='ok'&&document.querySelector('#lab-result').textContent===${JSON.stringify(text)}`,45000)}
  await wait(`window.MUSEUM_EXECUTION.canRun('typescript')&&window.MUSEUM_EXECUTION.canRun('sed')&&window.MUSEUM_EXECUTION.canRun('pascal')&&window.MUSEUM_EXECUTION.canRun('r')`);
  for(const width of [1440,390]){
    await page('Emulation.setDeviceMetricsOverride',{width,height:width===1440?1000:844,mobile:width===390,deviceScaleFactor:1});
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(width===1440?'dark':'light')}`);
    for(const [language,code,stdin,expected] of samples){
      const before=await evaluate('window.__posts');
      await evaluate(`window.MUSEUM_LAB.open(${JSON.stringify(language)});document.querySelector('#lab-stdin').value=${JSON.stringify(stdin)}`);
      await edit(code);
      assert.equal(await evaluate('window.__posts'),before,'opening/editing must not submit');
      assert.equal(await evaluate(`document.querySelector('#lab-execution-mode option[value="local"]').disabled`),true);
      assert.equal(await evaluate(`document.querySelector('#lab-stdin').tagName`),'TEXTAREA');
      assert.equal(await evaluate(`document.querySelector('#lab-stdin').disabled`),language==='sql');
      assert.equal(await evaluate(`window.MUSEUM_LAB.entry(${JSON.stringify(language)}).kind`),'remote');
      await clickRun();await output(expected);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
      assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),!compiled.has(language));
      assert.match(await evaluate(`document.querySelector('#lab-environment-summary').textContent`),/服务器/);
      if(compiled.has(language))assert.match(await evaluate(`document.querySelector('#lab-timings').textContent`),/编译 \d+ ms.*运行 \d+ ms/);
      await screenshot('cli-'+language+'-'+width+'.png');
      if(width===390){
        await evaluate(`document.querySelector('#lab-result').scrollIntoView({block:'center'})`);
        const bounds=await evaluate(`(()=>{const r=document.querySelector('#lab-result').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}})()`);
        assert.ok(bounds.height>=24&&bounds.top>=0&&bounds.bottom<=844,'Narrow-screen output must be visible and have usable height: '+JSON.stringify(bounds));
        await screenshot('cli-'+language+'-'+width+'-output.png');
      }
      results.push({name:'Actual '+language+' browser editing, remote execution, output and input controls',width,output:expected});
    }
  }
  await evaluate(`window.MUSEUM_LAB.open('pascal')`);
  await edit('program Museum; var n: integer; begin writeln(\'MUST_NOT_RUN\'); n:=\'wrong\'; end.');await clickRun();
  await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,30000);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/Error/i);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent.includes('MUST_NOT_RUN')`),false);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-timings').textContent`),/ · 运行/);
  results.push({name:'Pascal compiler errors are separate and prevent program execution',passed:true});
  await edit('program Museum; begin writeln(42); end.');await clickRun();await output('42\n');
  results.push({name:'Pascal edited source recovers from compilation error',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('r');document.querySelector('#lab-stdin').value='hello\\n博物馆\\n'`);
  await edit('lines <- readLines(file("stdin"), warn=FALSE); cat(paste0("[", lines, "]"), sep="\\n")');await clickRun();await output('[hello]\n[博物馆]\n');
  assert.match(await evaluate(`document.querySelector('#lab-state-version').textContent`),/R 4\.2\.2/);
  results.push({name:'Rscript multiline UTF-8 input and actual version are visible',passed:true});
  await edit('stop("intentional error")');await clickRun();
  await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/intentional error/);
  assert.equal(await evaluate(`document.querySelector('#lab-compiler').hidden`),true);
  results.push({name:'R runtime errors remain real errors without compiler diagnostics',passed:true});
  await edit('cat(42, "\\n", sep="")');await clickRun();await output('42\n');
  results.push({name:'R edited source recovers from runtime error',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('typescript')`);
  await edit('console.log("MUST_NOT_RUN");const value:number="wrong";');await clickRun();
  await wait(`document.querySelector('#lab-result').textContent.includes('编译失败，未执行程序。')`,30000);
  assert.equal(await evaluate(`document.querySelector('#lab-result').textContent.includes('MUST_NOT_RUN')`),false);
  assert.match(await evaluate(`document.querySelector('#lab-compiler-result').textContent`),/TS2322/);
  assert.doesNotMatch(await evaluate(`document.querySelector('#lab-timings').textContent`),/ · 运行/);
  assert.equal(await evaluate(`document.querySelector('#lab-error-kind').textContent`),'编译错误');
  await screenshot('cli-typescript-type-error-390.png');
  results.push({name:'TypeScript type diagnostics are visible; failed typing never executes JavaScript',passed:true});
  await edit('console.log(42 as number);');await clickRun();await output('42\n');
  results.push({name:'TypeScript recovers and executes changed source',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('sql');document.querySelector('#lab-stdin').value='previous language input'`);
  await edit('SELECT * FROM n;');await clickRun();
  await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/no such table/);
  results.push({name:'SQLite does not reuse previous task database and ignores disabled separate stdin',passed:true});
  await edit('.shell echo MUST_NOT_RUN\n');await clickRun();
  await wait(`document.querySelector('#lab-result').dataset.state==='error'`);
  assert.match(await evaluate(`document.querySelector('#lab-result').textContent`),/safe|cannot/i);
  results.push({name:'SQLite safe-mode rejection appears as a real execution error',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('awk');document.querySelector('#lab-stdin').value=''`);
  await edit('BEGIN {while(1){}}');await clickRun();
  await wait(`document.querySelector('#lab-runtime-state').dataset.stage==='running'`);
  await evaluate(`document.querySelector('#lab-stop').click()`);
  await wait(`document.querySelector('#lab-runtime-state').dataset.stage==='cancelled'`);
  await edit('BEGIN{print 42}');await clickRun();await output('42\n');
  results.push({name:'Stop an actual AWK run, then recover',passed:true});
  // Check archive entry and selected map runtime badges, including micro-dot languages.
  await evaluate(`document.querySelector('#timeline-view').click()`);
  for(const [language] of samples){
    await evaluate(`document.querySelector('#docks [data-id="'+${JSON.stringify(language)}+'"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#docks .dock.selected').hasAttribute('data-runnable')`),true);
    assert.match(await evaluate(`document.querySelector('#detail-open-lab').textContent`),language==='xslt'?/转换/:/运行/);
  }
  results.push({name:'Twelve map labels/dots and archive entries expose available real runtimes',passed:true});
  await evaluate(`window.MUSEUM_LAB.open('sql');document.querySelector('#lab-runtime-credit').click()`);
  await wait(`!document.querySelector('#about').hidden`);
  assert.match(await evaluate(`document.querySelector('#about').textContent`),/SQLite/);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/server/runtimes/cli/assets/'))`),false);
  results.push({name:'Runtime credits open and server tools are not downloaded into the browser',passed:true});
};
