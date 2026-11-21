(() => {
  const STORAGE_KEY = 'salary-map-china-city-budget-v1';
  const CITY_ORDER = ['合肥市', '蚌埠市', '芜湖市', '马鞍山市', '滁州市', '安庆市', '南京市', '苏州市', '无锡市', '常州市', '镇江市'];
  const INPUTS = [
    ['netIncome', '税后到手月收入'],
    ['housing', '住房月支出'],
    ['living', '日常必要月支出'],
    ['commuteCost', '通勤交通月支出'],
    ['workHours', '合同周工时'],
    ['overtime', '常态加班周工时'],
    ['commuteHours', '通勤周小时']
  ];
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const format = (value) => Number.isFinite(value) ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value) + ' 元' : '无法比较';
  const monthly = (value) => Number.isFinite(Number(value)) ? format(Number(value) / 12) : '无法比较';
  const numeric = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0;
  const loadSaved = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  };
  let saved = loadSaved();
  let cityRows = [];
  const tbody = $('#cityBudgetRows');
  const summary = $('#cityBudgetSummary');
  const status = $('#cityBudgetStatus');
  const roleInput = $('#cityBudgetRole');

  function save() {
    saved.targetRole = roleInput.value;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      status.textContent = '情景输入已保存在当前浏览器；不会上传。';
    } catch {
      status.textContent = '浏览器未能保存输入；请先复制记录，刷新页面可能丢失。';
    }
  }

  function sourceCell(record, label) {
    if (!record) return '<span class="city-unavailable">无法比较</span><small>暂无已收录数据</small>';
    const secondary = /转载|待补|尚未检索/.test((record.source_note || '') + (record.source_name || ''));
    const badge = secondary ? '<span class="city-data-badge city-data-review">转载待核验</span>' : '<span class="city-data-badge">官方来源</span>';
    const source = record.source_url
      ? '<a href="' + escapeHtml(record.source_url) + '" target="_blank" rel="noreferrer">' + escapeHtml(label) + ' ↗</a>'
      : '<span class="city-unavailable">来源链接缺失</span>';
    return badge + '<small>' + source + '</small>';
  }

  function wageCell(row) {
    const source = sourceCell(row.wage, '工资来源');
    return '<td><strong>' + format(Number(row.wage.salary_annual_2025)) + ' / 年</strong><small>城镇非私营单位税前人均均值 · 2025</small>' + source + '</td>'
      + '<td><strong>' + monthly(row.wage.salary_annual_2025) + ' / 月</strong><small>年均工资 ÷ 12 的月等值，非月薪或 offer</small></td>';
  }

  function residentCell(row, key, label) {
    if (!row.resident || !numeric(row.resident[key])) {
      return '<td><span class="city-unavailable">无法比较</span><small>缺少已核验的2025城镇居民数据</small></td>';
    }
    const value = monthly(row.resident[key]);
    const source = sourceCell(row.resident, '居民来源');
    return '<td><strong>' + value + ' / 月</strong><small>城镇居民人均' + label + '；年值 ÷ 12</small>' + source + '</td>';
  }

  function inputCell(city, field, label, value) {
    const fieldLabel = city + ' ' + label;
    return '<td><input type="number" min="0" step="any" inputmode="decimal" data-city="' + escapeHtml(city) + '" data-field="' + field + '" aria-label="' + escapeHtml(fieldLabel) + '" value="' + escapeHtml(value ?? '') + '" placeholder="填写"></td>';
  }

  function inputsFor(city) {
    const entry = saved[city] && typeof saved[city] === 'object' ? saved[city] : {};
    return INPUTS.map(([field]) => entry[field] ?? '');
  }

  function incomeBasisCell(city) {
    const entry = saved[city] && typeof saved[city] === 'object' ? saved[city] : {};
    const basis = entry.incomeBasis || '';
    return '<td><select data-city="' + escapeHtml(city) + '" data-field="incomeBasis" aria-label="' + escapeHtml(city) + '税后收入依据"><option value=""' + (basis === '' ? ' selected' : '') + '>未标注</option><option value="estimate"' + (basis === 'estimate' ? ' selected' : '') + '>本人估算</option><option value="offer"' + (basis === 'offer' ? ' selected' : '') + '>Offer / 工资条</option><option value="employer"' + (basis === 'employer' ? ' selected' : '') + '>招录单位确认</option></select></td>';
  }

  function incomeBasisLabel(city) {
    const basis = saved[city] && saved[city].incomeBasis;
    return ({ estimate: '本人估算', offer: 'Offer / 工资条', employer: '招录单位确认' })[basis] || '依据未标注';
  }

  function intensityCell(city) {
    const entry = saved[city] && typeof saved[city] === 'object' ? saved[city] : {};
    const intensity = entry.intensity || '';
    return '<td><select data-city="' + escapeHtml(city) + '" data-field="intensity" aria-label="' + escapeHtml(city) + '主观劳动强度"><option value=""' + (intensity === '' ? ' selected' : '') + '>未评</option>' + [1, 2, 3, 4, 5].map((value) => '<option value="' + value + '"' + (String(intensity) === String(value) ? ' selected' : '') + '>' + value + (value === 1 ? ' 低' : value === 5 ? ' 高' : '') + '</option>').join('') + '</select><small>个人自评，不是官方值</small></td>';
  }

  function scenarioResult(city) {
    const entry = saved[city] && typeof saved[city] === 'object' ? saved[city] : {};
    const missingMoney = INPUTS.slice(0, 4).filter(([field]) => !numeric(entry[field])).map(([, label]) => label);
    const missingTime = INPUTS.slice(4).filter(([field]) => !numeric(entry[field])).map(([, label]) => label);
    const totalCost = ['housing', 'living', 'commuteCost'].reduce((total, field) => total + (numeric(entry[field]) ? Number(entry[field]) : 0), 0);
    const balance = missingMoney.length ? null : Number(entry.netIncome) - totalCost;
    const totalHours = ['workHours', 'overtime', 'commuteHours'].reduce((total, field) => total + (numeric(entry[field]) ? Number(entry[field]) : 0), 0);
    const paidHours = numeric(entry.workHours) && numeric(entry.overtime) ? Number(entry.workHours) + Number(entry.overtime) : 0;
    const hourly = balance !== null && missingTime.length === 0 && paidHours > 0 && totalHours > 0 ? balance * 12 / (totalHours * 52) : null;
    const balanceText = balance === null
      ? '<span class="city-unavailable">无法比较</span><small>缺少：' + escapeHtml(missingMoney.join('、')) + '</small>'
      : '<strong class="' + (balance < 0 ? 'city-negative' : '') + '">' + format(balance) + ' / 月</strong><small>税后收入 − 住房 − 日常支出 − 通勤支出</small><small>个人情景 · ' + escapeHtml(incomeBasisLabel(city)) + ' · 强度自评 ' + escapeHtml(saved[city]?.intensity || '未评') + '</small>';
    let hourlyNote = missingMoney.concat(missingTime);
    if (balance !== null && missingTime.length === 0 && paidHours <= 0) hourlyNote.push('每周有薪工作时间需大于0');
    const hourlyText = hourly === null
      ? '<span class="city-unavailable">无法比较</span><small>缺少：' + escapeHtml(hourlyNote.join('、') || '有效工时') + '</small>'
      : '<strong class="' + (hourly < 0 ? 'city-negative' : '') + '">' + hourly.toFixed(2) + ' 元 / 小时</strong><small>月结余 × 12 ÷（工作 + 加班 + 通勤周小时）÷ 52</small><small>个人情景 · ' + escapeHtml(incomeBasisLabel(city)) + ' · 强度自评 ' + escapeHtml(saved[city]?.intensity || '未评') + '</small>';
    return { balance, hourly, balanceText, hourlyText, complete: balance !== null && hourly !== null };
  }

  function renderRow(row) {
    const city = row.city;
    const input = inputsFor(city);
    const labels = INPUTS.map((item) => item[1]);
    const cells = input.map((value, index) => inputCell(city, INPUTS[index][0], labels[index], value) + (INPUTS[index][0] === 'netIncome' ? incomeBasisCell(city) : '') + (INPUTS[index][0] === 'commuteHours' ? intensityCell(city) : '')).join('');
    const result = scenarioResult(city);
    const cityName = '<td class="city-name"><strong>' + escapeHtml(city) + '</strong><small>' + escapeHtml(row.admin1) + '</small></td>';
    return '<tr>' + cityName + wageCell(row) + residentCell(row, 'urban_disposable_income_2025', '可支配收入') + residentCell(row, 'urban_consumption_2025', '消费支出') + cells + '<td class="city-result">' + result.balanceText + '</td><td class="city-result">' + result.hourlyText + '</td></tr>';
  }

  function render() {
    if (!tbody) return;
    tbody.innerHTML = cityRows.map(renderRow).join('');
    const residentCoverage = cityRows.filter((row) => row.resident && numeric(row.resident.urban_consumption_2025) && numeric(row.resident.urban_disposable_income_2025)).length;
    const completeScenarios = cityRows.filter((row) => scenarioResult(row.city).complete).length;
    summary.innerHTML = [
      ['已收录工资参考', cityRows.length + ' / ' + CITY_ORDER.length, '仅列已有2025城镇非私营单位均值的城市'],
      ['居民收支背景', residentCoverage + ' / ' + cityRows.length, '缺数据的城市保留空值，不补估'],
      ['完整财务 / 时间情景', completeScenarios + ' / ' + cityRows.length, '收入、支出及周时间齐全；强度自评可选']
    ].map((item) => '<div class="city-budget-metric"><span>' + item[0] + '</span><strong>' + item[1] + '</strong><small>' + item[2] + '</small></div>').join('');
  }

  function loadData() {
    fetch('data/china_east_regions_2025.json').then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then((pack) => {
      const anhuiSource = (pack.sources || []).find((item) => (item.name || '').includes('安徽省统计局'));
      const wageRows = [
        ...(pack.anhui_city_wages || []).filter((row) => CITY_ORDER.includes(row.location)).map((row) => ({
          ...row,
          admin1: '安徽省',
          population: '城镇非私营单位',
          source_url: anhuiSource?.url || '',
          source_name: '安徽省统计局2025年分地级市平均工资表',
          source_note: '城镇非私营单位税前人均均值，不代表具体职位或到手工资。'
        })),
        ...(pack.jiangsu_focus_city_wages || []).filter((row) => CITY_ORDER.includes(row.location) && row.population === '城镇非私营单位')
      ];
      const wages = new Map(wageRows.map((row) => [row.location, row]));
      const residents = new Map((pack.focus_city_residents || []).map((row) => [row.location, row]));
      cityRows = CITY_ORDER.filter((city) => wages.has(city)).map((city) => {
        const wage = wages.get(city);
        return { city, admin1: wage.admin1 || (city === '镇江市' ? '江苏省' : '安徽省'), wage, resident: residents.get(city) || null };
      });
      if (!cityRows.length) throw new Error('没有可用城市工资数据');
      roleInput.value = saved.targetRole || '';
      status.textContent = '统计来源来自随项目发布的 2025 快照；个人预算只存于当前浏览器。';
      render();
    }).catch((error) => {
      console.warn('城市预算比较数据不可用', error);
      summary.innerHTML = '<div class="city-budget-metric"><span>数据状态</span><strong>无法比较</strong><small>城市工资数据文件未能载入</small></div>';
      tbody.innerHTML = '<tr><td colspan="16" class="empty">无法读取城市工资数据；请在网络可用时刷新页面。</td></tr>';
      status.textContent = '数据文件未载入；没有使用模拟值代替。';
    });
  }

  tbody.addEventListener('change', (event) => {
    const input = event.target.closest('[data-city][data-field]');
    if (!input) return;
    const city = input.dataset.city;
    const field = input.dataset.field;
    saved[city] = saved[city] && typeof saved[city] === 'object' ? saved[city] : {};
    saved[city][field] = input.value;
    save();
    render();
  });
  roleInput.addEventListener('input', save);
  $('#clearCityBudget').addEventListener('click', () => {
    if (!window.confirm('清除本机保存的所有城市预算情景？')) return;
    saved = {};
    roleInput.value = '';
    save();
    render();
  });
  loadData();
})();
