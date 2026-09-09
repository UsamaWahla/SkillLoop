type UserSkillEntry = {
  skill_id: string;
  type: 'offered' | 'wanted';
  level: string | null;
};

type ProfileInfo = {
  location: string | null;
  preferred_language: string | null;
};

const LEVEL_SCORES: Record<string, number> = {
  beginner: 0.5,
  intermediate: 0.8,
  advanced: 1,
};

export function calculateCompatibilityScore(
  myProfile: ProfileInfo,
  mySkills: UserSkillEntry[],
  theirProfile: ProfileInfo,
  theirSkills: UserSkillEntry[]
): number {
  const myOffered = mySkills.filter((s) => s.type === 'offered');
  const myWanted = mySkills.filter((s) => s.type === 'wanted');
  const theirOffered = theirSkills.filter((s) => s.type === 'offered');
  const theirWanted = theirSkills.filter((s) => s.type === 'wanted');

  const theyOfferWhatIWant = myWanted.filter((wantedSkill) =>
    theirOffered.some((offered) => offered.skill_id === wantedSkill.skill_id)
  );

  const iOfferWhatTheyWant = theirWanted.filter((wantedSkill) =>
    myOffered.some((offered) => offered.skill_id === wantedSkill.skill_id)
  );

  let skillScore = 0;

  if (theyOfferWhatIWant.length > 0 && iOfferWhatTheyWant.length > 0) {
    skillScore = 100;
  } else if (theyOfferWhatIWant.length > 0 || iOfferWhatTheyWant.length > 0) {
    skillScore = 60;
  } else {
    skillScore = 0;
  }

  let levelBonus = 0;
  if (theyOfferWhatIWant.length > 0) {
    const relevantOfferedSkills = theirOffered.filter((offered) =>
      theyOfferWhatIWant.some((wanted) => wanted.skill_id === offered.skill_id)
    );
    const avgLevel =
      relevantOfferedSkills.reduce(
        (sum, s) => sum + (LEVEL_SCORES[s.level ?? 'beginner'] ?? 0.5),
        0
      ) / relevantOfferedSkills.length;
    levelBonus = avgLevel * 100;
  }

  const locationScore =
    myProfile.location &&
    theirProfile.location &&
    myProfile.location.trim().toLowerCase() === theirProfile.location.trim().toLowerCase()
      ? 100
      : 0;

  const languageScore =
    myProfile.preferred_language &&
    theirProfile.preferred_language &&
    myProfile.preferred_language.trim().toLowerCase() ===
      theirProfile.preferred_language.trim().toLowerCase()
      ? 100
      : 0;

  const finalScore =
    skillScore * 0.6 + levelBonus * 0.15 + locationScore * 0.1 + languageScore * 0.15;

  return Math.round(finalScore);
}