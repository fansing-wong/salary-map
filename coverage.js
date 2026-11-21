(() => {
  const countries = [
    { iso3: 'CHN', name: '中国', source: '国家统计局城镇单位工资', url: 'https://www.stats.gov.cn/english/PressRelease/202605/t20260518_1963740.html', target: '国家级；城市职业交叉数据待补' },
    { iso3: 'USA', name: '美国', source: 'BLS OEWS', url: 'https://www.bls.gov/oes/tables.htm', target: '全国、州、都会区；当前抓取受 robots 限制' },
    { iso3: 'JPN', name: '日本', source: '厚生劳动省工资结构调查 / Hello Work', url: 'https://www.mhlw.go.jp/www2/info/toukei/english/surveys.htm', target: '都道府县、地域块；待接入官方表' },
    { iso3: 'KOR', name: '韩国', source: '雇佣劳动部 / KOSIS', url: 'https://stathtml.moel.go.kr/statHtml/statHtml.do?conn_path=I2&language=en&orgId=118&tblId=DT_118N_LCE0001', target: '按官方表格可用层级；待接入' },
    { iso3: 'AUS', name: '澳大利亚', source: 'ABS Employee Earnings and Hours', url: 'https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/employee-earnings-and-hours-australia/may-2025', target: '州 / 领地；职业交叉依表而异' },
    { iso3: 'CAN', name: '加拿大', source: 'Statistics Canada / Job Bank', url: 'https://www150.statcan.gc.ca/n1/en/catalogue/1410041701', target: '省、地区、经济区；待接入' },
    { iso3: 'SGP', name: '新加坡', source: 'MOM Occupational Wages', url: 'https://stats.mom.gov.sg/statistics/income/occupational-wages/', target: '全国为主；待接入官方表' },
    { iso3: 'GBR', name: '英国', source: 'ONS ASHE', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours', target: 'UK、构成国及可用地区；待接入' },
  ];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const yearFrom = (value) => String(value || '').match(/(?:19|20)\d{2}/)?.[0] || '';
  const geographyNames = { country: '国家', admin1: '省 / 州', metro: '都会区', city: '城市' };

  Promise.allSettled([
    fetch('data/latest.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('data/status.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
  ]).then(([dataResult, statusResult]) => {
    const body = document.querySelector('#coverageRows');
    const count = document.querySelector('#coverageCount');
    if (!body || !count) return;
    const dataAvailable = dataResult.status === 'fulfilled' && Array.isArray(dataResult.value);
    if (!dataAvailable) {
      count.textContent = '覆盖文件暂不可用';
      body.innerHTML = '<tr><td colspan="7" class="empty">无法读取公开工资数据文件，暂不能判断国家覆盖情况。</td></tr>';
      return;
    }
    const data = dataResult.value;
    const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const records = data.filter((row) => row?.data_type === 'official_statistic' && row?.source_url);
    const availableCountries = countries.filter((country) => records.some((row) => row.iso3 === country.iso3)).length;
    count.textContent = `${availableCountries} / ${countries.length} 个国家已有官方工资记录`;
    body.innerHTML = countries.map((country) => {
      const rows = records.filter((row) => row.iso3 === country.iso3);
      const roles = [...new Set(rows.map((row) => row.role).filter(Boolean))];
      const geographies = [...new Set(rows.map((row) => row.geo_level).filter(Boolean))]
        .map((level) => geographyNames[level] || level);
      const periods = [...new Set(rows.map((row) => yearFrom(row.reference_period)).filter(Boolean))].sort();
      const sourceNames = [...new Set(rows.map((row) => row.source_name).filter(Boolean))];
      const blocked = country.iso3 === 'USA' && status?.components?.bls?.status === 'blocked';
      const stateLabel = rows.length ? blocked ? '已有记录 · 刷新受限' : '已有官方记录' : blocked ? '来源受限 · 暂无记录' : '待接入官方记录';
      const sourceLabel = sourceNames.length ? sourceNames.join('、') : country.source;
      const sourceUrl = rows[0]?.source_url || country.url;
      return `<tr>
        <td><b>${escapeHtml(country.name)}</b><div class="sub">${country.iso3}</div></td>
        <td><span class="coverage-status ${rows.length ? 'coverage-ready' : blocked ? 'coverage-blocked' : 'coverage-pending'}">${stateLabel}</span></td>
        <td>${rows.length}</td>
        <td>${roles.length ? `${roles.length} 组<div class="sub">${roles.slice(0, 3).map(escapeHtml).join('、')}${roles.length > 3 ? '…' : ''}</div>` : '—'}</td>
        <td>${geographies.length ? geographies.map(escapeHtml).join('、') : escapeHtml(country.target)}</td>
        <td>${periods.length ? periods.join('、') : '—'}</td>
        <td><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel)}</a></td>
      </tr>`;
    }).join('');
  });
})();
