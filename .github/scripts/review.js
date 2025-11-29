const fs = require("fs");
const path = require("path");
const github = require("@actions/github");
const token = process.env.GITHUB_PAT;
const octokit = github.getOctokit(token);
const csvPath = path.resolve(__dirname, "../../SpotifyAiArtists.csv");

async function run() {
  const [owner, repo] = process.env.REPO.split("/");
  const eventName = process.env.EVENT_NAME;
  const command = (eventName === "issue_comment") ? process.env.COMMENT_BODY.toLowerCase() : "/accept";
  if (!command.includes("/accept") && !command.includes("/reject")) return;
  
  const author = (eventName === "issue_comment") ? github.context.payload.comment.user.login : github.context.payload.issue.user.login;
  const perm = await octokit.rest.repos.getCollaboratorPermissionLevel({owner, repo, username: author});
  const hasWriteAccess = ["write", "admin", "maintain"].includes(perm.data.permission);
  if (!hasWriteAccess) {
    if (eventName === "issue_comment")
      console.log(`Unauthorized user: ${author}`);
    return;
  }

  const issue_number = Number(process.env.ISSUE_NUMBER);
  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number });

  const id = issue.body.match(/\/artist\/([^\s]+)/i)?.[1]?.trim();
  const name = issue.body.match(/Artist Name\n*(.+)/i)?.[1]?.trim();

  if (!id || !name) return console.log("Missing artist data");

  if (command.includes("/accept")) {
    const [header, ...rows] = fs.readFileSync(csvPath, "utf8").trim().split("\n");
    if (rows.some(l => l.includes(id))) return console.log("Already exists");
    rows.push(`${name},${id}`);
    fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
    await octokit.rest.issues.addLabels({owner, repo, issue_number, labels: ["accepted"]});
    console.log("Artist accepted");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artist_name=${name}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `artist_id=${id}\n`);
  }

  if (command.includes("/reject")) {
    await octokit.rest.issues.addLabels({owner, repo, issue_number, labels: ["rejected"]});
    await octokit.rest.issues.update({ owner, repo, issue_number, state: "closed" });
    console.log(`Artist rejected: ${name}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
