# 薪酬地图 | Salary Map

一个面向跨地域择业的开源决策仪表盘。比较岗位税前工资、通勤与加班后的有效时薪、估算生活成本、购买力余额和主观劳动强度。无需安装依赖，支持 GitHub Pages 静态部署。

## 使用

直接打开 `index.html`，或通过 GitHub Pages 发布仓库根目录。表格中的机会可添加、编辑、删除；数据保存在当前浏览器的 `localStorage`。点“恢复演示数据”可重置本地记录。

## 指标

- **有效周工时** = 合同周工时 + 每周加班 + 每周通勤时间。通勤时间按个人时间成本计入，不代表法律意义的工作时间。
- **实际时薪** = 月薪 × 12 ÷ (有效周工时 × 52)。这是税前估算，不计奖金、税、社保、带薪假期或汇率。
- **购买力余额** = 月薪 − 单人每月基本生活成本估算。负值表示薪水不足以覆盖输入的预算。
- **推荐分**是排序参考：工资结余占比、同币种机会中的有效时薪表现、劳动强度惩罚。不同币种不能直接比较，应用不做汇率或购买力平价换算。
- **劳动强度**为 1–5 主观评分，建议按体力负担、工作节奏、压力和排班综合填写。

## 数据

内置记录是**模拟演示数据**，不代表任何官方统计、城市平均薪资或生活成本。请以实际 offer 和可核验的当地数据替换。用户自定义数据只存放在浏览器本地，不会传到服务器。

可用作后续正式数据接入起点的官方来源：

- [新加坡人力部 MOM 职业工资](https://stats.mom.gov.sg/statistics/income/occupational-wages/)
- [美国劳工统计局 BLS OEWS 职业工资表](https://www.bls.gov/oes/tables.htm)
- [加拿大 Statistics Canada 年度职业工资表](https://www150.statcan.gc.ca/n1/en/catalogue/1410041701)
- [英国 ONS 工资与工时统计](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours)

各国统计口径、税前/税后定义、职业分类和年份不同，整合前应保留原始来源、统计年份、样本口径及币种，避免把平均值、中位数和招聘报价混为一谈。

## 贡献

欢迎提交各地官方数据适配器、来源元信息、经验证的生活成本预算或翻译。新增数据请标明来源 URL、发布日期/参考期、币种、平均数或中位数、税前/税后、工时口径和许可条件。不要将模拟值描述为真实市场数据。

## License

MIT，见 [LICENSE](LICENSE)。



## 自动更新数据

采集器位于 `scripts/update_data.py`。把获得授权且可再分发的公开 CSV 来源加入 `scripts/sources.json` 后，可本地运行 `python scripts/update_data.py`。GitHub Actions 每周一 UTC 04:17 自动运行，也可在 Actions 页面手动触发；数据会写入 `data/latest.json` 并由仪表盘加载。首次上线时来源列表为空，因此不会自动抓取网站。

采集器会检查 robots.txt、发送带说明的 User-Agent、使用条件请求并限制请求频率。来源应提供规范 CSV，字段映射和口径需在来源注册表中声明。当前脚手架不是通用网页解析器，也不会抓取需登录内容。

社交平台数据应仅通过获准的官方 API 或获得授权的导出数据接入，并单独标注为招聘帖子样本；不能代表岗位平均薪资。LinkedIn 的帖子读取权限有审批限制，见 [LinkedIn API permissions](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)。未经授权抓取账号内容会因平台规则和技术限制而不稳定。抓取公开站点也要尊重站点规则；`robots.txt` 是抓取偏好机制，不等于许可或法律意见，见 [Google robots.txt guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro)。

后续版本规划见 [产品路线图](docs/PRODUCT_ROADMAP.md)。

## 跨币种购买力

页面可选择展示币种，名义金额由欧洲央行每日欧元参考汇率交叉换算，并标出汇率日期。PPP 近似使用世界银行家庭消费价格水平指数（美国=100）将名义美元换算为国际元估算；这是国家级家庭消费价格代理，不是城市租金或个人消费篮子。宏观数据由 `scripts/update_macro.py` 更新到 `data/macro.json`。首次刷新前或缺失地区不会显示跨区 PPP 值；不以 0 或模拟数填补。

用户机会可填写统计口径、税前/税后、参考期、来源名称及链接。演示记录始终标为模拟样例。世界银行指出 PPP 适用于家庭最终消费等宏观总量比较，不能直接代替具体工资或个人支出测量；请把 PPP 作为预算情景参考，而非税后购买力承诺。

