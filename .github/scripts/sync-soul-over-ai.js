const fs = require("fs");
const path = require("path");
const https = require("https");

const SOUL_OVER_AI_URL = "https://raw.githubusercontent.com/xoundbyte/soul-over-ai/refs/heads/main/dist/artists.json";
const csvPath = path.resolve(__dirname, "../../SpotifyAiArtists.csv");

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("Fetching Soul Over AI data...");
  const artists = await fetchJSON(SOUL_OVER_AI_URL);
  console.log(`Fetched ${artists.length} artists`);

  // Read existing CSV
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const [header, ...rows] = csvContent.trim().split("\n");
  
  // Extract existing IDs
  const existingIds = new Set();
  for (const row of rows) {
    const lastCommaIndex = row.lastIndexOf(",");
    if (lastCommaIndex > 0) {
      const id = row.substring(lastCommaIndex + 1);
      existingIds.add(id);
    }
  }

  console.log(`Existing artists in CSV: ${existingIds.size}`);

  // Find missing artists
  const missingArtists = [];
  for (const artist of artists) {
    const spotifyId = artist.spotify;
    if (spotifyId && !existingIds.has(spotifyId)) {
      missingArtists.push({ name: artist.name, id: spotifyId });
    }
  }

  console.log(`Found ${missingArtists.length} missing artists`);

  if (missingArtists.length === 0) {
    console.log("No new artists to add");
    fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `artists_added=0\n`);
    return;
  }

  // Add missing artists to CSV
  for (const artist of missingArtists) {
    // Replace commas with underscore to avoid breaking CSV format
    const name = artist.name.replace(/,/g, "_");
    rows.push(`${name},${artist.id}`);
    console.log(`Added: ${artist.name} (${artist.id})`);
  }

  // Write updated CSV
  fs.writeFileSync(csvPath, [header, ...rows].join("\n") + "\n");
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `artists_added=${missingArtists.length}\n`);
  console.log(`Updated CSV with ${missingArtists.length} new artists`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
