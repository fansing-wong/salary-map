(()=>{
 const $=selector=>document.querySelector(selector);
 const view=$("#chinaView"),population=$("#chinaPopulation"),focus=$("#chinaFocus");
 const populationWrap=$("#chinaPopulationWrap"),focusWrap=$("#chinaFocusWrap");
 const fmt=n=>new Intl.NumberFormat("zh-CN",{maximumFractionDigits:0}).format(n);
 const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const sourceLink=(url,note="")=>url?'<a href="'+escapeHtml(url)+'" title="'+escapeHtml(note)+'" target="_blank" rel="noreferrer">'+(/转载|待补官方原文|待补原始链接/.test(note)?"来源（转载/待核） ↗":"查看来源 ↗")+'</a>':"—";
 let pack=null,eastPack=null;

 function setOptions(select,values,preferred){
  const previous=select.value;
  select.innerHTML=values.map(value=>'<option value="'+escapeHtml(value)+'">'+escapeHtml(value)+'</option>').join("");
  select.value=values.includes(previous)?previous:(values.includes(preferred)?preferred:values[0]||"");
 }
 function unique(values){return [...new Set(values.filter(Boolean))]}
 function growth(value){return value==null?"—":(value>0?"+":"")+value+"%"}
 function annual(value){return value==null?"—":fmt(value)}
 function commonRows(rows,label){
  return rows.map(row=>({
   label:label(row),chartLabel:label(row),chartValue:row.salary_annual_2025,
   cells:[label(row),annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),annual(row.salary_annual_2024),growth(row.nominal_growth_pct),sourceLink(row.source_url||pack.source_url)]
  }));
 }
 function getContext(){
  const key=view.value;
  let rows=[],headers=[],note="",group="";
  let sourceUrl=pack.source_url,chartSuffix="元 / 年",summaryLabel="年工资";

  const positionView=key.startsWith("positions-");
  const focusView=key==="positions-region"||key==="positions-industry"||key==="shenzhen-occupations";
  populationWrap.hidden=positionView||key==="chongqing-positions";
  focusWrap.hidden=!(focusView||key==="city-wages"||key==="east-industry"||key==="focus-cities");

  if(key==="regions"||key==="industries"){
   const choices=key==="industries"?["城镇非私营单位","城镇私营单位"]:["城镇非私营单位","城镇私营单位","规模以上企业"];
   setOptions(population,choices,"城镇非私营单位");
   group=population.value;
   const table=key==="regions"?pack.regional_averages:pack.industry_averages;
   const label=key==="regions"?"地区":"行业";
   rows=commonRows(table.filter(row=>row.population===group).map(row=>({...row,source_url:pack.source_url})),row=>row.region||row.industry);
   headers=[label,"2025 年均工资（元 / 年）","月等值（元）","2024 年工资（元 / 年）","名义同比","原始来源"];
   note=key==="regions"?group+" · 全国及东、中、西、东北宏观区域。宏观区域不能推算为省市。":group+" · 全国行业门类均值，不代表行业里的具体岗位。";
   sourceUrl=pack.source_url;
  }else if(key==="positions-region"||key==="positions-industry"){
   setOptions(population,[], "");
   group="规模以上企业";
   const isRegion=key==="positions-region";
   const table=isRegion?pack.above_scale_positions_by_region:pack.above_scale_positions_by_industry;
   const items=isRegion?unique(table.map(row=>row.region)):unique(table.map(row=>row.industry));
   setOptions(focus,items,isRegion?"东部地区":"信息传输、软件和信息技术服务业");
   const selected=focus.value;
   const filtered=table.filter(row=>(isRegion?row.region:row.industry)===selected);
   rows=filtered.map(row=>({label:row.occupation,chartLabel:row.occupation,chartValue:row.salary_annual_2025,cells:[row.occupation,annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),"—","—",sourceLink(pack.source_url)]}));
   headers=["岗位大类（规模以上企业）","2025 年均工资（元 / 年）","月等值（元）","2024 年工资（元 / 年）","名义同比","原始来源"];
   note=isRegion?selected+" · 国家统计局宽职业分类；调查总体为规模以上企业。":selected+" · 规模以上企业行业内宽职业分类，不等于具体职位价位。";
   sourceUrl=pack.source_url;
  }else if(key==="east-region-summary"){
   const choices=unique((eastPack.headline_wages||[]).map(row=>row.population));
   setOptions(population,choices,"城镇非私营单位");
   group=population.value;
   const filtered=(eastPack.headline_wages||[]).filter(row=>row.population===group);
   rows=filtered.map(row=>{
    const residents=(eastPack.resident_benchmarks||[]).find(item=>item.location===row.location&&item.sample==="城镇居民");
    return {label:row.location,chartLabel:row.location,chartValue:row.salary_annual_2025,
     cells:[row.location,"省级地区",annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),residents?annual(residents.per_capita_disposable_income_annual):"—",residents?annual(residents.per_capita_consumption_annual):"—",growth(row.nominal_growth_pct),sourceLink(row.source_url)+(residents?" · "+sourceLink(residents.source_url):"")]};
   });
   headers=["省级地区","统计期工资总体","2025 年工资（元 / 年）","月等值（元）","城镇居民人均可支配收入 / 年（元）","城镇居民人均消费支出 / 年（元）","单位工资名义同比","工资 / 居民数据来源"];
   note=group==="全口径城镇单位（社保缴费基数口径）"?"上海单项指标：2025 年月均全口径工资按 12 个月折算成年等值；用途和统计总体不同，不与其他五省市作同口径排名。居民收支另为住户调查人均背景。":"仅比较同一统计总体下的五个省级地区均值；上海缺少相同统计总体的 2025 年工资表。居民收支是城镇常住居民的人均收入与消费背景，不能当成个人薪资或生活预算。";
   sourceUrl=filtered[0]?.source_url||pack.source_url;
  }else if(key==="city-wages"){
   const baseRows=pack.city_averages||[];
   const extraRows=(eastPack.headline_wages||[]).filter(row=>!baseRows.some(item=>item.location===row.location&&item.population===row.population));
   const cityRows=[...baseRows,...extraRows,
    ...(eastPack.jiangsu_focus_city_wages||[]).map(row=>({...row,geo_level:"city"})),
    ...(eastPack.anhui_city_wages||[]).map(row=>({...row,geo_level:"city",admin1:"安徽省",population:"城镇非私营单位",source_url:"https://tjj.huainan.gov.cn/public/118319859/1261028126.html",source_note:"安徽省统计局公布的2025年各地级市城镇非私营单位工资均值；不是具体岗位工资。"})),
    ...(eastPack.guangdong_subregions||[]).map(row=>({...row,geo_level:"macroregion",admin1:"广东省",population:row.salary_population,source_url:"https://stats.gd.gov.cn/tjkx185/content/post_4917310.html",source_note:"广东省统计局四大区域工资均值；每个片区包含多个城市。"}))];
   const choices=unique(cityRows.map(row=>row.population));
   setOptions(population,choices,"城镇非私营单位");
   group=population.value;
   const levelNames={admin1:"省级地区",city:"地级市 / 直辖市",macroregion:"省内宏观片区"};
   const levels=["全部层级",...unique(cityRows.filter(row=>row.population===group).map(row=>levelNames[row.geo_level]||"省级地区"))];
   setOptions(focus,levels,"全部层级");
   const filtered=cityRows.filter(row=>row.population===group&&(focus.value==="全部层级"||(levelNames[row.geo_level]||"省级地区")===focus.value));
   rows=filtered.map(row=>{
    const national=pack.regional_averages.find(item=>item.population===group&&item.region==="全国")?.salary_annual_2025;
    const difference=national?((row.salary_annual_2025/national-1)*100):null;
    return {label:row.location,chartLabel:row.location,chartValue:row.salary_annual_2025,
     cells:[row.location,levelNames[row.geo_level]||"省级地区",row.population,annual(row.salary_annual_2025),annual(row.salary_annual_2024),growth(row.nominal_growth_pct),annual(national),difference==null?"—":(difference>0?"+":"")+difference.toFixed(1)+"%",sourceLink(row.source_url)]};
   });
   headers=["地区","地理层级","统计总体","2025 年均工资（元 / 年）","2024 年均工资（元 / 年）","名义同比","全国同总体均值（元 / 年）","与全国差异","原始来源"];
   note=group==="全口径城镇单位（社保缴费基数口径）"?"北京与上海全口径指标按社保缴费基数用途计算，定义不同于城镇非私营/私营单位平均工资；单独查看。":focus.value==="全部层级"?group+" · 省级地区、地级市和省内片区混合展示，请使用地理层级筛选进行同级比较；省级与下辖城市不能作为独立区域排名。":"仅展示"+group+"的"+focus.value+"数据。安徽有完整地级市非私营均值，广东有四大宏观片区，其他城市覆盖仍不完整。";
   sourceUrl=filtered[0]?.source_url||pack.source_url;
  }else if(key==="focus-cities"){
   const anhuiFocus=["合肥市","蚌埠市","芜湖市","马鞍山市","滁州市","安庆市"];
   const jiangsuWages=eastPack.jiangsu_focus_city_wages||[];
   const anhuiWages=(eastPack.anhui_city_wages||[]).filter(row=>anhuiFocus.includes(row.location)).map(row=>({...row,admin1:"安徽省",geo_level:"city",population:"城镇非私营单位",source_url:"https://tjj.huainan.gov.cn/public/118319859/1261028126.html",source_name:"安徽省统计局2025年分地级市平均工资表",source_note:"城镇非私营单位税前人均均值；不代表具体岗位。"}));
   const cityRows=[...jiangsuWages,...anhuiWages];
   setOptions(population,unique(cityRows.map(row=>row.population)),"城镇非私营单位");
   group=population.value;
   setOptions(focus,["全部重点城市","安徽省","江苏省"],"全部重点城市");
   const selected=focus.value;
   const residents=eastPack.focus_city_residents||[];
   const filtered=cityRows.filter(row=>row.population===group&&(selected==="全部重点城市"||row.admin1===selected));
   rows=filtered.map(row=>{
    const resident=residents.find(item=>item.location===row.location);
    const balance=resident?.urban_disposable_income_2025!=null&&resident?.urban_consumption_2025!=null?resident.urban_disposable_income_2025-resident.urban_consumption_2025:null;
    return {label:row.location,chartLabel:row.location,chartValue:row.salary_annual_2025,
     cells:[row.location,row.admin1,row.population,annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),resident?annual(resident.urban_disposable_income_2025):"—",resident?.urban_consumption_2025!=null?annual(resident.urban_consumption_2025):"—",balance==null?"—":annual(balance),sourceLink(row.source_url,row.source_note)+(resident?" · "+sourceLink(resident.source_url,resident.source_note):"") ]};
   });
   headers=["重点城市","省份","统计总体","2025 年税前年均工资（元）","月等值（元）","城镇居民人均可支配收入 / 年（元）","城镇居民人均消费支出 / 年（元）","居民人均收支差额（元 / 年）","工资 / 居民数据来源"];
   note=group+" · 安徽合肥、蚌埠、芜湖、马鞍山、滁州、安庆；江苏南京、苏州、无锡、常州、镇江。居民收支差额=人均可支配收入−人均消费支出，只表示住户调查的平均差额，不是个人储蓄或生活成本；蚌埠、马鞍山暂无已核验的2025整年城镇居民收支值。工资是单位税前均值，不是具体岗位报价；不含实际工时，不能据此计算实际时薪。"+(group==="城镇私营单位"?"安徽地级市私营单位工资及镇江私营单位工资尚无已核验记录。":"镇江工资目前链接到注明来源的转载，待补统计局原文；安徽城市工资仅有非私营总体。");
   sourceUrl=filtered[0]?.source_url||pack.source_url;
  }else if(key==="east-industry"){
   const localTables=[...(pack.local_industry_averages||[])];
   const regionalTables=eastPack.industry_tables||[];
   const regionalRows=regionalTables.flatMap(table=>Object.entries(table.values||{}).flatMap(([industry,groups])=>Object.entries(groups||{}).filter(([,value])=>value!=null).map(([population,value])=>({location:table.location,industry,population,salary_annual_2025:value,source_url:table.source_url,source_name:table.source_name}))));
   const allRows=[...localTables,...regionalRows];
   setOptions(population,unique(allRows.map(row=>row.population)),"城镇非私营单位");
   group=population.value;
   setOptions(focus,unique(allRows.map(row=>row.industry)),"信息传输、软件和信息技术服务业");
   const industry=focus.value;
   const filtered=allRows.filter(row=>row.population===group&&row.industry===industry);
   rows=filtered.map(row=>{
    const localTotal=(eastPack.headline_wages||[]).find(item=>item.location===row.location&&item.population===group)?.salary_annual_2025;
    const national=pack.industry_averages.find(item=>item.industry===row.industry&&item.population===group)?.salary_annual_2025;
    const localPremium=localTotal?((row.salary_annual_2025/localTotal-1)*100):null;
    return {label:row.location,chartLabel:row.location,chartValue:row.salary_annual_2025,
     cells:[row.location,row.industry,annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),annual(localTotal),localPremium==null?"—":(localPremium>0?"+":"")+localPremium.toFixed(1)+"%",annual(national),sourceLink(row.source_url)]};
   });
   headers=["地区","行业门类","2025 行业均值（元 / 年）","月等值（元）","当地全行业均值（元 / 年）","相对当地全行业","全国同业均值（元 / 年）","来源"];
   note=group+" · "+industry+"。按2025年官方行业门类平均工资比较；不等于具体岗位工资，上海目前没有可直接对齐的同口径2025行业表，安徽暂未取得私营行业明细。";
   sourceUrl=filtered[0]?.source_url||pack.source_url;
  }else if(key==="jiangsu-industries"){
   const choices=unique((pack.local_industry_averages||[]).map(row=>row.population));
   setOptions(population,choices,"城镇非私营单位");
   group=population.value;
   const filtered=(pack.local_industry_averages||[]).filter(row=>row.population===group);
   rows=filtered.map(row=>{
    const national=pack.industry_averages.find(item=>item.industry===row.industry&&item.population===group)?.salary_annual_2025;
    const difference=national?((row.salary_annual_2025/national-1)*100):null;
    return {label:row.industry,chartLabel:row.industry,chartValue:row.salary_annual_2025,cells:[row.location,row.industry,annual(row.salary_annual_2025),annual(national),difference==null?"—":(difference>0?"+":"")+difference.toFixed(1)+"%",annual(Math.round(row.salary_annual_2025/12)),sourceLink(row.source_url)]};
   });
   headers=["省级总体","行业","2025 江苏均值（元 / 年）","2025 全国同业均值（元 / 年）","江苏与全国差异","江苏月等值（元）","原始来源"];
   note=group+" · 江苏省行业均值；是全省行业比较，不可解释为南京、苏州等城市工资或具体岗位价位。";
   sourceUrl=filtered[0]?.source_url||pack.source_url;
  }else if(key==="shenzhen-occupations"){
   setOptions(population,[], "");
   const table=pack.shenzhen_occupation_wages||[];
   const categories=["全部职业",...unique(table.map(row=>row.category))];
   setOptions(focus,categories,"全部职业");
   const selected=focus.value;
   const filtered=table.filter(row=>selected==="全部职业"||row.category===selected);
   rows=filtered.map(row=>({label:row.occupation,chartLabel:row.occupation,chartValue:row.p50_annual,cells:[row.occupation,annual(row.p50_annual),annual(row.p10_annual),annual(row.p25_annual),annual(row.p50_annual),annual(row.p75_annual),annual(row.p90_annual),sourceLink(row.source_url)]}));
   headers=["职业","P50 中位数（元 / 年）","P10 低位（元 / 年）","P25 下四分位（元 / 年）","P50 中位数（元 / 年）","P75 上四分位（元 / 年）","P90 高位（元 / 年）","原始来源"];
   note=selected+" · 深圳企业薪酬调查，调查期 2024 年、2026 年发布；图表按 P50 中位数排序，数值不是月薪。";
   sourceUrl=filtered[0]?.source_url||(pack.sources?.find(source=>source.name.includes("深圳"))||{}).url||pack.source_url;
   chartSuffix="P50 元 / 年";summaryLabel="深圳岗位 P50";
  }else if(key==="chongqing-positions"){
   setOptions(population,[], "");
   group="规模以上企业";
   const filtered=pack.city_above_scale_positions||[];
   rows=filtered.map(row=>({label:row.occupation,chartLabel:row.occupation,chartValue:row.salary_annual_2025,cells:[row.location,row.occupation,annual(row.salary_annual_2025),annual(Math.round(row.salary_annual_2025/12)),"—","—",sourceLink(row.source_url)]}));
   headers=["城市","岗位大类","2025 年均工资（元 / 年）","月等值（元）","2024 年工资（元 / 年）","名义同比","原始来源"];
   note="重庆市规模以上企业岗位大类均值；与全国规模以上企业岗位组相比只作口径相近的参照，非一对一职业统计。";
   sourceUrl=(filtered[0]||{}).source_url||pack.source_url;
  }else if(key==="residents"){
   const choices=["城镇居民","全体居民"];
   setOptions(population,choices,"城镇居民");
   group=population.value;
   const sample=group==="全体居民"?"全体居民":"城镇居民";
   const residentRows=[...(pack.resident_benchmarks||[]),...(eastPack.resident_benchmarks||[]).filter(row=>!(pack.resident_benchmarks||[]).some(item=>item.location===row.location&&item.sample===row.sample))];
   const filtered=residentRows.filter(row=>row.sample===sample);
   rows=filtered.map(row=>({label:row.location,chartLabel:row.location,chartValue:row.per_capita_consumption_annual,cells:[row.location,row.sample,annual(row.per_capita_disposable_income_annual),annual(row.per_capita_consumption_annual),annual(Math.round(row.per_capita_disposable_income_annual/12)),annual(Math.round(row.per_capita_consumption_annual/12)),sourceLink(row.source_url)]}));
   headers=["地域","居民样本","人均可支配收入 / 年（元）","人均消费支出 / 年（元）","收入月等值（元）","消费月等值（元）","原始来源"];
   note=sample+" · 图表展示人均消费支出年额。此项是居民调查背景，不是个人预算或城市租房成本。";
   sourceUrl=(filtered.find(row=>row.location==="全国")||{}).source_url||pack.source_url;
   chartSuffix="人均消费 元 / 年";summaryLabel="人均消费";
  }

  rows.sort((a,b)=>(b.chartValue||0)-(a.chartValue||0));
  return {key,group,rows,headers,note,sourceUrl,chartSuffix,summaryLabel};
 }

 function render(){
  if(!pack)return;
  const context=getContext();
  const {key,rows,headers,note,sourceUrl,chartSuffix,summaryLabel,group}=context;
  $("#chinaViewNote").textContent=note;
  const sourceAnchor=$("#chinaSourceLink");
  sourceAnchor.href=sourceUrl||pack.source_url;
  sourceAnchor.textContent=key==="shenzhen-occupations"?"深圳人社局工资价位调查 ↗":key==="residents"?"居民收支原始统计 ↗":key==="city-wages"||key==="focus-cities"||key==="east-region-summary"||key==="east-industry"||key==="jiangsu-industries"||key==="chongqing-positions"?"地方官方数据来源 ↗":"国家统计局原始发布 ↗";

  const highest=rows[0],lowest=rows.length?rows[rows.length-1]:null;
  const ratio=rows.length>1&&highest&&lowest&&lowest.chartValue>0?highest.chartValue/lowest.chartValue:null;
  let baseline=null,baselineLabel="当前参照";
  if(key==="regions"||key==="industries"||key==="positions-region"||key==="positions-industry"||key==="city-wages"||key==="focus-cities"||key==="east-region-summary"){
   baseline=pack.regional_averages.find(row=>row.population===group&&row.region==="全国")?.salary_annual_2025;
   baselineLabel="全国同总体均值";
   if(group==="全口径城镇单位（社保缴费基数口径）")baselineLabel="该地独立统计口径";
  }else if(key==="residents"){
   const sample=group==="全体居民"?"全体居民":"城镇居民";
   baseline=(pack.resident_benchmarks||[]).find(row=>row.location==="全国"&&row.sample===sample)?.per_capita_consumption_annual;
   baselineLabel="全国人均消费";
  }else if(key==="shenzhen-occupations"){
   baselineLabel="调查参考期";
  }else if(key==="jiangsu-industries"){
   baselineLabel="参考期";
  }else if(key==="east-industry"){
   baseline=pack.industry_averages.find(row=>row.industry===(focus.value||"")&&row.population===group)?.salary_annual_2025;
   baselineLabel="全国同业均值";
  }else if(key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"){
   baselineLabel="北京统计口径";
  }
  const firstValue=key==="shenzhen-occupations"?"2024 年调查":key==="jiangsu-industries"||key==="east-region-summary"||key==="east-industry"||key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"?"2025 年":baseline!=null?fmt(baseline)+" 元 / 年":highest?fmt(highest.chartValue)+" 元 / 年":"—";
  const firstSub=key==="shenzhen-occupations"?"2026 年发布":key==="jiangsu-industries"?"同业全国参照显示在表格中":key==="east-industry"?"全国同业参照显示在表格中":key==="east-region-summary"?"工资总体筛选后提供同口径全国参照":key==="focus-cities"?"国家统计局公布的同统计总体均值":key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"?"社保缴费基数统计口径":baseline!=null?"同统计总体的公开参照":note;
  const highValue=highest?fmt(highest.chartValue)+" 元 / 年":"—";
  const highSub=highest?highest.label:"无可用记录";
  const rangeLabel=key==="residents"?"消费背景范围":key==="shenzhen-occupations"?"岗位中位数差异":key==="east-industry"?"同业区域最高 / 最低":key==="east-region-summary"?"同口径区域最高 / 最低":"最高 / 最低";
  const mixedCityScopes=key==="city-wages"&&focus.value==="全部层级";
  const rangeValue=ratio&&!mixedCityScopes?ratio.toFixed(2)+" 倍":mixedCityScopes?"按层级筛选":"—";
  const rangeSub=lowest?"低端："+lowest.label:"无可用记录";
  $("#chinaStats").innerHTML=[
   [baselineLabel,firstValue,firstSub],
   [summaryLabel+"较高值",highValue,highSub],
   [rangeLabel,rangeValue,mixedCityScopes?"请先筛选同一地理层级":rangeSub]
  ].map(item=>'<div class="china-stat"><span>'+escapeHtml(item[0])+'</span><strong>'+escapeHtml(item[1])+'</strong><small>'+escapeHtml(item[2])+'</small></div>').join("");

 const chartRows=key==="industries"||key==="jiangsu-industries"?rows.slice(0,12):rows;
  const max=Math.max(...chartRows.map(row=>row.chartValue||0),1);
  $("#chinaChart").innerHTML=chartRows.map(row=>'<div class="china-bar-row"><span class="china-bar-label" title="'+escapeHtml(row.chartLabel)+'">'+escapeHtml(row.chartLabel)+'</span><span class="china-bar-track"><span class="china-bar" style="display:block;width:'+Math.max(1,(row.chartValue||0)/max*100)+'%"></span></span><span class="china-bar-value">'+fmt(row.chartValue)+' '+escapeHtml(chartSuffix)+'</span></div>').join("");
  $("#chinaHead").innerHTML="<tr>"+headers.map(header=>"<th>"+escapeHtml(header)+"</th>").join("")+"</tr>";
  $("#chinaRows").innerHTML=rows.length?rows.map(row=>"<tr>"+row.cells.map((cell,index)=>"<td class='"+(index===0?"china-first-col":"")+"'>"+(index===row.cells.length-1?cell:escapeHtml(cell))+"</td>").join("")+"</tr>").join(""):'<tr><td colspan="'+(headers.length||8)+'" class="china-empty">该筛选没有可用记录。</td></tr>';
 }
 view.addEventListener("change",render);
 population.addEventListener("change",render);
 focus.addEventListener("change",render);
 Promise.all(["data/china_wage_structure_2025.json","data/china_east_regions_2025.json"].map(url=>fetch(url).then(response=>{if(!response.ok)throw new Error(url+" HTTP "+response.status);return response.json()}))).then(([data,eastData])=>{pack=data;eastPack=eastData;render()}).catch(error=>{
  $("#chinaRows").innerHTML='<tr><td colspan="8" class="china-empty">中国官方数据文件载入失败，请稍后重试。</td></tr>';
  $("#chinaViewNote").textContent="数据文件：data/china_wage_structure_2025.json、data/china_east_regions_2025.json";
  console.warn("China wage data unavailable",error);
 });
})();
