type RecruitingEmail = { to: string | string[]; subject: string; text: string };

export async function sendRecruitingEmail(email: RecruitingEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RECRUITING_FROM_EMAIL;
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function recruitingTeamEmail(team: string): string | null {
  try {
    const recipients = JSON.parse(process.env.RECRUITING_TEAM_EMAILS ?? "{}") as Record<string, string>;
    const email = recipients[team]?.trim();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}