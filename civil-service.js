(()=>{
  'use strict';
  const data=window.CIVIL_SERVICE_2026;
  const count=document.getElementById('csCount');
  if(!data?.jobs?.length){count.textContent='职位数据未能载入';return;}
  const $=id=>document.getElementById(id);
  const pageSize=50;
  const F={dept:'部门名称',office:'用人司局',agency:'机构性质',title:'招考职位',attr:'职位属性',dist:'职位分布',intro:'职位简介',code:'职位代码',level:'机构层级',exam:'考试类别',count:'招考人数',major:'专业',edu:'学历',degree:'学位',politics:'政治面貌',years:'基层工作最低年限',project:'服务基层项目工作经历',test:'是否在面试阶段组织专业能力测试',ratio:'面试人员比例',work:'工作地点',hukou:'落户地点',notes:'备注',site:'部门网站',p1:'咨询电话1',p2:'咨询电话2',p3:'咨询电话3',sheet:'招录类别'};
  const jobs=data.jobs.map(row=>Object.fromEntries(data.columns.map((key,i)=>[key,row[i]??''])));
  const plannedRecruitment=jobs.reduce((sum,job)=>sum+(Number(job['招考人数'])||0),0);
  document.getElementById('csDataSummary').textContent='数据快照：'+jobs.length.toLocaleString()+' 条职位；表内招录人数合计 '+plannedRecruitment.toLocaleString()+' 人（逐行求和）。静态目录，不是实时职位 feed。';
  let page=0,filtered=[];
  const value=id=>$(id).value.trim();
  const norm=s=>String(s??'').toLowerCase().replace(/[\s\u3000]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function fillOptions(id,values){
    [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN')).forEach(x=>{
      const option=document.createElement('option');option.value=x;option.textContent=x;$(id).append(option);
    });
  }
  fillOptions('csSheet',(data.sheets||[]).map(s=>s.name));
  [['csNature',F.agency],['csLevel',F.level],['csAttribute',F.attr],['csExam',F.exam]].forEach(([id,key])=>fillOptions(id,jobs.map(j=>j[key])));
  function numberInChinese(text){
    const match=String(text||'').match(/(?:至少|满)?\s*(\d+|[零〇一二两三四五六七八九十百]+)\s*年/);
    if(!match)return null;
    const token=match[1];if(/^\d+$/.test(token))return Number(token);
    const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    if(token.includes('百')){const p=token.indexOf('百');return (digits[token.slice(0,p)]||1)*100+(token.slice(p+1).includes('十')?10*(digits[token.slice(p+2,p+3)]||1)+(digits[token.slice(p+3)]||0):digits[token.slice(p+1)]||0)}
    if(token.includes('十')){const p=token.indexOf('十');return (p===0?1:(digits[token.slice(0,p)]||0))*10+(digits[token.slice(p+1)]||0)}
    return digits[token]??null;
  }
  function requirementLevels(text){
    const levels=[];
    if(/博士/.test(text))levels.push(4);
    if(/硕士/.test(text))levels.push(3);
    if(/本科/.test(text))levels.push(2);
    if(/大专|专科/.test(text))levels.push(1);
    return [...new Set(levels)];
  }
  function educationCheck(candidate,requirement){
    if(!candidate)return 'skip';
    if(!requirement||/不限|无要求|不限制/.test(requirement))return 'pass';
    const ranks={'大专':1,'本科':2,'硕士研究生':3,'博士研究生':4};
    const own=ranks[candidate],allowed=requirementLevels(requirement);
    if(!allowed.length)return 'review';
    if(/仅限/.test(requirement)&&/及以上|以上/.test(requirement))return own>=Math.min(...allowed)?'pass':'fail';
    if(/仅限/.test(requirement)){
      if(allowed.length>1&&/或|、|,|，/.test(requirement))return allowed.includes(own)?'pass':'fail';
      return allowed.length===1&&own===allowed[0]?'pass':'fail';
    }
    if(/及以上|以上/.test(requirement))return own>=Math.min(...allowed)?'pass':'fail';
    if(allowed.length>1)return allowed.includes(own)?'pass':'fail';
    return own>=allowed[0]?'pass':'fail';
  }
  function degreeCheck(candidate,requirement){
    if(!candidate)return 'skip';
    if(!requirement||/不限|无要求|不限制/.test(requirement))return 'pass';
    if(/与最高学历相对应/.test(requirement))return 'review';
    const ranks={'学士':1,'硕士':2,'博士':3};
    const own=ranks[candidate];
    const allowed=[];
    if(/博士/.test(requirement))allowed.push(3);
    if(/硕士/.test(requirement))allowed.push(2);
    if(/学士/.test(requirement))allowed.push(1);
    if(!allowed.length)return 'review';
    if(/及以上|以上/.test(requirement))return own>=Math.min(...allowed)?'pass':'fail';
    if(allowed.length>1)return allowed.includes(own)?'pass':'fail';
    if(own===allowed[0])return 'pass';
    return own<allowed[0]?'fail':'review';
  }
  function politicsCheck(candidate,requirement){
    if(!candidate)return 'skip';
    if(!requirement||/不限|无要求|不限制/.test(requirement))return 'pass';
    if(/党员.*共青团员|共青团员.*党员/.test(requirement))return /中共党员|共青团员/.test(candidate)?'pass':'fail';
    if(/党员/.test(requirement))return /党员/.test(candidate)?'pass':'fail';
    if(/共青团员/.test(requirement))return /共青团员/.test(candidate)?'pass':'fail';
    if(/群众/.test(requirement))return /群众/.test(candidate)?'pass':'fail';
    return norm(requirement).includes(norm(candidate))?'pass':'review';
  }
  function evaluate(job){
    const checks=[];
    const add=(label,result)=>{if(result!=='skip')checks.push({label,result});};
    add('学历',educationCheck(value('csEducation'),job[F.edu]));
    add('学位',degreeCheck(value('csDegree'),job[F.degree]));
    add('政治面貌',politicsCheck(value('csPolitics'),job[F.politics]));
    const years=value('csYears');
    if(years){
      const req=job[F.years]||'';
      if(/不限|无限制|无要求/.test(req))add('基层工作年限','pass');
      else{const need=numberInChinese(req);add('基层工作年限',need===null?'review':Number(years)>=need?'pass':'fail');}
    }
    if(value('csMajor'))add('专业关键词命中','review');
    const project=value('csProject');
    if(project){
      const req=job[F.project]||'';
      if(/不限|无限制|无要求/.test(req))add('服务基层项目','pass');
      else add('服务基层项目',norm(req).includes(norm(project))?'pass':'review');
    }
    if(checks.some(c=>c.result==='fail'))return {status:'可能不符',checks};
    if(checks.some(c=>c.result==='review'))return {status:'需人工复核',checks};
    if(!checks.length)return {status:'未填写条件',checks};
    return {status:'初筛符合',checks};
  }
  function safeUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function filteredByInputs(job){
    const keyword=norm(value('csKeyword'));
    if(keyword&&!Object.values(job).some(x=>norm(x).includes(keyword)))return false;
    const location=norm(value('csLocation'));
    if(location&&![job[F.work],job[F.hukou]].some(x=>norm(x).includes(location)))return false;
    const minimum=Number(value('csRecruit'))||0;
    if(minimum&&(Number(job[F.count])||0)<minimum)return false;
    for(const [id,key] of [['csSheet',F.sheet],['csNature',F.agency],['csLevel',F.level],['csAttribute',F.attr],['csExam',F.exam],['csTest',F.test]])if(value(id)&&job[key]!==value(id))return false;
    const majorTerms=value('csMajor').split(/[,，、;；\s]+/).map(norm).filter(Boolean);
    if(majorTerms.length&&!/专业不限|不限|无要求/.test(job[F.major]||'')&&!majorTerms.some(term=>norm(job[F.major]).includes(term)))return false;
    return true;
  }
  function render(){
    filtered=jobs.filter(filteredByInputs).map(job=>({job,result:evaluate(job)}));
    const status=value('csStatus');if(status)filtered=filtered.filter(x=>x.result.status===status);
    const sort=value('csSort');
    if(sort==='recruit')filtered.sort((a,b)=>(Number(b.job[F.count])||0)-(Number(a.job[F.count])||0));
    if(sort==='code')filtered.sort((a,b)=>(a.job[F.code]||'').localeCompare(b.job[F.code]||''));
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.max(0,Math.min(page,pages-1));
    const start=page*pageSize,visible=filtered.slice(start,start+pageSize);
    const counts=filtered.reduce((acc,x)=>(acc[x.result.status]=(acc[x.result.status]||0)+1,acc),{});
    $('csCount').textContent='符合当前筛选 '+filtered.length.toLocaleString()+' / '+jobs.length.toLocaleString()+' 个职位；初筛符合 '+(counts['初筛符合']||0).toLocaleString()+'，需复核 '+(counts['需人工复核']||0).toLocaleString()+'，可能不符 '+(counts['可能不符']||0).toLocaleString();
    $('csPageInfo').textContent='第 '+(page+1)+' / '+pages+' 页 · 每页 '+pageSize+' 条 · 表内计划招录 '+filtered.reduce((sum,x)=>sum+(Number(x.job[F.count])||0),0).toLocaleString()+' 人';
    $('csPrev').disabled=page===0;$('csNext').disabled=page>=pages-1;$('csExport').disabled=!filtered.length;
    $('csRows').innerHTML=visible.map(({job,result})=>{
      const cls=result.status==='初筛符合'?'civil-match':result.status==='可能不符'?'civil-miss':result.status==='未填写条件'?'civil-neutral':'civil-review';
      const contact=[job[F.p1],job[F.p2],job[F.p3]].filter(Boolean).map(esc).join(' / ')||'—';
      const url=safeUrl(job[F.site]);
      const notes=job[F.notes]||'';
      const website=url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">打开部门网站</a>':'—';
      const checkText=result.checks.map(c=>c.label+': '+(c.result==='pass'?'已通过文字初筛':c.result==='fail'?'可能不符合': '需核对')).join('；');
      return '<tr><td><strong class="'+cls+'">'+esc(result.status)+'</strong>'+(checkText?'<div class="sub">'+esc(checkText)+'</div>':'')+'</td><td><b>'+esc(job[F.title])+'</b><div>'+esc(job[F.dept])+' · '+esc(job[F.office])+'</div><small>'+esc(job[F.intro])+'</small></td><td>'+esc(job[F.work])+'<div>落户：'+esc(job[F.hukou])+'</div></td><td>'+esc(job[F.sheet])+'<div>'+esc(job[F.agency])+'</div></td><td>'+esc(job[F.attr])+'<div>'+esc(job[F.dist])+'</div></td><td>'+esc(job[F.code])+'<div>'+esc(job[F.level])+'</div></td><td>'+esc(job[F.exam])+'<div>招 '+esc(job[F.count])+' 人</div></td><td>'+esc(job[F.major])+'</td><td>'+esc(job[F.edu])+'<div>'+esc(job[F.degree])+' · '+esc(job[F.politics])+'</div></td><td>'+esc(job[F.years])+'<div>'+esc(job[F.project])+'</div></td><td>'+esc(job[F.test])+'<div>'+esc(job[F.ratio])+'</div></td><td><details><summary>'+(notes?esc(notes.slice(0,70))+'…':'查看咨询信息')+'</summary><p>'+esc(notes||'无备注')+'</p><p>部门网站：'+website+'</p><p>咨询电话：'+contact+'</p></details></td></tr>';
    }).join('')||'<tr><td colspan="12" class="empty">没有符合当前筛选的职位。</td></tr>';
  }
  function csvEscape(value){return '"'+String(value??'').replace(/"/g,'""')+'"';}
  $('csExport').addEventListener('click',()=>{
    const header=data.columns.map(csvEscape).join(',');
    const lines=filtered.map(({job})=>data.columns.map(key=>csvEscape(job[key])).join(','));
    const blob=new Blob(['\ufeff'+[header,...lines].join('\r\n')],{type:'text/csv;charset=utf-8'});
    const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download='salary-map-civil-service-2026-filtered.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.querySelectorAll('#civil-service input,#civil-service select').forEach(el=>el.addEventListener('input',()=>{page=0;render();}));
  $('csPrev').addEventListener('click',()=>{page--;render();});$('csNext').addEventListener('click',()=>{page++;render();});
  $('csReset').addEventListener('click',()=>{document.querySelectorAll('#civil-service input').forEach(el=>{if(el.type==='checkbox')el.checked=false;else el.value='';});document.querySelectorAll('#civil-service select').forEach(el=>el.selectedIndex=0);page=0;render();});
  render();
})();
