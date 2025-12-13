const fs = require("fs");
const path = require("path");
const github = require("@actions/github");

const token = process.env.GITHUB_PAT;
const octokit = github.getOctokit(token);
const csvPath = path.resolve(__dirname, "../../SpotifyAiArtists.csv");

async function run() {
  const { owner, repo } = github.context.repo;
  const { payload } = github.context;
  const action = payload.action;
  const issue = payload.issue;
  const label = payload.label?.name?.toLowerCase();
  const actor = payload.sender?.login;
  const perm = await octokit.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: actor });
  const hasWriteAccess = ["write", "maintain", "admin"].includes(perm.data.permission);
  if (!hasWriteAccess)
    return console.log(`Unauthorized user: ${actor}`);

  const command = action === "opened" ? "accepted" : label;
  const id = issue.body?.match(/\/artist\/([^\s?]+)/i)?.[1]?.trim();
  const name = issue.body?.match(/Artist Name\s*\n*(.+)/i)?.[1]?.trim();
  if (!id || !name)
    return console.log("Missing artist data");

  const issue_number = issue.number;
  if (command === "accepted") {
    const [header, ...rows] = fs.readFileSync(csvPath, "utf8").trim().split("\n");
    if (rows.some(l => l.includes(id)))
      return console.log("Already exists");

    rows.push(`${name},${id}`);
    fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
    console.log("Artist accepted");
    
    if (action === "opened")
      await octokit.rest.issues.addLabels({ owner, repo, issue_number, labels: ["accepted"] });

    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artist_name=${name}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artist_id=${id}\n`);
  }

  if (command === "rejected") {
    await octokit.rest.issues.update({ owner, repo, issue_number, state: "closed" });
    console.log(`Artist rejected: ${name}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
