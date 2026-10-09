(() => {
  const $=id=>document.getElementById(id),lab=window.MUSEUM_LAB;
  if(!lab)return;
  const lessons=window.MUSEUM_LESSONS,execution=window.MUSEUM_EXECUTION;
  const names=new Map(window.MUSEUM_DATA.records.map(r=>[r.id,r.name]));
  const extensions={javascript:'js',python:'py',lua:'lua',scheme:'scm',ruby:'rb',c:'c',cpp:'cpp',java:'java',csharp:'cs',go:'go',rust:'rs',bash:'bash','korn-shell':'ksh',tcsh:'tcsh'};
  let importing=false;
  function environment(){
    const id=lab.current,mode=execution?.handles(id)?execution.mode(id):'local';
    const local=mode==='local';
    const descriptions={
      javascript:'浏览器原生 JavaScript · 无需下载 · 2秒执行预算 · 不上传代码',
      python:local?'浏览器 Python · Pyodide · 约13.53 MB未压缩 · 加载90秒 / 执行3秒 · 不上传代码':'服务器 Python · 私有令牌 · 点击运行才上传 · 3秒执行预算',
      lua:'浏览器 Lua 5.4 · Wasmoon · 约413 KiB未压缩 · 加载30秒 / 执行2秒 · 不上传代码',
      scheme:'浏览器 Scheme · BiwaScheme 0.8.3 · 约244 KiB · 非Wasm / 非完整R7RS · 加载30秒 / 执行2秒',
      ruby:'服务器 Ruby · 私有令牌 · 点击运行才上传 · 3秒执行预算 · 无本地环境'
    };
    const short={javascript:'浏览器 JavaScript · 无需下载',python:local?'浏览器 Python · 约13.53 MB':'服务器 Python · 需要令牌',lua:'浏览器 Lua · 约413 KiB',scheme:'浏览器 Scheme · 约244 KiB',ruby:'服务器 Ruby · 需要令牌'};
    $('lab-environment-summary').textContent=short[id]||'仅编辑 · 未接入在线运行';
    $('lab-environment-detail').textContent=descriptions[id]||'仅编辑示例或草稿 · 尚未接入在线运行环境';
    $('lab-local-suggestion').hidden=id!=='python'||local||$('lab-remote-token').value.length>=32;
  }
  function render(){
    const id=lab.current,entry=lessons.languages[id];
    if(!importing)$('lab-file-feedback').hidden=true;
    $('lab-topic').innerHTML='<option value="default">馆内示例 / 自由草稿</option>'+(entry?lessons.topics.map(t=>`<option value="${t.id}">${t.name}</option>`).join(''):'');
    $('lab-topic').value=lab.topic;
    const topic=lessons.topics.find(t=>t.id===lab.topic);
    $('lab-topic-note').textContent=topic?`${topic.task} · ${entry.version}`:'切换主题会保留各自草稿；导入和恢复示例不会自动执行。';
    $('lab-undo').hidden=!lab.hasBackup;
    $('lab-draft-status').textContent=(lab.modified?'已修改 · ':'')+(window.MUSEUM_DRAFT_STORE?.persistent?'草稿已在本机保存':'草稿仅当前页面保存（浏览器存储不可用）');
    environment();
  }
  function activity(){
    const stage=$('lab-runtime-state').dataset.stage;
    $('lab-stop').hidden=!['downloading','initializing','submitting','queued','running'].includes(stage);
    const result=$('lab-result'),error=$('lab-error-kind');
    error.hidden=result.dataset.state!=='error';
    if(!error.hidden){
      const text=result.textContent;
      error.textContent=/超过.*秒|超时|timed.out/i.test(text)?'执行超时':/SyntaxError|syntax error|语法错误|unexpected token|unexpected end|expected near|unexpected symbol|found EOS|unterminated/i.test(text)?'语法错误':/令牌|配额|队列已满/.test(text)?'访问限制':/加载|运行环境|连接|响应无效|Worker|资源/.test(text)?'环境不可用':'运行异常';
    }
  }
  document.addEventListener('click',event=>{for(const id of ['lab-file-tools','lab-environment'])if(!$(id).contains(event.target))$(id).open=false});
  $('lab-topic').onchange=()=>lab.chooseTopic($('lab-topic').value);
  $('lab-local-suggestion').onclick=()=>execution.chooseLocal();
  $('lab-stop').onclick=()=>lab.manualStop();
  $('lab-undo').onclick=()=>lab.undo();
  $('lab-import').onclick=()=>{if(!importing)$('lab-import-file').click()};
  $('lab-import-file').onchange=async()=>{
    const file=$('lab-import-file').files[0];if(!file)return;
    const id=lab.current,topic=lab.topic;
    importing=true;
    try{
      if(file.size>131072)throw new Error('代码文件最多128 KiB。');
      const bytes=await file.arrayBuffer();
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Error('请选择有效的 UTF-8 文本代码文件。')}
      if(text.includes('\0'))throw new Error('请选择 UTF-8 文本代码文件。');
      if(id!==lab.current||topic!==lab.topic)throw new Error('语言或主题已切换，请重新导入。');
      lab.importCode(text);$('lab-file-tools').open=false;$('lab-file-feedback').textContent='已导入；替换前草稿可恢复，点击运行后执行。';$('lab-file-feedback').hidden=false;
    }catch(error){$('lab-file-feedback').textContent=error.message||'导入失败，请使用 UTF-8 文本。';$('lab-file-feedback').hidden=false;}
    finally{importing=false;$('lab-import-file').value=''}
  };
  $('lab-download').onclick=()=>{
    const blob=new Blob([lab.code],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(lab.current==='java'?'Museum':lab.current==='csharp'?'Program':'museum-'+lab.current)+(lab.current==='java'||lab.current==='csharp'?'':'-'+lab.topic)+'.'+(extensions[lab.current]||'txt');
    a.click();$('lab-file-tools').open=false;setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  document.addEventListener('museum-lab-change',render);
  document.addEventListener('museum-execution-change',environment);
  window.addEventListener('museum-draft-saved',()=>{$('lab-draft-status').textContent=(lab.modified?'已修改 · ':'')+(window.MUSEUM_DRAFT_STORE.persistent?'草稿已在本机保存':'草稿仅当前页面保存（浏览器存储不可用）')});
  $('lab-remote-token').addEventListener('input',environment);
  new MutationObserver(activity).observe($('lab-runtime-state'),{attributes:true,attributeFilter:['data-stage']});
  new MutationObserver(activity).observe($('lab-result'),{attributes:true,childList:true,characterData:true,subtree:true});
  render();activity();
})();
