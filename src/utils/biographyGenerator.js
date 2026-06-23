export function generateBiographyFromTimeline(events) {
  if (!events?.length) return "";
  const sorted = [...events].sort(
    (a, b) => (a.year_sort ?? 9999) - (b.year_sort ?? 9999),
  );
  return sorted
    .map((e) => {
      let text = "";
      if (e.year_display) text += `[${e.year_display}] `;
      if (e.event_type_label) text += `${e.event_type_label}：`;
      if (e.event_title) text += `${e.event_title}。`;
      if (e.description) text += `${e.description}。`;
      if (e.location) text += `（${e.location}）`;
      return text;
    })
    .join("\n");
}

export function exportBiography(memberName, events) {
  const bio = generateBiographyFromTimeline(events);
  return `${memberName} 生平简介：\n\n${bio}`;
}
