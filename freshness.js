(() => {
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const timeLabel = (value) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime())
      ? date.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
      : '暂无记录';
  };
  const componentLabel = (component, label) => {
    if (!component) return `${label}状态未知`;
    if (component.status === 'failed') return `${label}刷新失败，沿用上次成功数据`;
    if (component.status === 'blocked') return `${label}受 robots.txt 限制，沿用上次成功数据`;
    if (component.status === 'not_configured') return `${label}尚未配置来源`;
    if (component.status === 'success') return `${label}最近刷新成功：${timeLabel(component.last_success)}`;
    return `${label}尚无成功刷新记录`;
  };
  const fxAgeInDays = (value) => {
    const date = value ? new Date(`${value}T00:00:00Z`) : null;
    return date && Number.isFinite(date.getTime())
      ? Math.floor((Date.now() - date.getTime()) / 86400000)
      : null;
  };

  function render({ status, rows, macro }) {
    const panel = $('#refreshStatus');
    const summary = $('#refreshRunStatus');
    const guidance = $('#refreshGuidance');
    if (!panel || !summary || !guidance) return;

    const components = status?.components || {};
    const officialRows = Array.isArray(rows)
      ? rows.filter((row) => row?.source_url && row?.data_type !== 'simulated')
      : [];
    const referenceYears = officialRows
      .map((row) => String(row.reference_period || '').match(/(?:19|20)\d{2}/)?.[0])
      .filter(Boolean)
      .map(Number);
    const latestReferenceYear = referenceYears.length ? Math.max(...referenceYears) : null;
    const latestRetrieved = officialRows
      .map((row) => row.retrieved_at)
      .filter((value) => value && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    const latestPppYear = macro?.price_levels
      ? Object.values(macro.price_levels).map((item) => Number(item.year)).filter(Number.isFinite).sort((a, b) => b - a)[0]
      : null;

    const fxAge = fxAgeInDays(macro?.fx_date);
    const salaryOld = latestReferenceYear !== null && new Date().getFullYear() - latestReferenceYear > 2;
    const fxOld = fxAge !== null && fxAge > 7;
    const pppOld = latestPppYear !== null && new Date().getFullYear() - latestPppYear > 3;
    const failed = Object.values(components).some((item) => item?.status === 'failed');
    const blocked = Object.values(components).some((item) => item?.status === 'blocked');
    const csvSources = status?.csv_sources && typeof status.csv_sources === 'object'
      ? Object.entries(status.csv_sources)
      : [];
    const csvSummary = csvSources.length
      ? csvSources.map(([key, item]) => {
        const name = escapeHtml(item.name || key);
        const state = item.status === 'failed'
          ? `刷新失败，缓存 ${Number(item.records) || 0} 条`
          : item.status === 'success'
            ? `成功 · ${timeLabel(item.last_success)}`
            : '状态未知';
        return `${name}：${state}`;
      }).join('；')
      : componentLabel(components.salary_csv, '公开 CSV');
    const runStatus = status?.run_status;
    summary.className = `status-pill ${failed || blocked || fxOld || salaryOld || pppOld ? 'status-warning' : runStatus === 'success' ? 'status-ok' : 'status-unknown'}`;
    summary.textContent = !status
      ? '未读取到刷新记录'
      : runStatus === 'partial_failure'
        ? '部分更新失败，保留上次成功快照'
        : runStatus === 'completed_with_warnings'
          ? '有来源受限，其他刷新已完成'
        : runStatus === 'success'
          ? '最近一轮刷新完成'
          : '自动刷新尚未运行';

    const salaryFreshness = salaryOld ? '统计参考期较旧' : latestReferenceYear ? '参考期未超过2年' : '没有可追溯的统计期';
    const fxFreshness = fxAge === null ? '汇率日期未知' : fxOld ? `汇率已超过7天（${fxAge}天）` : `汇率日期 ${macro.fx_date}`;
    const pppFreshness = latestPppYear === null ? 'PPP年份未知' : pppOld ? `PPP参考年较旧（${latestPppYear}）` : `PPP参考年 ${latestPppYear}`;
    const cards = [
      {
        title: '官方工资统计',
        state: salaryOld || ['failed', 'blocked'].includes(components.bls?.status) || csvSources.some(([, item]) => item.status === 'failed') ? 'status-warning' : officialRows.length ? 'status-ok' : 'status-unknown',
        value: `${officialRows.length} 条有来源记录`,
        detail: `最新参考期：${latestReferenceYear ?? '未知'} · 最近抓取：${timeLabel(latestRetrieved)}`,
        extra: `${salaryFreshness} · ${componentLabel(components.bls, 'BLS')} · ${csvSummary}`,
      },
      {
        title: '汇率与购买力指标',
        state: !macro || fxOld || pppOld || components.macro?.status === 'failed' ? 'status-warning' : 'status-ok',
        value: macro ? `${fxFreshness} · ${pppFreshness}` : '宏观数据文件不可用',
        detail: `最近抓取：${timeLabel(macro?.retrieved_at)}`,
        extra: componentLabel(components.macro, '宏观数据'),
      },
      {
        title: '自动刷新流水线',
        state: failed || blocked ? 'status-warning' : runStatus === 'success' ? 'status-ok' : 'status-unknown',
        value: status ? `最近检查：${timeLabel(status.checked_at)}` : '刷新状态文件不可用',
        detail: `最近完整成功：${timeLabel(status?.last_successful_run)}`,
        extra: runStatus === 'partial_failure' ? '本轮失败的数据源会沿用上次成功文件。' : '失败记录保留在 GitHub Actions 日志和状态文件中。',
      },
    ];
    panel.innerHTML = cards.map((card) => `
      <article class="freshness-card">
        <div class="freshness-card-head"><b>${card.title}</b><span class="status-dot ${card.state}"></span></div>
        <strong>${card.value}</strong>
        <small>${card.detail}</small>
        <small>${card.extra}</small>
      </article>`).join('');

    const warnings = [];
    if (failed) warnings.push('有数据源刷新失败，页面继续使用最近一次成功的数据。');
    if (blocked) warnings.push('部分来源的抓取受到 robots.txt 限制，页面继续使用已发布快照；项目不会绕过该限制。');
    if (salaryOld) warnings.push('工资统计参考期超过2年，请优先核对更新后的官方数据。');
    if (fxOld) warnings.push('汇率日期已超过7天，跨币种换算可能偏旧。');
    if (pppOld) warnings.push('PPP价格水平参考年超过3年，购买力换算可能偏旧。');
    guidance.textContent = warnings.length
      ? warnings.join(' ')
      : '统计参考期、最近抓取时间和刷新任务状态分开显示。工资参考期超过2年、汇率超过7天或PPP超过3年时会提示复核。';
    guidance.classList.toggle('freshness-guidance-warning', warnings.length > 0);
  }

  Promise.allSettled([
    fetch('data/status.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
    fetch('data/latest.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('data/macro.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
  ]).then((results) => render({
    status: results[0].status === 'fulfilled' ? results[0].value : null,
    rows: results[1].status === 'fulfilled' ? results[1].value : [],
    macro: results[2].status === 'fulfilled' ? results[2].value : null,
  }));
})();
