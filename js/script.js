const pickGameBtn = document.getElementById('pickGameBtn');
const usernameInput = document.getElementById('username');
const maxPlayersInput = document.getElementById('maxPlayers');
const resultDiv = document.getElementById('result');
const expansionHeader = document.getElementById('expansion-header');
const expansionList = document.getElementById('expansion-list');
const expansionArrow = document.getElementById('expansion-arrow');

// Cache object to store fetched data
let cachedData = {
    username: null,
    unplayedGames: [],
    filteredExpansions: [],
    detailsMap: new Map()
};

pickGameBtn.addEventListener('click', findRandomUnplayedGame);

expansionHeader.addEventListener('click', () => {
    expansionList.classList.toggle('hidden');
    expansionArrow.classList.toggle('rotate-180');
});

async function findRandomUnplayedGame() {
    const username = usernameInput.value.trim();
    const maxPlayers = parseInt(maxPlayersInput.value, 10);

    if (!username) {
        displayMessage('Please enter a BGG username.', 'error');
        return;
    }
    if (isNaN(maxPlayers) || maxPlayers < 1) {
        displayMessage('Please enter a valid number for max players.', 'error');
        return;
    }

    pickGameBtn.disabled = true;
    resultDiv.innerHTML = `<div class="flex flex-col items-center justify-center space-y-4"><div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12"></div><p id="loading-text" class="text-gray-500 dark:text-gray-400">Please wait...</p></div>`;
    const loadingText = document.getElementById('loading-text');

    try {
        // Check if we have valid cached data for the current user
        if (cachedData.username !== username) {
            loadingText.textContent = 'Fetching collection...';
            const { baseGamesXml, expansionsXml } = await fetchCollection(username);
            const parser = new DOMParser();

            const baseGamesDoc = parser.parseFromString(baseGamesXml, "text/xml");
            if (baseGamesDoc.querySelector("error")) throw new Error(baseGamesDoc.querySelector("message").textContent);
            cachedData.unplayedGames = parseItems(baseGamesDoc);

            const expansionsDoc = parser.parseFromString(expansionsXml, "text/xml");
            if (expansionsDoc.querySelector("error")) throw new Error(expansionsDoc.querySelector("message").textContent);
            cachedData.filteredExpansions = parseItems(expansionsDoc);

            cachedData.detailsMap.clear(); // Clear old details
            const allUnplayedItems = [...cachedData.unplayedGames, ...cachedData.filteredExpansions];

            if (allUnplayedItems.length > 0) {
                const chunkSize = 20;
                const idChunks = [];
                for (let i = 0; i < allUnplayedItems.length; i += chunkSize) {
                    idChunks.push(allUnplayedItems.slice(i, i + chunkSize).map(g => g.id).join(','));
                }

                for (let i = 0; i < idChunks.length; i++) {
                    loadingText.textContent = `Fetching game details (Batch ${i + 1} of ${idChunks.length})...`;
                    const xml = await fetchGameDetails(idChunks[i]);
                    const detailsDoc = parser.parseFromString(xml, "text/xml");
                    const chunkMap = parseGameDetails(detailsDoc);
                    for (const [key, value] of chunkMap.entries()) {
                        cachedData.detailsMap.set(key, value);
                    }
                    if (i < idChunks.length - 1) await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            cachedData.username = username; // Cache is now valid for this user
        }

        populateUnplayedList(cachedData.unplayedGames, cachedData.filteredExpansions, cachedData.detailsMap);

        if (cachedData.unplayedGames.length > 0) {
            const filteredGames = cachedData.unplayedGames.filter(game => {
                const details = cachedData.detailsMap.get(game.id);
                return details && maxPlayers >= details.min && maxPlayers <= details.max;
            });

            if (filteredGames.length > 0) {
                setupSlotMachine(filteredGames, maxPlayers);
            } else {
                displayMessage(`No unplayed games found for a max player count of ${maxPlayers}.`, 'info');
            }
        } else {
            displayMessage('Found 0 unplayed base games in your collection!', 'info');
        }

    } catch (error) {
        console.error("Error:", error);
        displayMessage(`Error: ${error.message}. Check the username and try again.`, 'error');
        cachedData = { username: null, unplayedGames: [], filteredExpansions: [], detailsMap: new Map() }; // Clear cache on error
        populateUnplayedList([], [], new Map());
    } finally {
         pickGameBtn.disabled = false;
    }
}

function parseItems(xmlDoc) {
    const items = xmlDoc.getElementsByTagName("item");
    const games = [];
    for (let i = 0; i < items.length; i++) {
        const numPlaysNode = items[i].querySelector("numplays");
        if (numPlaysNode && numPlaysNode.textContent === "0") {
            const nameNode = items[i].querySelector("name");
            if (nameNode) {
                games.push({
                    id: items[i].getAttribute('objectid'),
                    name: nameNode.textContent,
                    thumbnail: items[i].querySelector("thumbnail")?.textContent || 'https://placehold.co/140x140/eeeeee/cccccc?text=No+Image'
                });
            }
        }
    }
    return games;
}

function parseGameDetails(xmlDoc) {
    const detailsMap = new Map();
    const items = xmlDoc.getElementsByTagName("item");
    for (const item of items) {
        const id = item.getAttribute('id');
        const minPlayers = item.querySelector('minplayers')?.getAttribute('value');
        const maxPlayers = item.querySelector('maxplayers')?.getAttribute('value');
        if (id && minPlayers && maxPlayers) {
            detailsMap.set(id, { min: parseInt(minPlayers), max: parseInt(maxPlayers) });
        }
    }
    return detailsMap;
}

function populateUnplayedList(games, expansions, detailsMap) {
    const listContainer = document.getElementById('unplayed-list-container');
    const listEl = document.getElementById('unplayed-list');
    const expansionListEl = document.getElementById('expansion-list');
    if (!listEl || !listContainer || !expansionListEl) return;

    listContainer.classList.remove('hidden');
    expansionListEl.classList.remove('hidden');
    expansionArrow.classList.remove('rotate-180');

    const createGameHtml = (game) => {
        const details = detailsMap.get(game.id);
        const playerCountStr = details ? `${details.min}-${details.max}` : '?';
        const playerIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 inline-block" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>`;
        return `
            <div class="flex items-center p-2 mb-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">
                <img src="${game.thumbnail}" alt="${game.name}" class="w-12 h-12 object-cover rounded-md mr-4 flex-shrink-0" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/48x48/eeeeee/cccccc?text=N/A';">
                <span class="font-medium text-sm text-left flex-grow">${game.name}</span>
                <span class="ml-4 px-2 py-1 text-xs font-semibold text-gray-700 bg-gray-200 dark:text-gray-200 dark:bg-gray-600 rounded-full flex-shrink-0 flex items-center">${playerIcon} ${playerCountStr}</span>
            </div>
        `;
    };

    if (games.length === 0) {
        listEl.innerHTML = `<p class="text-gray-500 dark:text-gray-400 text-center mt-8">No unplayed base games found.</p>`;
        listContainer.querySelector('h2').textContent = 'Unplayed Games';
    } else {
        listContainer.querySelector('h2').textContent = `Unplayed Games (${games.length})`;
        const sortedGames = [...games].sort((a, b) => a.name.localeCompare(b.name));
        listEl.innerHTML = sortedGames.map(game => `<a href="https://boardgamegeek.com/boardgame/${game.id}" target="_blank" rel="noopener noreferrer" class="block">${createGameHtml(game)}</a>`).join('');
    }

    if (expansions.length === 0) {
        expansionListEl.innerHTML = `<p class="text-gray-500 dark:text-gray-400 text-center text-sm">No expansions were filtered out.</p>`;
    } else {
        const sortedExpansions = [...expansions].sort((a, b) => a.name.localeCompare(b.name));
        expansionListEl.innerHTML = sortedExpansions.map(game => `<a href="https://boardgamegeek.com/boardgame/${game.id}" target="_blank" rel="noopener noreferrer" class="block opacity-70">${createGameHtml(game)}</a>`).join('');
    }
}

function setupSlotMachine(games, maxPlayers) {
    const unplayedCount = games.length;
    resultDiv.innerHTML = `<p class="mb-4 text-gray-500 dark:text-gray-400">Found ${unplayedCount} unplayed games for ${maxPlayers} players. Spinning!</p><div id="slot-container" class="w-full h-40 overflow-hidden relative flex items-center justify-start"><div id="slot-reel" class="flex flex-row items-center h-full" style="transform: translateX(0px);"></div></div><div id="final-result" class="mt-4 text-center text-2xl font-semibold min-h-[250px]"></div>`;

    const reel = document.getElementById('slot-reel');
    const slotContainer = document.getElementById('slot-container');
    const shuffledGames = [...games].sort(() => Math.random() - 0.5);
    const reelItems = [...shuffledGames, ...shuffledGames, ...shuffledGames, ...shuffledGames, ...shuffledGames];

    reel.innerHTML = reelItems.map(game => `<div class="slot-item mx-2 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-lg p-2 text-center"><img src="${game.thumbnail}" alt="${game.name}" class="w-20 h-20 object-cover rounded-md mb-1" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/80x80/eeeeee/cccccc?text=No+Img';"><span class="text-xs font-medium truncate w-full">${game.name}</span></div>`).join('');

    const winner = games[Math.floor(Math.random() * games.length)];
    const winnerIndexInMiddle = shuffledGames.findIndex(g => g.name === winner.name) + (shuffledGames.length * 2);

    const itemWidth = 140 + 16;
    const containerWidth = slotContainer.offsetWidth;
    const randomOffset = (Math.random() - 0.5) * itemWidth * 0.8;
    const finalPosition = - (winnerIndexInMiddle * itemWidth - (containerWidth / 2) + (itemWidth / 2) - randomOffset);

    setTimeout(() => {
        reel.style.transition = 'transform 7000ms cubic-bezier(0.25, 0.1, 0.2, 1)';
        reel.style.transform = `translateX(${finalPosition}px)`;
    }, 100);

    reel.addEventListener('transitionend', () => {
        document.getElementById('final-result').innerHTML = `<p class="mb-2">It's time for:</p><a href="https://boardgamegeek.com/boardgame/${winner.id}" target="_blank" rel="noopener noreferrer" class="group inline-block"><strong class="text-2xl text-blue-500 dark:text-blue-400 group-hover:underline">${winner.name}!</strong><img src="${winner.thumbnail}" alt="Box art for ${winner.name}" class="mt-4 mx-auto rounded-lg shadow-md max-w-[200px] group-hover:opacity-80 transition-opacity" onerror="this.onerror=null;this.src='https://placehold.co/200x200/eeeeee/cccccc?text=No+Image';"></a>`;
    }, { once: true });
}

async function fetchCollection(username) {
    const baseUrl = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&stats=1&own=1`;
    const baseGamesUrl = `${baseUrl}&excludesubtype=boardgameexpansion`;
    const expansionsUrl = `${baseUrl}&subtype=boardgameexpansion`;

    const [baseGamesXml, expansionsXml] = await Promise.all([
        fetchWithRetries(baseGamesUrl),
        fetchWithRetries(expansionsUrl)
    ]);

    return { baseGamesXml, expansionsXml };
}

async function fetchGameDetails(ids) {
    if (!ids) return "<items></items>"; // Return empty XML if no IDs
    const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&stats=1`;
    return await fetchWithRetries(url);
}

async function fetchWithRetries(bggUrl) {
    let attempts = 0;
    const proxyUrl = `/api/bgg-proxy?url=${encodeURIComponent(bggUrl)}`;
    while (attempts < 5) {
        try {
            const response = await fetch(proxyUrl);
            if (response.status === 200) {
                const text = await response.text();
                if (text.includes("Your request for collection has been accepted")) {
                     attempts++;
                     const loadingText = document.getElementById('loading-text');
                     if(loadingText) loadingText.textContent = `BGG queued request. Retrying... (${attempts}/5)`;
                     await new Promise(resolve => setTimeout(resolve, 5000));
                     continue;
                }
                return text;
            } else if (response.status === 202) {
                 attempts++;
                 const loadingText = document.getElementById('loading-text');
                 if(loadingText) loadingText.textContent = `BGG queued request. Retrying... (${attempts}/5)`;
                 await new Promise(resolve => setTimeout(resolve, 5000));
            }
            else {
                attempts++;
                const loadingText = document.getElementById('loading-text');
                if(loadingText) loadingText.textContent = `API request failed with status ${response.status}. Retrying... (${attempts}/5)`;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            attempts++;
            console.error(`Fetch attempt ${attempts} failed:`, error);
            const loadingText = document.getElementById('loading-text');
            if(loadingText) loadingText.textContent = `Network error. Retrying... (${attempts}/5)`;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    throw new Error('Could not retrieve collection from BGG. Please try again later.');
}


function displayMessage(message, type) {
    let messageClass = '';
    if (type === 'error') messageClass = 'text-red-500 dark:text-red-400';
    if (type === 'success') messageClass = 'text-gray-700 dark:text-gray-300';
    if (type === 'info') messageClass = 'text-yellow-600 dark:text-yellow-400';
    resultDiv.innerHTML = `<div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-700 ${messageClass}">${message}</div>`;
}