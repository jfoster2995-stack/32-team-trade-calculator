// src/api/sleeper.ts
const BASE = "https://api.sleeper.app/v1";

export async function getUser(username: string) {
  const r = await fetch(`${BASE}/user/${encodeURIComponent(username)}`);
  if (!r.ok) throw new Error("User fetch failed");
  return r.json();
}

export async function getLeagues(userId: string) {
  // current NFL season; adjust if you need prior seasons
  const currentYear = new Date().getFullYear();
  const r = await fetch(`${BASE}/user/${userId}/leagues/nfl/${currentYear}`);
  if (!r.ok) throw new Error("Leagues fetch failed");
  return r.json();
}

export async function getRosters(leagueId: string) {
  const r = await fetch(`${BASE}/league/${leagueId}/rosters`);
  if (!r.ok) throw new Error("Rosters fetch failed");
  return r.json();
}

export async function getPlayersMap() {
  // Sleeper players dump is large; map to { [player_id]: player }
  const r = await fetch(`${BASE}/players/nfl`);
  if (!r.ok) throw new Error("Players fetch failed");
  const data = await r.json();
  return data as Record<string, any>;
}

export async function getTradedPicks(leagueId: string) {
  const r = await fetch(`${BASE}/league/${leagueId}/traded_picks`);
  if (!r.ok) throw new Error("Traded picks fetch failed");
  return r.json();
}
