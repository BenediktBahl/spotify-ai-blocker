const fs = require("fs");
const path = require("path");
const https = require("https");

const AI_BLOCKLIST_URL = "https://raw.githubusercontent.com/eye-wave/spotify-ai-blocklist/refs/heads/main/ai-list.txt";
const csvPath = path.resolve(__dirname, "../../SpotifyAiArtists.csv");

// Spotify API credentials from GitHub secrets
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = "";
      res. on("data", (chunk) => data += chunk);
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

function postJSON(url, data, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers:  {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(data),
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => responseData += chunk);
      res.on("end", () => {
        try {
          resolve(JSON. parse(responseData));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getSpotifyAccessToken() {
  console.log("Fetching Spotify access token...");
  const data = "grant_type=client_credentials";
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
    const response = await postJSON(
    "https://accounts.spotify.com/api/token",
    data,
    { "Authorization": `Basic ${auth}` }
  );
  return response.access_token;
}

async function getArtistNames(artistIds, accessToken) {
  console.log(`Fetching artist names for ${artistIds.length} artists...`);
  const artists = [];
  // Process in batches of 50 (Spotify API limit)
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    const ids = batch.join(",");
    const url = `https://api.spotify.com/v1/artists?ids=${encodeURIComponent(ids)}`;
    const response = await fetchJSON(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    for (const artist of response.artists) {
      if (artist) {
        artists.push({
          id: artist.id,
          name: artist.name
        });
      }
    }
    // Rate limiting:  wait a bit between batches
    if (i + 50 < artistIds.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  return artists;
}

function extractSpotifyId(url) {
  if (!url) return null;
  const match = url.match(/spotify\.com\/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

async function run() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in GitHub secrets");
  }

  console.log("Fetching AI blocklist data...");
  const blocklistText = await fetchText(AI_BLOCKLIST_URL);
  const urls = blocklistText.trim().split("\n").filter(line => line.trim());
  console.log(`Fetched ${urls.length} artist URLs`);

  // Extract Spotify IDs from URLs
  const blocklistIds = urls
    .map(url => extractSpotifyId(url))
    .filter(id => id !== null);
  
  console.log(`Extracted ${blocklistIds.length} valid Spotify IDs`);

  // Read existing CSV
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const [header, ...rows] = csvContent.trim().split("\n");
  
  // Extract existing IDs
  const existingIds = new Set();
  for (const row of rows) {
    const lastCommaIndex = row.lastIndexOf(",");
    if (lastCommaIndex > 0) {
      const id = row. substring(lastCommaIndex + 1);
      existingIds. add(id);
    }
  }

  console.log(`Existing artists in CSV: ${existingIds. size}`);

  // Find missing artist IDs
  const missingIds = blocklistIds.filter(id => ! existingIds.has(id));
  console.log(`Found ${missingIds.length} missing artist IDs`);

  if (missingIds.length === 0) {
    console.log("No new artists to add");
    fs.appendFileSync(process. env.GITHUB_OUTPUT || "/dev/null", `artists_added=0\n`);
    return;
  }

  // Get Spotify access token
  const accessToken = await getSpotifyAccessToken();

  // Fetch artist names from Spotify API
  const artists = await getArtistNames(missingIds, accessToken);
  console.log(`Retrieved ${artists.length} artist names from Spotify API`);

  // Add missing artists to CSV
  for (const artist of artists) {
    const name = artist.name.replace(/,/g, "_");
    rows.push(`${name},${artist.id}`);
    console.log(`Added: ${artist.name} (${artist.id})`);
  }

  // Write updated CSV
  fs.writeFileSync(csvPath, [header, ...rows].join("\n") + "\n");
  fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `artists_added=${artists.length}\n`);
  console.log(`Updated CSV with ${artists.length} new artists`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
