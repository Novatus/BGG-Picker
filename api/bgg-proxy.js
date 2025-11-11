
module.exports = async (req, res) => {
    const BGG_API_TOKEN = process.env.BGG_API_TOKEN;
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('URL parameter is required');
    }

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${BGG_API_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`BGG API responded with status ${response.status}`);
        }

        const data = await response.text();
        res.setHeader('Content-Type', 'application/xml');
        res.status(200).send(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).send(`Error fetching from BGG API: ${error.message}`);
    }
};