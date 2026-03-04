import { resolve } from "https://deno.land/std@0.224.0/path/mod.ts";
import { getOctokit, context } from "npm:@actions/github@6";

const token = Deno.env.get("GITHUB_TOKEN");
const octokit = getOctokit(token);
const csvPath = resolve(Deno.cwd(), "SpotifyAiArtists.csv");
const shlabsApiKey = Deno.env.get("SUBMITHUB_API_KEY");

async function detectTrack(trackId) {
  const response = await fetch("https://shlabs.music/api/v1/detect", {
    method: "POST",
    headers: { "X-API-Key": shlabsApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ spotifyTrackId: trackId })
  });
  const json = await response.json();
  if (json.error)
    throw new Error(`${json.error} ${json.details || ""}`);
  return Math.round(json?.result?.probability_ai_generated ?? 0);
}

async function run() {
  const { owner, repo } = context.repo;
  const payload = context.payload;
  const action = payload.action;
  const issue = payload.issue;
  const label = payload.label?.name?.toLowerCase();
  const actor = payload.sender?.login;
  const issue_number = issue.number;

  const id = issue.body?.match(/\/artist\/([^\s?]+)/i)?.[1]?.trim();
  const name = issue.body?.match(/Artist Name[\r\n\s]*(.+)/i)?.[1]?.trim();

  if (!id || !name)
    return console.log("Missing artist data");

  const [header, ...rows] = (await Deno.readTextFile(csvPath)).trim().replace(/\r\n/g, "\n").split("\n");
  if (rows.some(l => l.includes(id))) {
    try { await octokit.rest.issues.removeLabel({ owner, repo, issue_number, name: "accepted" }); } catch (_) {}
    await octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: ["duplicate"] });
    await octokit.rest.issues.update({ owner, repo, issue_number, state: "closed" });
    return console.log("Duplicate artist");
  }

  let hasWriteAccess = false;
  try {
    const perm = await octokit.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: actor });
    hasWriteAccess = ["write", "maintain", "admin"].includes(perm.data.permission);
  } catch (_) {}

  async function acceptArtist() {
    rows.push(`${name},${id}`);
    await Deno.writeTextFile(csvPath, [header, ...rows].join("\n"));
    console.log("Artist accepted");

    await octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: ["accepted"] });
    const output = Deno.env.get("GITHUB_OUTPUT");
    if (output) {
      await Deno.writeTextFile(output, `artist_name=${name}\nartist_id=${id}\n`, { append: true });
    }
  }

  if (hasWriteAccess) {
    await acceptArtist();
    return;
  }

  const trackId = issue.body?.match(/\/track\/([^\s?]+)/i)?.[1]?.trim();
  if (!trackId)
    return console.log("No track URL found");

  await octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: ["checked"] });
  
  let probability = 0;
  try { probability = await detectTrack(trackId); } catch (err) {
    console.log("Failed to detect track:", err.message);
  }

  if (probability > 50) {
    await acceptArtist();
  }
  
  console.log(`AI probability ${probability}%`);
}

run().catch(err => {
  console.error(err);
  Deno.exit(1);
});
