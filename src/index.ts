import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

function getMimeType(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.txt': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function sendHttpCat(res: http.ServerResponse, statusCode: number) {
    const httpCatUrl = `https://http.cat/${statusCode}.jpg`;
    res.writeHead(statusCode, {
        'Content-Type': 'text/html',
    }).end(`<!DOCTYPE html><html lang="en"><body><img src="${httpCatUrl}" /></body></html>`);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const filePath = `public/${parsedUrl.pathname}`;

    switch (req.method) {
        case 'GET':
            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    sendHttpCat(res, 404);
                } else {
                    const mimeType = getMimeType(filePath);
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': stats.size,
                    });
                    fs.createReadStream(filePath).pipe(res);
                }
            });
            break;

        case 'POST':
            if (getMimeType(filePath) === 'text/plain') {
                const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
                req.pipe(writeStream);
                req.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Data appended');
                });
            } else {
                sendHttpCat(res, 415);
            }
            break;

        case 'PUT':
            const writeStream = fs.createWriteStream(filePath);
            req.pipe(writeStream);
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('File created or overwritten');
            });
            break;

        case 'DELETE':
            fs.unlink(filePath, (err) => {
                if (err) {
                    sendHttpCat(res, 404);
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('File deleted');
                }
            });
            break;

        case 'OPTIONS':
            const allowedMethods = ['GET'];
            if (getMimeType(filePath) === 'text/plain') {
                allowedMethods.push('POST', 'PUT', 'DELETE');
            } else if (getMimeType(filePath) === 'text/html') {
                allowedMethods.push('PUT', 'DELETE');
            }
            res.writeHead(200, {
                'Content-Type': 'text/plain',
                Allow: allowedMethods.join(', '),
            });
            res.end();
            break;

        case 'HEAD':
            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    sendHttpCat(res, 404);
                } else {
                    const mimeType = getMimeType(filePath);
                    console.log(mimeType);
                    res.writeHead(200, {
                        'Content-Type': mimeType,
                        'Content-Length': stats.size,
                    });
                    res.end();
                }
            });
            break;

        default:
            sendHttpCat(res, 405);
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
