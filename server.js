
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import fetch from 'node-fetch';

async function proxy(req, res) {
    const BGG_API_TOKEN = process.env.BGG_API_TOKEN;
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const bggUrl = requestUrl.searchParams.get('url');

    if (!bggUrl) {
        console.error('Proxy Error: URL parameter is missing');
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('URL parameter is required');
    }

    console.log(`Proxying request to: ${bggUrl}`);

    try {
        const response = await fetch(bggUrl, {
            headers: {
                'Authorization': `Bearer ${BGG_API_TOKEN}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`BGG API responded with status ${response.status}: ${errorText}`);
            throw new Error(`BGG API responded with status ${response.status}`);
        }

        const data = await response.text();
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error fetching from BGG API: ${error.message}`);
    }
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/bgg-proxy')) {
        return proxy(req, res);
    }

    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    // Correctly resolve the file path
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    filePath = path.join(__dirname, filePath);


    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});
