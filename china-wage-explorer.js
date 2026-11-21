(()=>{
 const $=selector=>document.querySelector(selector);
 const view=$("#chinaView"),population=$("#chinaPopulation"),focus=$("#chinaFocus");
 const populationWrap=$("#chinaPopulationWrap"),focusWrap=$("#chinaFocusWrap");
 const fmt=n=>new Intl.NumberFormat("zh-CN",{maximumFractionDigits:0}).format(n);
 const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const sourceLink=url=>url?'<a href="'+escapeHtml(url)+'" target="_blank" rel="noreferrer">查看来源 ↗</a>':"—";
 let pack=null;

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
  focusWrap.hidden=!focusView;

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
  }else if(key==="city-wages"){
   const choices=unique((pack.city_averages||[]).map(row=>row.population));
   setOptions(population,choices,"城镇非私营单位");
   group=population.value;
   const filtered=(pack.city_averages||[]).filter(row=>row.population===group);
   rows=filtered.map(row=>{
    const national=pack.regional_averages.find(item=>item.population===group&&item.region==="全国")?.salary_annual_2025;
    const difference=national?((row.salary_annual_2025/national-1)*100):null;
    return {label:row.location,chartLabel:row.location,chartValue:row.salary_annual_2025,
     cells:[row.location,row.population,annual(row.salary_annual_2025),annual(row.salary_annual_2024),growth(row.nominal_growth_pct),annual(national),difference==null?"—":(difference>0?"+":"")+difference.toFixed(1)+"%",sourceLink(row.source_url)]};
   });
   headers=["省 / 市","统计总体","2025 本地均值（元 / 年）","2024 本地均值（元 / 年）","本地名义同比","全国同总体均值（元 / 年）","与全国差异","原始来源"];
   note=group==="全口径城镇单位（社保缴费基数口径）"?"北京全口径工资用于社保缴费基数核定，定义与其他城市的直接工资调查不同；单独查看，不作城市排名。":group+" · 目前覆盖全国、江苏、重庆、广州、深圳等官方已发布数据；不是完整省市名录。";
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
   const filtered=(pack.resident_benchmarks||[]).filter(row=>row.sample===sample);
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
  sourceAnchor.textContent=key==="shenzhen-occupations"?"深圳人社局工资价位调查 ↗":key==="residents"?"居民收支原始统计 ↗":key==="city-wages"||key==="jiangsu-industries"||key==="chongqing-positions"?"地方官方数据来源 ↗":"国家统计局原始发布 ↗";

  const highest=rows[0],lowest=rows.length?rows[rows.length-1]:null;
  const ratio=rows.length>1&&highest&&lowest&&lowest.chartValue>0?highest.chartValue/lowest.chartValue:null;
  let baseline=null,baselineLabel="当前参照";
  if(key==="regions"||key==="industries"||key==="positions-region"||key==="positions-industry"||key==="city-wages"){
   baseline=pack.regional_averages.find(row=>row.population===group&&row.region==="全国")?.salary_annual_2025;
   baselineLabel="全国同总体均值";
  }else if(key==="residents"){
   const sample=group==="全体居民"?"全体居民":"城镇居民";
   baseline=(pack.resident_benchmarks||[]).find(row=>row.location==="全国"&&row.sample===sample)?.per_capita_consumption_annual;
   baselineLabel="全国人均消费";
  }else if(key==="shenzhen-occupations"){
   baselineLabel="调查参考期";
  }else if(key==="jiangsu-industries"){
   baselineLabel="参考期";
  }else if(key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"){
   baselineLabel="北京统计口径";
  }
  const firstValue=key==="shenzhen-occupations"?"2024 年调查":key==="jiangsu-industries"||key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"?"2025 年":baseline!=null?fmt(baseline)+" 元 / 年":highest?fmt(highest.chartValue)+" 元 / 年":"—";
  const firstSub=key==="shenzhen-occupations"?"2026 年发布":key==="jiangsu-industries"?"同业全国参照显示在表格中":key==="city-wages"&&group==="全口径城镇单位（社保缴费基数口径）"?"社保缴费基数加权口径":baseline!=null?"同统计总体的公开参照":note;
  const highValue=highest?fmt(highest.chartValue)+" 元 / 年":"—";
  const highSub=highest?highest.label:"无可用记录";
  const rangeLabel=key==="residents"?"消费背景范围":key==="shenzhen-occupations"?"岗位中位数差异":"最高 / 最低";
  const rangeValue=ratio?ratio.toFixed(2)+" 倍":"—";
  const rangeSub=lowest?"低端："+lowest.label:"无可用记录";
  $("#chinaStats").innerHTML=[
   [baselineLabel,firstValue,firstSub],
   [summaryLabel+"较高值",highValue,highSub],
   [rangeLabel,rangeValue,rangeSub]
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
 fetch("data/china_wage_structure_2025.json").then(response=>{if(!response.ok)throw new Error("HTTP "+response.status);return response.json()}).then(data=>{pack=data;render()}).catch(error=>{
  $("#chinaRows").innerHTML='<tr><td colspan="8" class="china-empty">中国官方数据文件载入失败，请稍后重试。</td></tr>';
  $("#chinaViewNote").textContent="数据文件：data/china_wage_structure_2025.json";
  console.warn("China wage data unavailable",error);
 });
})();
