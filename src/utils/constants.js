export const ICON_MAP = {
  出生: "🎂",
  求学: "📚",
  毕业: "📚",
  工作: "💼",
  入职: "💼",
  婚姻: "💍",
  结婚: "💍",
  居住: "🏠",
  迁居: "🏠",
  成就: "🏆",
  获奖: "🏆",
  参军: "🎖️",
  退伍: "🎖️",
  移民: "✈️",
  出国: "✈️",
};

export const ICON_DEFAULT = "📌";

// 年份排序值解析规则（PRD 4.7）
// 1930年代 → 1935, 80年代 → 1985, 约1940年 → 1940, 清光绪年间 → null
export function parseYearSort(yearDisplay) {
  if (!yearDisplay) return null;
  const eraMatch = yearDisplay.match(/(\d{4})\s*年代/);
  if (eraMatch) return parseInt(eraMatch[1]) + 5;
  const shortEraMatch = yearDisplay.match(/(\d{2})\s*年代/);
  if (shortEraMatch) return 1900 + parseInt(shortEraMatch[1]) + 5;
  const numMatch = yearDisplay.match(/(\d{4})/);
  if (numMatch) return parseInt(numMatch[1]);
  return null;
}

export const TAG_QUICK_SELECT = [
  "出生",
  "求学",
  "工作",
  "婚姻",
  "居住",
  "成就",
];

export const CHUNK_SIZE = 500;

export const IMPORT_COLUMNS = [
  "姓名",
  "性别",
  "父亲",
  "母亲",
  "配偶",
  "生年",
  "卒年",
  "生平简介",
  "时间线",
];
