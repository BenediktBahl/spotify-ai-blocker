# Spotify AI Blocker

**Block AI-generated music on Spotify** using a crowd-sourced list. This project collects artists making AI-music and blocks them automatically with a userscript.

> [!CAUTION]
> Spotify doesn’t provide a public API to block artists, so this userscript uses a workaround by capturing Spotify’s tokens and mimicking internal requests from Spotify’s web client. Using unofficial API requests may violate Spotify's Terms of Service.

## How It Works
1. **List Fetching:** Loads daily a crowd-sourced CSV list of artists generating AI-music from GitHub.
2. **Token Capture:** Hooks into Spotify’s internal `fetch` requests to extract the access token.
3. **Username Detection:** retrieves the logged-in username from Spotify’s `localStorage`.
4. **Blocking:** Sends POST requests with access token and username to Spotify’s private API to block each artist.
5. **Persistence:** Remembers blocked artists and last run date using `localStorage` to prevent duplicate requests.

## Installation
1. Install a userscript manager (e.g. Tampermonkey, Violentmonkey).
2. Visit the script on [GreasyFork](https://greasyfork.org/en/users/21515) or [GitHub](https://github.com/CennoxX/userscripts).
3. Click **Install** and confirm.

## Support
Found an AI-music generating artist? [Add an AI artist using GitHub](https://github.com/CennoxX/spotify-ai-blocker/issues/new?template=ai-artist.yml) or [send a mail](mailto:cesar.bernard@gmx.de). 

Other problems? [Open an issue](https://github.com/CennoxX/spotify-ai-blocker/issues/new). 
