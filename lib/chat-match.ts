export function pickMatchedSkillWanted(
  offered: { skill_id: string }[],
  wantedSkillIds: string[]
): string | undefined {
  const wanted = new Set(wantedSkillIds);
  const overlap = offered.find((s) => wanted.has(s.skill_id));
  if (overlap) return overlap.skill_id;
  return offered[0]?.skill_id;
}
