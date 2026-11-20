(() => {
  const KEY = 'salary-map-career';
  const $ = (selector) => document.querySelector(selector);
  const number = (id) => {
    const value = $(`#${id}`).value.trim();
    return value === '' ? null : Number(value);
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = (value) => value == null || !Number.isFinite(value) ? '待补资料' : new Intl.NumberFormat('zh-CN', {maximumFractionDigits:0}).format(value);
  const inputs = ['careerCurrency','careerCurrentIncome','careerCurrentCost','careerInterimIncome','careerTargetCost','careerSavings','careerUpfront','careerMonthlyTraining','careerStudyHours','careerTransitionMonths','careerQualification','careerQualificationStatus','careerIncomeLow','careerIncomeBase','careerIncomeHigh'];
  const readState = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  let state = readState();
  inputs.forEach((id) => { if (state.inputs?.[id] != null) $(`#${id}`).value = state.inputs[id]; });

  function rowHtml(item, index, kind) {
    const risk = kind === 'risk';
    const fields = risk
      ? `<input data-field="name" aria-label="风险描述" placeholder="风险 / 不确定项" value="${escapeHtml(item.name)}"><label class="mini-field">影响度<select data-field="impact">${[1,2,3,4,5].map((n)=>`<option value="${n}" ${Number(item.impact)===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="mini-field">可能性<select data-field="likelihood">${[1,2,3,4,5].map((n)=>`<option value="${n}" ${Number(item.likelihood)===n?'selected':''}>${n}</option>`).join('')}</select></label><select data-field="evidence" aria-label="证据状态"><option value="unknown" ${item.evidence==='unknown'?'selected':''}>证据待补</option><option value="partial" ${item.evidence==='partial'?'selected':''}>部分证据</option><option value="strong" ${item.evidence==='strong'?'selected':''}>有来源证据</option></select>`
      : `<input data-field="name" aria-label="技能名称" placeholder="技能名称" value="${escapeHtml(item.name)}"><label class="mini-field">当前<select data-field="current">${[0,1,2,3,4,5].map((n)=>`<option value="${n}" ${Number(item.current)===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="mini-field">要求<select data-field="target">${[0,1,2,3,4,5].map((n)=>`<option value="${n}" ${Number(item.target)===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="mini-field">重要度<select data-field="weight">${[1,2,3,4,5].map((n)=>`<option value="${n}" ${Number(item.weight||3)===n?'selected':''}>${n}</option>`).join('')}</select></label><select data-field="evidence" aria-label="技能证据"><option value="unknown" ${item.evidence==='unknown'?'selected':''}>证据待补</option><option value="partial" ${item.evidence==='partial'?'selected':''}>部分证据</option><option value="strong" ${item.evidence==='strong'?'selected':''}>有来源证据</option></select>`;
    return `<div class="entry-row ${risk?'risk-row':''}" data-index="${index}">${fields}<button type="button" data-remove="${kind}" aria-label="删除此项">×</button></div>`;
  }

  function renderRows() {
    $('#skillRows').innerHTML = (state.skills || []).map((item,index)=>rowHtml(item,index,'skill')).join('');
    $('#riskRows').innerHTML = (state.risks || []).map((item,index)=>rowHtml(item,index,'risk')).join('');
  }

  function collectRows(selector) {
    return [...document.querySelectorAll(`${selector} .entry-row`)].map((row)=>{
      const value = (field) => row.querySelector(`[data-field="${field}"]`)?.value ?? '';
      return {name:value('name'),current:value('current'),target:value('target'),weight:value('weight'),impact:value('impact'),likelihood:value('likelihood'),evidence:value('evidence')};
    });
  }

  function persist() {
    state = {inputs:Object.fromEntries(inputs.map((id)=>[id,$(`#${id}`).value])),skills:collectRows('#skillRows'),risks:collectRows('#riskRows')};
    localStorage.setItem(KEY,JSON.stringify(state));
    calculate();
  }

  function riskClass(score) { return score<=5?'risk-low':score<=10?'risk-mid':score<=15?'risk-high':'risk-extreme'; }
  function calculate() {
    const currentIncome=number('careerCurrentIncome'),currentCost=number('careerCurrentCost'),interimIncome=number('careerInterimIncome'),targetCost=number('careerTargetCost'),savings=number('careerSavings'),upfront=number('careerUpfront'),training=number('careerMonthlyTraining'),expectedMonths=number('careerTransitionMonths'),study=number('careerStudyHours');
    const currentBalance=currentIncome==null||currentCost==null?null:currentIncome-currentCost;
    const scenarios=[['悲观',number('careerIncomeLow')],['基准',number('careerIncomeBase')],['乐观',number('careerIncomeHigh')]];
    const validSkills=(state.skills||[]).filter((s)=>s.name.trim()!==''&&s.current!==''&&s.target!==''&&s.weight!=='');
    const weightTotal=validSkills.reduce((sum,s)=>sum+Number(s.weight),0);
    const skillGap=weightTotal?100*validSkills.reduce((sum,s)=>sum+Number(s.weight)*Math.max(Number(s.target)-Number(s.current),0)/5,0)/weightTotal:null;
    const validRisks=(state.risks||[]).filter((r)=>r.name.trim()!==''&&r.impact!==''&&r.likelihood!=='').map((r)=>({...r,score:Number(r.impact)*Number(r.likelihood)})).sort((a,b)=>b.score-a.score);
    const evidenceCount=validSkills.filter((s)=>s.evidence==='strong').length;
    const currency=escapeHtml($('#careerCurrency').value.trim()||'所填币种');
    const scenarioCards=scenarios.map(([label,income])=>{
      const balance=income==null||targetCost==null?null:income-targetCost;
      const delta=balance==null||currentBalance==null?null:balance-currentBalance;
      const transitionCash=interimIncome==null||targetCost==null||training==null?null:interimIncome-targetCost-training;
      let runway='待补储备、支出或收入';
      if (transitionCash!=null&&transitionCash>=0) {
        runway=savings==null||upfront==null?'转型期间月现金流非负；前置投入 / 储备待补':savings<upfront?`转型期间月现金流非负，但前置资金还差 ${money(upfront-savings)} ${currency}`:'转型期间月现金流可覆盖，前置投入在现有储备内';
      }
      else if (transitionCash!=null&&savings!=null&&upfront!=null) {
        const available=savings-upfront;
        runway=available<0?`前置资金还差 ${money(-available)} ${currency}`:`约 ${(available/Math.max(-transitionCash,1e-9)).toFixed(1)} 个月`;
      }
      let payback='待补当前收入与支出';
      if (delta!=null&&upfront!=null) payback=delta>0?`${(upfront/delta).toFixed(1)} 个月`:'按当前假设无余额改善，无法估算回本期';
      const balanceText=balance==null?'待补目标收入或支出':`${money(balance)} ${currency} / 月`;
      const changeText=delta==null?'待补当前/目标收支':`${delta>=0?'+':''}${money(delta)} ${currency} / 月${currentBalance>0&&delta<0?`（结余下降 ${(100*(-delta)/currentBalance).toFixed(1)}%）`:''}`;
      const runwayIsShort=expectedMonths!=null&&transitionCash!=null&&transitionCash<0&&savings!=null&&upfront!=null&&(savings-upfront)/(-transitionCash)<expectedMonths;
      return `<article class="career-result"><span class="sub">${label} · 税后月收入 ${income==null?'待输入':money(income)+' '+currency}</span><strong>${balanceText}</strong><p>目标月结余 / 当前差额：${changeText}</p><p>准备期现金跑道：${runway}</p><p>一次性投入回本参考：${payback}</p>${runwayIsShort?'<p class="risk-high">短于你填写的转型周期</p>':''}</article>`;
    }).join('');
    const skillCard=`<article class="career-result"><span class="sub">加权技能缺口</span><strong>${skillGap==null?'待添加技能':skillGap.toFixed(0)+' / 100'}</strong><p>${validSkills.length} 项技能；${evidenceCount} 项已有来源证据</p><p>硬性资格：${$('#careerQualificationStatus').selectedOptions[0].textContent}${$('#careerQualification').value.trim()?` · ${escapeHtml($('#careerQualification').value.trim())}`:''}</p>${study!=null?`<p>每周可学习 ${money(study)} 小时</p>`:''}</article>`;
    const topRisk=validRisks[0];
    const riskCard=`<article class="career-result"><span class="sub">风险格（影响度 × 暴露可能性）</span><strong class="${topRisk?riskClass(topRisk.score):''}">${topRisk?`${topRisk.score} / 25`:'待添加风险'}</strong><p>${topRisk?`${escapeHtml(topRisk.name)} · ${topRisk.score<=5?'较低':topRisk.score<=10?'中等':topRisk.score<=15?'较高':'很高'}；证据：${({unknown:'待补',partial:'部分',strong:'有来源'})[topRisk.evidence]||'待补'}`:'不把分数解释为概率'}</p><p>记录 ${validRisks.length} 项；证据状态单独展示。</p></article>`;
    const notes=[];
    if ($('#careerQualificationStatus').value==='missing') notes.push('目标资格尚未满足：先核对培训周期、执照认可与合法从业要求，再决定投入。');
    if ($('#careerQualificationStatus').value==='unknown'&&$('#careerQualification').value.trim()) notes.push('先向目标地区主管机构核实资格 / 执照认可状态。');
    if (expectedMonths!=null&&interimIncome!=null&&targetCost!=null&&training!=null&&savings!=null&&upfront!=null) {
      const net=interimIncome-targetCost-training,available=savings-upfront;
      if (net<0&&available/(-net)<expectedMonths) notes.push('基准情景储备跑道短于你设定的转型 / 求职周期；可先减少前置投入、延长储蓄期或验证是否能保留收入。');
    }
    if (skillGap!=null&&skillGap>0) notes.push('按你填写的等级，优先安排权重高且缺口大的技能；先用作品、实操或雇主反馈验证学习方向。');
    if (!notes.length) notes.push('先补齐关键收支、技能与风险证据，再对照悲观情景是否满足你的最低生活和储备要求。');
    const noteCard=`<div class="career-result career-notes"><b>下一步核对</b><ul>${notes.map((item)=>`<li>${item}</li>`).join('')}<li>当前结余 ${currentBalance==null?'待补当前收入和支出':money(currentBalance)+' '+currency+' / 月'}；回本期使用“前置成本 ÷ 每月结余改善”，若改善不为正则不输出正数。</li></ul></div>`;
    $('#careerResults').innerHTML=scenarioCards+skillCard+riskCard+noteCard;
  }

  renderRows();
  inputs.forEach((id)=>$(`#${id}`).addEventListener('input',persist));
  inputs.forEach((id)=>$(`#${id}`).addEventListener('change',persist));
  $('#skillRows').addEventListener('input',persist); $('#skillRows').addEventListener('change',persist);
  $('#riskRows').addEventListener('input',persist); $('#riskRows').addEventListener('change',persist);
  $('#addSkill').addEventListener('click',()=>{state.skills=[...(state.skills||[]),{name:'',current:'0',target:'3',weight:'3',evidence:'unknown'}];renderRows();persist();$('#skillRows .entry-row:last-child [data-field="name"]').focus();});
  $('#addRisk').addEventListener('click',()=>{state.risks=[...(state.risks||[]),{name:'',impact:'3',likelihood:'3',evidence:'unknown'}];renderRows();persist();$('#riskRows .entry-row:last-child [data-field="name"]').focus();});
  document.addEventListener('click',(event)=>{const button=event.target.closest('[data-remove]');if(!button)return;const kind=button.dataset.remove,row=button.closest('.entry-row'),index=Number(row.dataset.index);if(kind==='skill')state.skills.splice(index,1);else state.risks.splice(index,1);renderRows();persist();});
  $('#careerReset').addEventListener('click',()=>{localStorage.removeItem(KEY);state={inputs:{},skills:[],risks:[]};inputs.forEach((id)=>$(`#${id}`).value='');renderRows();calculate();});
  calculate();
})();
