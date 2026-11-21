# 国家与地域数据覆盖计划

工资、工时、职业分类与地理层级按来源分别保存。界面采用“国家 → 省/州/大区 → 城市/都会区”的可选层级；来源没有发布的层级保持空值，不把国家统计摊派为城市工资。

| 国家/地区 | 官方工资基线 | 职业粒度 | 地理粒度 | 下一步接入方式 |
|---|---|---|---|---|
| 中国 | 国家统计局城镇单位工资；当前已入库 2025 年规模以上企业工资 | 当前为 5 个宽岗位组；年薪换算月薪，均值 | 当前全国；城市职业数据需逐省/市来源 | 固定源快照 + 页面解析/下载校验；探索各地统计年鉴 |
| 日本 | 厚生劳动省工资结构基本调查、Hello Work 求职招聘工资 | 调查可细至职业类别 | 都道府县、地域块；Hello Work 职业工资按地域块 | 优先采用可下载的官方 Excel；保留固定工资与招聘工资口径差异 |
| 韩国 | 雇佣劳动部雇佣形态别劳动实态调查 / KOSIS | 职业大类、小时工资和工时 | 公开表按表而异，当前不承诺城市职业交叉粒度 | 先接官方表格/API，再扩展地区维度 |
| 澳大利亚 | ABS EEH May 2025 全体员工职业大类平均周总现金收入 | 已载入 8 个 ANZSCO 一位数大类及全部职业 | 当前快照仅国家级 | 以 52/12 折算月等值；没有对应工时、税后或地区成本，不生成时薪/推荐分；后续接入可核验的数据立方体 |
| 加拿大 | Statistics Canada 月度职业工资表 14-10-0426-01；导入器按 NOC 2021 选取职业及全国/省区记录 | NOC 职业；平均周工资按 52/12 折算月等值 | 全国、省/地区；暂不细化到城市 | WDS 元数据 + 最新期坐标接口；按表中可用的 NOC 汇总职业组提取，保留平均周工资原口径与换算说明 |
| 美国 | BLS OEWS | SOC 职业 | 全国、州、都会区 | 现有 BLS 适配器 |
| 新加坡 | MOM Occupational Wages | 职业类别 | 全国为主 | MOM 官方下载数据 |
| 英国 | ONS ASHE | SOC 职业 | UK、国家构成国及可用地区 | ONS 官方数据表 |

## 跨国比较规则

- 先按来源职业分类映射到项目的跨国大类，再允许展开原始职业代码；无法对齐时显示“不可直接对比”。
- 保存 `country_iso3`、`admin1`、`city`、`geo_level`、`occupation_code`、`occupation_taxonomy`、`reference_period`、`statistic`、`gross_net` 和来源 URL。
- 年薪除以 12 得到的仅为“年薪折算月薪”；不声称它是调查直接发布的月薪。
- 实际时薪只有在合同工时、常态加班和通勤时间均有输入时计算。官方表未给出个人通勤时长时，个人可自行填入预算情景。
- 国家级 PPP 仅作粗略筛选。城市住房与交通差异以个人预算或可信城市数据补充。
- 汇率/购买力只作为换算维度，不代替签证可行性、税务、社保、语言或行业执照评估。

## 官方入口

- [中国国家统计局：2025 年城镇单位平均工资](https://www.stats.gov.cn/english/PressRelease/202605/t20260518_1963740.html)
- [日本厚生劳动省：劳动工资统计清单](https://www.mhlw.go.jp/www2/info/toukei/english/surveys.htm)
- [日本厚生劳动省：Hello Work 地区/职业招聘与工资](https://www.mhlw.go.jp/roudou-navi/data/01/)
- [韩国雇佣劳动部：工资与工时统计表](https://stathtml.moel.go.kr/statHtml/statHtml.do?conn_path=I2&language=en&orgId=118&tblId=DT_118N_LCE0001)
- [澳大利亚 ABS：EEH 2025 数据立方体](https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/employee-earnings-and-hours-australia/may-2025)
- [加拿大 Statistics Canada：月度职业工资（14-10-0426-01）](https://www150.statcan.gc.ca/n1/en/catalogue/1410042601)
- [加拿大政府 Job Bank：工资搜索](https://www.jobbank.gc.ca/trend-analysis/search-wages)
- [美国 BLS OEWS](https://www.bls.gov/oes/tables.htm)
- [新加坡 MOM 职业工资](https://stats.mom.gov.sg/statistics/income/occupational-wages/)
- [英国 ONS 工资和工时](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours)

澳大利亚 ABS EEH 快照写入 `data/australia_abs_2025.json`，当前参考期为 May 2025；它是版本化快照，尚未设置自动抓取。

加拿大自动导入器写入 `data/canada_wages.json` 并由刷新任务并入 `data/latest.json`；上线前的首轮成功状态由 GitHub Actions 验证。

数据整理日期：2026-11-21。政府统计发布会修订；每次刷新须保留下载日期和参考期。

## 仪表盘覆盖矩阵

首页矩阵从 `data/latest.json` 动态汇总带 `iso3`、来源 URL 且标记为 `official_statistic` 的记录；来源计划和目标地域粒度列在 `coverage.js`。本机录入与演示值不计入覆盖率。若来源被 robots.txt 限制，会与“已有记录”状态分开显示；没有官方记录的国家标为待接入，不以演示数据填充。
