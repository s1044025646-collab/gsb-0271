import { KsResult } from "./ks";
import { PermutationResult } from "./permutation";
import { ALGO_VERSION } from "./db";

export function renderReport(
  datasetId: number,
  name: string,
  a: number[],
  b: number[],
  ks: KsResult,
  perm: PermutationResult
): string {
  const lines: string[] = [];
  lines.push("# 两样本 KS 精确置换检验报告");
  lines.push("");
  lines.push(`- 数据集: #${datasetId} ${name}`);
  lines.push(`- 算法版本: ${ALGO_VERSION}`);
  lines.push(`- 第一组 (n=${ks.n}): [${a.join(", ")}]`);
  lines.push(`- 第二组 (m=${ks.m}): [${b.join(", ")}]`);
  lines.push("");
  lines.push("## KS 距离");
  lines.push("");
  lines.push(`- D = ${ks.dNumerator}/${ks.dDenominator} ≈ ${ks.d.toFixed(6)}`);
  lines.push(
    `- 首次达到最大差的位置: 合并不同值表第 ${ks.firstMaxIndex} 行（观测值 ${ks.firstMaxValue}）`
  );
  lines.push("");
  lines.push("## 累计分布比较表（并列值同步跃变）");
  lines.push("");
  lines.push("| 值 | A组条数 | B组条数 | A累计 | B累计 | 有符号差分子 | 绝对差分子 | 绝对差(小数) |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const row of ks.table) {
    lines.push(
      `| ${row.value} | ${row.countA} | ${row.countB} | ${row.cumA} | ${row.cumB} | ${row.diffNumerator} | ${row.absDiffNumerator} | ${row.absDiff.toFixed(6)} |`
    );
  }
  lines.push("");
  lines.push("## 精确置换检验");
  lines.push("");
  lines.push("- 前提: 原假设下两组标签可交换（exchangeable），固定样本量 n、m");
  lines.push(`- 总分配数 C(${ks.n + ks.m}, ${ks.n}) = ${perm.totalAssignments}`);
  lines.push(`- 尾部计数 (D >= 观测 D): ${perm.tailCount}`);
  lines.push(
    `- p 值 = ${perm.pValue.numerator}/${perm.pValue.denominator} = ${perm.pValue.reducedNumerator}/${perm.pValue.reducedDenominator} ≈ ${perm.pValue.decimal.toFixed(6)}`
  );
  lines.push("");
  lines.push("## D 的精确计数分布");
  lines.push("");
  lines.push("| D 分子 | D (小数) | 分配数 |");
  lines.push("|---|---|---|");
  for (const row of perm.distribution) {
    lines.push(`| ${row.dNumerator} | ${row.d.toFixed(6)} | ${row.count} |`);
  }
  lines.push("");
  lines.push("## 解释");
  lines.push("");
  lines.push(
    "p 值表示：在标签可交换的原假设下，随机重新分配标签得到不小于本次观测 KS 距离的条件概率。"
  );
  lines.push(
    "较大的 p 值仅说明数据与“标签可交换”不矛盾，并不证明两总体分布相同；小样本下检验功效有限。"
  );
  lines.push("本服务仅做小规模精确计算（合并样本量 ≤ 16），不构成任何临床结论。");
  return lines.join("\n");
}
