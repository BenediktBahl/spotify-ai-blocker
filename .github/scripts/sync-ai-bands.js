const fs = require("fs");
const path = require("path");
const https = require("https");

const AI_BANDS_URL = "https://raw.githubusercontent.com/romiem/ai-bands/refs/heads/main/dist/ai-bands.json";
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

function extractSpotifyId(url) {
  if (!url) return null;
  const match = url.match(/spotify\.com\/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function run() {
  console.log("Fetching AI bands data...");
  const bands = await fetchJSON(AI_BANDS_URL);
  console.log(`Fetched ${bands.length} bands`);

  // Read existing CSV
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const [header, ...rows] = csvContent.trim().split("\n");
  const existingIds = new Set(rows.map(row => row.split(",")[1]));

  console.log(`Existing artists in CSV: ${existingIds.size}`);

  // Find missing artists
  const missingArtists = [];
  for (const band of bands) {
    const spotifyId = extractSpotifyId(band.spotify);
    if (spotifyId && !existingIds.has(spotifyId)) {
      missingArtists.push({ name: band.name, id: spotifyId });
    }
  }

  console.log(`Found ${missingArtists.length} missing artists`);

  if (missingArtists.length === 0) {
    console.log("No new artists to add");
    fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `artists_added=false\n`);
    return;
  }

  // Add missing artists to CSV
  for (const artist of missingArtists) {
    rows.push(`${artist.name},${artist.id}`);
    console.log(`Added: ${artist.name} (${artist.id})`);
  }

  // Write updated CSV
  fs.writeFileSync(csvPath, [header, ...rows].join("\n"));
  console.log(`Updated CSV with ${missingArtists.length} new artists`);

  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `artists_added=true\n`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
