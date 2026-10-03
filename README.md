# 两样本 KS 距离与精确置换检验后端

一个离线、本地运行的小样本分布比较服务：输入两组带标签的整数观测，计算**双侧两样本
Kolmogorov–Smirnov 距离**，并用**条件于合并样本的精确标签置换分布**报告尾部概率。
只提供 HTTP API 与 CLI，无前端、无 Docker/WSL、无外部在线依赖。

## 适用范围（重要）

- 每组至少 1 个观测，**合并样本量 ≤ 16**（超出直接报错 `LIMIT_EXCEEDED`，绝不自动抽样）。
- 观测为安全整数，允许负值与重复值；重复值**不会**被去重。
- 只做精确枚举：**不做**渐近近似、蒙特卡洛抽样、连续流处理，也不产出任何临床结论。
- 检验前提是**原假设下两组标签可交换（exchangeable）**；p 值是条件于合并样本与
  固定样本量的精确尾部概率。大 p 值只说明数据与该前提不矛盾，**不能**解读为
  “已证明两分布相同”。

## 方法说明

### 统计距离（KS 距离）

在合并样本的每个**不同**观测值处，两组中所有等于该值（并列值）的观测**同步跃变**，
再比较两边累计比例。所有比较用整数完成：双侧统计量的分子为
`m·C_A(x) − n·C_B(x)`，公共分母为 `n·m`，不依赖浮点相等；小数仅用于展示。
返回最大绝对差 D、首次达到最大差的位置（合并不同值表中的下标与观测值）以及完整
逐值比较表。绝不在并列值处把某一组逐条推进——那会算出不存在的更大距离。

### 条件精确置换检验

固定样本量 n、m，把两组观测合并为 N=n+m 个**可区分位置**，枚举其中哪 n 个位置分给
第一组（其余归第二组），共 `C(N, n)` 种等权分配。即使观测值相同，不同位置分配也
分别计数（保留组合权重），不会把“只枚举不同数值分组”的结果当成等概率。
对每个分配计算同一口径的 D，**双侧**尾部计数为 `D ≥ 观测 D` 的分配数，
`p = 尾部计数 / 总分配数`，并输出可约分分数、小数与 D 的完整计数分布
（校验：分布计数之和 = 总分配数 = `C(N, n)`）。

## 环境要求

- Windows 本地，Node.js ≥ 22.5（使用内置 `node:sqlite`，无需编译原生模块）。
- 仅开发依赖 TypeScript；运行时零第三方依赖。

## 快速开始

```powershell
npm install        # 安装 devDependencies（typescript、@types/node）
npm run build      # 编译 TypeScript 到 dist/
npm test           # 构建并运行全部测试
npm start          # 启动 HTTP 服务（默认自动选择空闲端口）
npm run demo       # 运行演示：导入示例、计算、导出报告、模拟重启后读取冻结报告
```

## CLI

```powershell
# 导入样本（每组至少 1 个，合计 ≤ 16）
node dist/src/cli.js import --name 示例 --a "1,1,2" --b "1,2,2"
# 列出 / 查看数据集
node dist/src/cli.js list
node dist/src/cli.js show 1
# 计算分析（结果自动保存，可离线复算）
node dist/src/cli.js distance 1        # KS 距离 D 与逐值比较表
node dist/src/cli.js ecdf 1            # 累计分布比较表
node dist/src/cli.js test 1            # 精确置换检验（p 值）
node dist/src/cli.js dist 1            # D 的精确计数分布
node dist/src/cli.js report 1          # 导出 Markdown 报告到控制台
node dist/src/cli.js analysis 1        # 查看已保存的分析结果
# 启动 HTTP 服务（默认空闲端口，可用 --port 指定）
node dist/src/cli.js serve --port 8000
```

## HTTP API

`npm start` 或 `node dist/src/cli.js serve [--port N]` 启动；不指定端口时自动选择
空闲端口并打印实际地址。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/datasets` | 导入样本 `{name, groupA:[...], groupB:[...]}` |
| GET | `/datasets` | 列出数据集 |
| GET | `/datasets/:id` | 查看数据集与两组观测（原始行顺序保留） |
| POST | `/datasets/:id/distance` | 计算 KS 距离与逐值比较表 |
| GET | `/datasets/:id/ecdf` | 查看累计分布比较表 |
| POST | `/datasets/:id/permutation-test` | 执行精确置换检验（p 值） |
| GET | `/datasets/:id/distribution` | 查看 D 的精确计数分布 |
| POST | `/datasets/:id/report` | 导出 Markdown 报告 |
| GET | `/analyses/:id` | 查看已保存（冻结）的分析结果 |

所有计算端点会把结果连同算法版本一起存入 SQLite，可通过 `/analyses/:id`
在重启后读取冻结报告。

## 错误码

| 码 | 含义 |
|---|---|
| `INVALID_INPUT` | 参数不合法（空组、非整数、非安全整数等） |
| `LIMIT_EXCEEDED` | 合并样本量超过 16，直接报错不抽样 |
| `NOT_FOUND` | 数据集 / 分析报告不存在 |
| `INTERNAL` | 未预期错误 |

## 数据与可复算性

- 所有数据保存在项目内 `data/ks.sqlite`（可用 `--db` 或环境变量覆盖）。
- 保存内容：两组原始观测（含来源标签与原始行顺序）、算法版本（`ks-exact-v1`）、
  分析报告（冻结结果 JSON）。
- 重启后可按原样本复算：统计结果与样本内顺序无关，交换两组仅反转有符号差，
  不改变 D 与双侧 p 值。

## 测试

`npm test` 覆盖：各一条观测、不同样本量、全相等、负数、样本内重排、交换两组、
大量并列值；手算的 D 与排列尾部数；独立枚举极小案例校验计数分布、概率总和为 1、
p 值范围；交换组别仅反转有符号差；重启后读取冻结报告。

## 已知限制

- 合并样本量硬上限 16（`C(16,8)=12870` 种分配，精确枚举仍很快）。
- 单进程服务，无鉴权，仅面向本机使用。
- `node:sqlite` 在 Node 25 仍为实验特性，启动时会有 ExperimentalWarning，属正常。
