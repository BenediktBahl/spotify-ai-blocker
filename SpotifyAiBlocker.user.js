// ==UserScript==
// @name         Spotify AI Artist Blocker
// @version      0.1.5
// @description  Automatically block AI-generated artists on Spotify using a crowd-sourced list
// @author       CennoxX
// @namespace    https://greasyfork.org/users/21515
// @homepage     https://github.com/CennoxX/spotify-ai-blocker
// @supportURL   https://github.com/CennoxX/spotify-ai-blocker/issues/new
// @match        https://open.spotify.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spotify.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @license      MIT
// ==/UserScript==
/* jshint esversion: 11 */

(async function() {
    "use strict";

    const CSV_URL = "https://raw.githubusercontent.com/CennoxX/spotify-ai-blocker/refs/heads/main/SpotifyAiArtists.csv";
    const STORAGE_KEY = "spotifyBlockedArtists";
    const LAST_RUN_KEY = "spotifyBlockerLastRun";
    const today = new Date().toISOString().slice(0, 10);

    const getBlocked = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const addBlocked = id => { const b = getBlocked(); b.includes(id) || (b.push(id), localStorage.setItem(STORAGE_KEY, JSON.stringify(b))) };
    const hasRunToday = () => localStorage.getItem(LAST_RUN_KEY) == today;
    const setLastRun = d => localStorage.setItem(LAST_RUN_KEY, d);
    let authHeader;

    async function fetchArtistList() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: CSV_URL,
                onload: r => {
                    const a = r.responseText.split("\n").slice(1).map(l => l.split(",").map(s => s.trim())).filter(([n, id]) => n && id).map(([name, id]) => ({ name, id }));
                    resolve(a);
                },
                onerror: reject
            });
        });
    }

    function getUsername() {
        const username = Object.keys(localStorage).find(k => k.includes(":") && !k.startsWith("anonymous:"))?.split(":")[0];
        if (!username)
            alert("Username not found.");
        return username;
    }

    async function blockArtist(id) {
        const username = getUsername();
        if (!authHeader || !username)
            return false;

        try {
            const response = await fetch("https://spclient.wg.spotify.com/collection/v2/write?market=from_token", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "authorization": authHeader,
                },
                body: JSON.stringify({
                    username: username,
                    set: "artistban",
                    items: [{ uri: `spotify:artist:${id}` }]
                })
            });
            if (response.ok)
                return true;
            if (response.status == 401)
                localStorage.removeItem("spotifyAccessToken");
        } catch (e) {
            console.error("blockArtist error:", e);
        }
        return false;
    }

    async function main() {
        try {
            const artists = await fetchArtistList();
            const blocked = getBlocked();
            const toBlock = artists.filter(a => !blocked.includes(a.id));
            console.log(`Loaded ${artists.length} artists, ${toBlock.length} to block`);
            if (!toBlock.length)
                console.log("No new artists to ban.");
            let done = 0;
            for (const a of toBlock) {
                const result = await blockArtist(a.id);
                if (result) {
                    addBlocked(a.id);
                    console.log(`Banned ${a.name} (${++done}/${toBlock.length})`);
                } else {
                    console.log(`Failed to block ${a.id}`);
                }
            }
            setLastRun(today);
            console.log("Finished blocking artists.");
        } catch (e) {
            console.error("Error in Spotify AI Artist Blocker:", e);
        }
    }

    function addFetchWrapper() {
        const originalFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function (...args) {
            const [, init] = args;
            authHeader = init?.headers?.authorization;
            if (authHeader) {
                unsafeWindow.fetch = originalFetch;
                if (!hasRunToday())
                    main();
            }
            return originalFetch.apply(this, args);
        };
    }

    function getArtistInfo() {
        const el = document.querySelector('.Root [data-testid="now-playing-bar"] [data-testid="context-item-info-artist"]');
        return { name: el?.innerText, url: el?.href, id: el?.href?.match(/\/artist\/([^\s]+)/i)?.[1] };
    }

    GM_registerMenuCommand("Report AI Artist in GitHub", async() => {
        const { name, url, id } = getArtistInfo();
        await blockArtist(id);
        window.open(`https://github.com/CennoxX/spotify-ai-blocker/issues/new?template=ai-artist.yml&title=[AI-Artist]%20${name}&artist_url=${url}&artist_name=${name}`);
    });

    GM_registerMenuCommand("Report AI Artist per Mail", async() => {
        const { name, url, id } = getArtistInfo();
        await blockArtist(id);
        window.open(`mailto:${atob("Y2VzYXIuYmVybmFyZEBnbXguZGU=")}?subject=${encodeURIComponent(`AI Artist: ${name}`)}&body=${encodeURIComponent(`Report: ${name} - ${url}`)}`);
    });

    GM_registerMenuCommand("Copy AI Artist name and ID", async() => {
        const { name, id } = getArtistInfo();
        await blockArtist(id);
        GM_setClipboard(`${name},${id}`, "text");
    });

    addFetchWrapper();
})();
