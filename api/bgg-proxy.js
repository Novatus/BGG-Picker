
module.exports = async (req, res) => {
    const BGG_API_TOKEN = process.env.BGG_API_TOKEN;
    const { url } = req.query;

    console.log(`[BGG Proxy] Received request for URL: ${url}`);
    console.log(`[BGG Proxy] BGG_API_TOKEN is ${BGG_API_TOKEN ? 'present' : 'MISSING'}.`);

    if (!url) {
        console.error('[BGG Proxy] Error: URL parameter is required.');
        return res.status(400).send('URL parameter is required');
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${BGG_API_TOKEN}`
            }
        });

        console.log(`[BGG Proxy] Fetched from BGG API. Status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[BGG Proxy] BGG API responded with status ${response.status}:`, errorBody);
            throw new Error(`BGG API responded with status ${response.status}`);
        }

        const data = await response.text();
        res.setHeader('Content-Type', 'application/xml');
        res.status(200).send(data);
    } catch (error) {
        console.error('[BGG Proxy] Caught exception:', error);
        res.status(500).send(`Error fetching from BGG API: ${error.message}`);
    }
};