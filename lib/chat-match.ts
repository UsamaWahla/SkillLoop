export function pickMatchedSkillWanted(
  offered: { skill_id: string }[],
  wantedSkillIds: string[]
): string | undefined {
  const wanted = new Set(wantedSkillIds);
  const overlap = offered.find((s) => wanted.has(s.skill_id));
  if (overlap) return overlap.skill_id;
  return offered[0]?.skill_id;
}

export async function ensureMatchForChat(params: {
  currentUserId: string;
  otherUserId: string;
  compatibilityScore: number;
  matchedSkillWanted?: string;
}): Promise<string> {
  const { supabase } = await import('./supabase');

  const { data: existingMatch, error: lookupError } = await supabase
    .from('matches')
    .select('id')
    .or(
      `and(user_id_1.eq.${params.currentUserId},user_id_2.eq.${params.otherUserId}),and(user_id_1.eq.${params.otherUserId},user_id_2.eq.${params.currentUserId})`
    )
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existingMatch?.id) {
    return existingMatch.id;
  }

  const { data: newMatch, error: insertError } = await supabase
    .from('matches')
    .insert({
      user_id_1: params.currentUserId,
      user_id_2: params.otherUserId,
      compatibility_score: params.compatibilityScore,
      status: 'accepted',
      ...(params.matchedSkillWanted
        ? { matched_skill_wanted: params.matchedSkillWanted }
        : {}),
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return newMatch.id;
}
