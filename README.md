# 两样本 KS 距离与精确置换检验（离线小样本后端）

一个只在 Windows 本地运行的离线后端：输入两组带来源标签的整数观测，计算双侧两样本
Kolmogorov–Smirnov 距离 D，并用**条件于合并样本的精确标签置换分布**报告尾部概率。
仅提供 HTTP API 与 CLI，无前端。不依赖 Docker、WSL、付费服务或任何外部在线 API。

## 统计口径（重要）

- **KS 距离是描述性统计量**：D = max|F_A(x) − F_B(x)|，只度量两个经验分布函数的最大差距，
  本身不做任何推断。
- **精确置换检验是条件推断**：固定合并样本与两组样本量 n、m，枚举全部 C(n+m, n) 种
  「哪些位置分给第一组」的标签分配（位置可区分，等概率），统计 D ≥ 观测 D 的比例作为 p 值。
- **并列值同步跃变**：在每个不同观测值处，先把两组所有等于该值的观测同时计入累计，
  再计算比例差。不会先把某一组逐条推进而得到不存在的更大距离。
- **整数精确比较**：距离用公共分母 n×m 的整数分子（cumA×m − cumB×n）比较，
  不依赖浮点相等；界面上的小数仅供阅读。
- **重复观测不去重**；允许负值；观测必须是安全整数。原始行顺序会被保留，
  但顺序不影响统计结果。

## 适用范围与限制

- 每组至少 1 个观测，合并总数 ≤ 16（C(16,8) = 12870 种分配，秒级完成）。
- 超过上限直接报错 `TOO_MANY_OBSERVATIONS`，**不会悄悄抽样**。
- 不做渐近近似、蒙特卡洛、连续流处理，不输出任何真实临床结论。
- p 值含义：在「两组来自同一分布、标签可交换」的原假设下，出现不小于观测 D 的概率。
  **大 p 值只表示数据与原假设相容，不能据此断言两组分布相同。**

## 环境要求

- Node.js ≥ 22.5（使用内置 `node:sqlite`，无需原生编译）；开发环境为 Node 25。
- 仅开发依赖 TypeScript；运行时零第三方依赖。

## 构建、测试、启动、演示

```powershell
npm install        # 安装开发依赖（typescript、@types/node）
npm run build      # 编译到 dist/
npm test           # 构建并运行全部测试（node:test）
npm start          # 启动 HTTP 服务（默认选择空闲端口）
npm run demo       # 运行内置小例子（完全相同 / 完全分离 / 大量并列值）并写入报告
```

## CLI

```powershell
node dist/src/cli.js import --name 示例 --a 1,2,3 --b 4,5   # 导入样本，返回 id
node dist/src/cli.js list                                   # 列出样本
node dist/src/cli.js distance --id 1                        # KS 距离（也可 --a ... --b ... 直接算）
node dist/src/cli.js ecdf --id 1                            # 累计分布比较表
node dist/src/cli.js test --id 1                            # 精确置换检验并保存报告
node dist/src/cli.js dist --id 1                            # D 的精确计数分布
node dist/src/cli.js report --id 1                          # 读取已冻结报告（重启后仍可读）
node dist/src/cli.js serve --port 8080                      # 指定端口；省略则选空闲端口
```

数据保存在项目内 `data/ks.db`（可用环境变量 `KS_DB_PATH` 覆盖），
库中同时保存两组原始观测、算法版本（`ks-exact-v1`）与分析报告，重启后可按原样本复算。

## HTTP API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/samples` | 导入样本，body：`{"name": "...", "groupA": [..], "groupB": [..]}` |
| GET | `/samples` 、 `/samples/:id` | 列出 / 查看样本 |
| GET | `/samples/:id/distance` | KS 距离 D（整数分子 + 小数） |
| GET | `/samples/:id/ecdf` | 累计分布比较表 |
| POST | `/samples/:id/test` | 执行精确检验，保存并返回报告 |
| GET | `/samples/:id/distribution` | D 的精确计数分布 |
| GET | `/reports/:id` | 导出冻结报告 |

错误响应统一为 `{"error": {"code", "message"}}`，错误码：
`INVALID_INPUT`、`EMPTY_GROUP`、`TOO_MANY_OBSERVATIONS`、`NOT_SAFE_INTEGER`、`NOT_FOUND`。

## 项目结构

- `src/ks.ts` — KS 距离与 ECDF 表（并列值同步跃变、整数分子比较）
- `src/permutation.ts` — 精确标签置换枚举、尾部计数、可约分分数、组合数校验
- `src/validate.ts` — 参数校验与错误码
- `src/db.ts` — SQLite 持久化（样本 + 报告 + 算法版本）
- `src/report.ts` — 报告组装与统计解释文案
- `src/server.ts` — HTTP API（node:http）
- `src/cli.ts` — 命令行入口与内置演示
- `tests/` — 手算校验：各一条观测、不同样本量、全相等、负数、并列值、
  重排与交换组别、计数分布总和为组合数、概率和为 1、p 值范围、重启后读取冻结报告
