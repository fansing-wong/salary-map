(() => {
  const stages=[['explore','短期探路'],['short','短居 / 青年流动'],['work','合法工作'],['residency','长期居留 / 永居'],['citizenship','入籍']];
  const countries=[
    {name:'美国',routes:[
      ['explore','访问 / 商务探路','短期访问用于旅游、商务活动或面谈；需按具体身份条款确认允许活动。','https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html','国务院访客签证'],
      ['work','雇主聘用类临时工作','可从专业岗位、公司内部调派、杰出能力或获批交流项目等类别开始核对；类别条件差异很大。','https://www.uscis.gov/working-in-the-united-states/temporary-workers','USCIS 临时工作类别'],
      ['work','特殊条约 / 项目类别','TN、E-3、J-1 等只适用于特定国籍、职业、雇佣或项目条件；先核实自身适用范围。','https://travel.state.gov/content/travel/en/us-visas/employment/temporary-worker-visas.html','国务院临时工作签证'],
      ['residency','就业类或家庭类永久居民','职业移民类别包含不同雇主、资格或豁免条件；获临时工作身份不会自动取得永久居民身份。','https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-employment-based-immigrants','USCIS 就业类绿卡'],
      ['citizenship','永久居民后申请归化','核对居住、实际在境、品行、语言和公民知识等要求及个人例外。','https://www.uscis.gov/citizenship/learn-about-citizenship','USCIS 公民与归化']
    ]},
    {name:'加拿大',routes:[
      ['explore','访客短停 / 远程了解机会','访客签证或电子旅行许可不等于工作授权；不能据此假定可在当地受雇。','https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html','IRCC 访问加拿大'],
      ['short','International Experience Canada','青年流动类别依参与国籍、年龄、名额和具体项目；逐项核对当年规则。','https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec.html','IRCC IEC'],
      ['work','雇主特定 / 开放式工签、毕业后工签','工作授权与雇主、课程、家庭或其他条件相关；须核对许可条件和换雇主规则。','https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html','IRCC 工作许可'],
      ['residency','Express Entry、PNP 与家庭路线','Express Entry 管理多个技术移民项目，入池不保证获邀；省提名和家庭类别各有独立条件。','https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html','IRCC Express Entry'],
      ['citizenship','永久居民后申请公民身份','需核对实际居住、语言、报税、考试和其他条件；PR 与公民身份是不同阶段。','https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/adult-minor/who.html','IRCC 入籍资格']
    ]},
    {name:'澳大利亚',routes:[
      ['explore','访客短停 / 先行考察','访问签证条件因护照和目的而异；访客身份不自动授予工作权。','https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing','内政部签证目录'],
      ['short','Working Holiday 417 / Work and Holiday 462','青年流动类别按护照、年龄及其他条件区分；名额和资格须在申请前核对。','https://immi.homeaffairs.gov.au/what-we-do/whm-program/overview','内政部青年流动计划'],
      ['work','雇主担保、技术移民、毕业生路径','分别核对职业清单、担保资质、技能评估、语言和签证条件；临时毕业签不保证转永居。','https://immi.homeaffairs.gov.au/working-in-australia','内政部在澳工作'],
      ['residency','独立 / 州提名 / 雇主 / 区域永久签证','永久签证类别和条件不同；按每个子类别官方资格页逐项核对。','https://immi.homeaffairs.gov.au/visas/permanent-resident/visa-options','内政部永久居民签证选项'],
      ['citizenship','永久居民后申请公民身份','核对有效签证居住年限、永久居民时段、离境天数和品行等要求。','https://immi.homeaffairs.gov.au/citizenship/become-a-citizen/permanent-resident','内政部入籍']
    ]},
    {name:'英国',routes:[
      ['explore','Standard Visitor 短期访问','访客允许活动有边界；以官方访问签证规定判断，不把访客身份当作就业许可。','https://www.gov.uk/standard-visitor','GOV.UK 访客签证'],
      ['short','Youth Mobility / Graduate 等临时路径','适用对象各不相同，可能受国籍、年龄、毕业资格或名额限制；核对当期条件。','https://www.gov.uk/browse/visas-immigration/work-visas','GOV.UK 工作签证目录'],
      ['work','Skilled Worker、Global Talent、公司调派等','雇主担保、岗位、薪资、个人资历和签证类别条件不同；确认签证允许的工作范围。','https://www.gov.uk/browse/visas-immigration/work-visas','GOV.UK 工作签证'],
      ['residency','ILR / Settlement','永居资格取决于当前身份类别、居住时间、收入或其他规则；不同路径不可简单套用同一时间线。','https://www.gov.uk/indefinite-leave-to-remain-tier-2-t2-skilled-worker-visa/overview','GOV.UK Skilled Worker 永居'],
      ['citizenship','取得定居身份后评估入籍','核对居住年限、离境、语言、Life in the UK 与个人身份要求。','https://www.gov.uk/apply-citizenship-indefinite-leave-to-remain','GOV.UK 入籍申请']
    ]},
    {name:'新加坡',routes:[
      ['explore','短期访问 / 招聘与市场探路','先核对访问准证条款；短期访问不应理解为可受雇工作。','https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements','ICA 入境与签证要求'],
      ['work','Employment Pass / S Pass 等工作准证','准证类别与职位、薪资、雇主和申请人条件有关；开始工作前需持有效工作准证。','https://www.mom.gov.sg/passes-and-permits','MOM 工作准证'],
      ['work','ONE Pass、EntrePass、公司内部调派','人才、创业和企业内部调派类别有各自条件；使用 MOM 官方类别页核对。','https://www.mom.gov.sg/passes-and-permits','MOM 准证目录'],
      ['residency','申请永久居民 PR','ICA 列出不同申请类别并作个案评估；持工作准证不意味着自动获批 PR。','https://www.ica.gov.sg/information-and-e-services/citizenship-and-permanent-residence/permanent-residence/permanent-residence-application','ICA 永居申请'],
      ['citizenship','符合条件的 PR 申请公民身份','先核对申请类别、家庭义务及个人条件；申请与批准是不同事项。','https://www.ica.gov.sg/information-and-e-services/citizenship-and-permanent-residence/citizenship/singapore-citizenship-application','ICA 公民申请']
    ]},
    {name:'日本',routes:[
      ['explore','短期访问 / 访谈与考察','短期停留通常有活动限制；实际工作权须看在留资格，不由访客身份推定。','https://www.mofa.go.jp/j_info/visit/visa/index.html','外务省签证入口'],
      ['short','Working Holiday 青年假期','是否适用取决于与日本有安排的国籍 / 地区、年龄及申请规则；逐项核对。','https://www.mofa.go.jp/j_info/visit/w_holiday/index.html','外务省 Working Holiday'],
      ['short','J-Find 求职 / 创业准备','仅适用于满足指定海外院校等条件的人士；查看官方资格和在留活动范围。','https://www.moj.go.jp/isa/applications/status/designatedactivities51','出入国在留管理厅 J-Find'],
      ['work','工作类在留资格 / 公司内部调动 / 特定技能','按岗位职责、雇主、学历/经验或行业资格匹配在留资格；名称相似不代表工作范围相同。','https://www.moj.go.jp/isa/applications/status/index.html','出入国在留管理厅在留资格'],
      ['work','高度专业人才积分制 / J-Skip','使用官方高度人才说明核对活动类别、积分或特别资格；不要只凭薪资估算适用性。','https://www.moj.go.jp/isa/publications/materials/newimmiact_3.html','高度人才制度说明'],
      ['residency','申请永住许可','永住有独立审查条件；在留年限、身份类别、纳税及其他义务需核对现行指南。','https://www.moj.go.jp/isa/applications/procedures/16-4.html','永住许可指南'],
      ['citizenship','归化申请（与永住分开）','归化与永住是不同法律程序；同时核实现国籍放弃、保留或双重国籍影响。','https://www.moj.go.jp/EN/MINJI/minji78.html','法务省归化说明']
    ]},
    {name:'韩国',routes:[
      ['explore','短期访问 / 求职准备','访问、求职准备和受雇工作对应不同身份类别；以签证条件确认可做活动。','https://www.visa.go.kr/','韩国签证门户'],
      ['short','H-1 工作假期 / 青年流动','适用国籍、年龄、期间和工作范围依双边安排；核实本国是否参与及当前条款。','https://www.immigration.go.kr/immigration_eng/index.do','韩国出入境官方门户'],
      ['work','E-7 专业岗位 / D-7 公司派遣','岗位类别、雇主、申请人资格及工作场所会影响许可；转岗或换雇主需查规则。','https://www.immigration.go.kr/sites/immigration/file/e7guide.html','E-7 官方指南'],
      ['residency','F-2 居留 / F-5 永居类别','不同在留类别的转换条件、积分、年限和社会融入要求不同；逐类别核验。','https://www.immigration.go.kr/bbs/immigration_eng/230/454085/download.do','出入境厅长期居留指南'],
      ['citizenship','一般 / 简易 / 特别归化','归化条件按申请类别区分；请向韩国法务部或 Hi Korea 核实最新要求。','https://www.immigration.go.kr/immigration_eng/index.do','韩国出入境官方门户']
    ]},
    {name:'加拿大',routes:[
      ['explore','访客短停 / 市场了解','访客签证或电子旅行许可不等于工作授权；先看允许活动和停留条件。','https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html','IRCC 访问加拿大'],
      ['short','International Experience Canada','青年流动类别依参与国籍、年龄、名额和项目资格；按当年参与情况核对。','https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec.html','IRCC IEC'],
      ['work','雇主特定 / 开放式工签 / 毕业后工签','工作许可可能绑定雇主或受课程、家庭等条件限制；逐项确认许可条款。','https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html','IRCC 工作许可'],
      ['residency','Express Entry 技术移民','管理 CEC、FSW、FST 等项目；建档或进入候选池不保证获邀。','https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html','IRCC Express Entry'],
      ['residency','省提名 / 区域 / 家庭团聚','省提名及区域项目有不同职业、地区或雇主条件；家庭路线按关系类别评估。','https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada.html','IRCC 永久移民项目'],
      ['citizenship','永久居民后申请公民身份','核对实际居住、语言、报税、考试和其他条件；PR 不自动转为公民身份。','https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/adult-minor/who.html','IRCC 入籍资格']
    ]},
    {name:'中国',routes:[
      ['explore','访问签证 / 短期入境','签证和免签政策按护照国籍、目的和当前安排核实；短期访问不等同工作授权。','https://en.nia.gov.cn/n147418/n147458/c155980/content.html','国家移民管理局外国人入境规定'],
      ['work','工作许可 + 工作类居留证件','按工作许可、雇主和工作类居留手续逐步办理；合法工作以取得相应许可为前提。','https://en.nia.gov.cn/n147418/n147458/c155980/content.html','国家移民管理局法规'],
      ['residency','外国人永久居留申请','官方列有特定资格类别，适用条件较为具体；不是普通工作签证的自动结果。','https://en.nia.gov.cn/n147423/n147478/n147715/c158291/content.html','国家移民管理局永居指南'],
      ['citizenship','外国人申请加入中国国籍','该路径需单独核实法律条件和审批流程，并评估放弃现有国籍的影响。','https://en.nia.gov.cn/n147423/n147478/n147720/c158308/content.html','国家移民管理局入籍申请说明']
    ]}
  ];
  const countrySelect=document.querySelector('#mobilityCountry'),stageSelect=document.querySelector('#mobilityStage'),cards=document.querySelector('#mobilityCards'),timeline=document.querySelector('#mobilityTimeline');
  countrySelect.innerHTML=countries.map((c)=>`<option value="${c.name}">${c.name}</option>`).join('');
  function render(){
    const country=countries.find((c)=>c.name===countrySelect.value)||countries[0],stage=stageSelect.value;
    timeline.innerHTML=stages.map(([key,label])=>`<button type="button" class="mobility-stage ${stage===key?'active':''}" data-stage="${key}">${label}<small>${country.routes.filter((r)=>r[0]===key).length} 条入口</small></button>`).join('');
    const list=country.routes.filter((route)=>stage==='all'||route[0]===stage);
    document.querySelector('#mobilityScope').textContent=`${country.name} · ${stage==='all'?'全阶段':stages.find((x)=>x[0]===stage)?.[1]} · ${list.length} 条官方路线入口`;
    cards.innerHTML=list.length?list.map((route)=>`<article class="mobility-card"><div class="eyebrow">${stages.find((x)=>x[0]===route[0])?.[1]}</div><h3>${route[1]}</h3><p>${route[2]}</p><a href="${route[3]}" target="_blank" rel="noreferrer">${route[4]} ↗</a></article>`).join(''):'<p class="empty">该筛选下暂无路线入口，请查看完整路线说明或选择其他阶段。</p>';
  }
  countrySelect.addEventListener('change',render);stageSelect.addEventListener('change',render);
  timeline.addEventListener('click',(event)=>{const button=event.target.closest('[data-stage]');if(!button)return;stageSelect.value=button.dataset.stage;render();});
  render();
})();
