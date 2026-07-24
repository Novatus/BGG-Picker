const { JSDOM } = require('jsdom');
const fs = require('fs');

const xml = `<?xml version="1.0" encoding="utf-8"?><items totalitems="1" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse" pubdate="Fri, 24 Jul 2026 16:10:00 +0000">
  <item objecttype="thing" objectid="12345" subtype="boardgame" collid="67890">
    <name sortindex="1">Game Title Here</name>
    <yearpublished>2020</yearpublished>
    <image>https://cf.geekdo-images.com/image.jpg</image>
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <stats minplayers="1" maxplayers="4">
      <rating value="N/A">
        <usersrated value="1000" />
        <average value="7.5" />
      </rating>
    </stats>
    <status own="1" prevowned="0" fortrade="0" want="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2025-01-01 00:00:00" />
    <numplays>0</numplays>
  </item>
</items>`;

const dom = new JSDOM("");
const parser = new dom.window.DOMParser();
const xmlDoc = parser.parseFromString(xml, "text/xml");

const items = xmlDoc.getElementsByTagName("item");
const games = [];
for (let i = 0; i < items.length; i++) {
    const numPlaysNode = items[i].querySelector("numplays");
    console.log("numPlaysNode:", numPlaysNode ? numPlaysNode.outerHTML : null);
    if (numPlaysNode && numPlaysNode.textContent === "0") {
        const nameNode = items[i].querySelector("name");
        console.log("nameNode:", nameNode ? nameNode.outerHTML : null);
        if (nameNode) {
            games.push({
                id: items[i].getAttribute('objectid'),
                name: nameNode.textContent,
                thumbnail: items[i].querySelector("thumbnail")?.textContent || 'fallback'
            });
        }
    }
}
console.log("Parsed games:", games);
