const http = require('http');
const proxy = require('./api/bgg-proxy.js');

const server = http.createServer((req, res) => {
    // Mock the req and res objects enough for the proxy to work
    const url = new URL(req.url, `http://${req.headers.host}`);
    req.query = { url: url.searchParams.get('url') };
    
    // Express-like methods used in proxy
    res.status = function(code) {
        this.statusCode = code;
        return this;
    };
    res.send = function(data) {
        this.end(data);
    };
    
    proxy(req, res);
});

server.listen(3000, () => {
    console.log('Proxy running on port 3000');
    
    // Make a request to the proxy
    fetch('http://localhost:3000/?url=' + encodeURIComponent('https://boardgamegeek.com/xmlapi2/collection?username=rahdo&stats=1&own=1'))
        .then(res => res.text())
        .then(xml => {
            console.log('XML response snippet (first 500 chars):');
            console.log(xml.substring(0, 500));
            
            // Try to find a numplays tag
            const numplaysMatch = xml.match(/<numplays.*?<\/numplays>/g);
            console.log('\nFound numplays tags:', numplaysMatch ? numplaysMatch.slice(0, 5) : 'None');
            
            server.close();
            process.exit(0);
        })
        .catch(err => {
            console.error(err);
            server.close();
            process.exit(1);
        });
});
