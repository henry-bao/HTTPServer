import fs from 'fs';
import { extname } from 'path';
import { parse } from 'url';
import { Socket, createServer } from 'net';

function getMimeType(filePath: string) {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.txt': 'text/plain',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function sendHttpCat(param: { socket: Socket; statusCode: number; statusMessage: string }) {
    const { socket, statusCode, statusMessage } = param;
    const httpCatUrl = `https://http.cat/${statusCode}.jpg`;
    const html = `<!DOCTYPE html><html lang="en"><body><img src="${httpCatUrl}" /></body></html>`;
    sendResponse({
        socket,
        statusCode,
        statusMessage,
        contentType: 'text/html',
        content: html,
    });
}

function sendResponse(param: {
    socket: Socket;
    statusCode: number;
    statusMessage: string;
    contentType: string;
    content: string | Buffer;
    allow?: string;
}) {
    const { socket, statusCode, statusMessage, contentType, content, allow } = param;
    const response = `HTTP/1.1 ${statusCode} ${statusMessage}\r\nContent-Type: ${contentType}\r\nContent-Length: ${Buffer.byteLength(
        content
    )}${allow ? `\r\nAllow: ${allow}` : ''}\r\n\r\n${content}`;
    socket.write(response);
    socket.end();
}

const server = createServer((socket) => {
    socket.on('data', (data) => {
        const request = data.toString();
        const requestEndIndex = request.indexOf('\r\n\r\n');

        if (requestEndIndex >= 0) {
            const requestHeaders = request.slice(0, requestEndIndex).split('\r\n');
            const [requestMethod, requestPath] = requestHeaders[0].split(' ');

            const parsedUrl = parse(requestPath || '', true);
            const filePath = `public${parsedUrl.pathname}`;

            console.log({ requestMethod, requestPath });

            switch (requestMethod) {
                case 'GET':
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            sendHttpCat({ socket, statusCode: 404, statusMessage: 'Not Found' });
                        } else {
                            const mimeType = getMimeType(filePath);
                            sendResponse({
                                socket,
                                statusCode: 200,
                                statusMessage: 'OK',
                                contentType: mimeType,
                                content: data,
                            });
                        }
                    });
                    break;

                case 'POST':
                    if (getMimeType(filePath) !== 'text/plain') {
                        sendHttpCat({ socket, statusCode: 415, statusMessage: 'Unsupported Media Type' });
                        break;
                    }
                    fs.appendFile(filePath, request.slice(requestEndIndex + 4), (err) => {
                        if (err) {
                            sendHttpCat({ socket, statusCode: 500, statusMessage: 'Internal Server Error' });
                        } else {
                            sendResponse({
                                socket,
                                statusCode: 200,
                                statusMessage: 'OK',
                                contentType: 'text/plain',
                                content: 'Data appended',
                            });
                        }
                    });
                    break;

                case 'PUT':
                    fs.writeFile(filePath, request.slice(requestEndIndex + 4), (err) => {
                        if (err) {
                            sendHttpCat({ socket, statusCode: 500, statusMessage: 'Internal Server Error' });
                        } else {
                            sendResponse({
                                socket,
                                statusCode: 200,
                                statusMessage: 'OK',
                                contentType: 'text/plain',
                                content: 'File created or overwritten',
                            });
                        }
                    });
                    break;

                case 'DELETE':
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            sendHttpCat({ socket, statusCode: 404, statusMessage: 'Not Found' });
                        } else {
                            sendResponse({
                                socket,
                                statusCode: 200,
                                statusMessage: 'OK',
                                contentType: 'text/plain',
                                content: 'File deleted',
                            });
                        }
                    });
                    break;

                case 'OPTIONS':
                    const allowedMethods = ['GET', 'HEAD', 'PUT', 'DELETE'];
                    if (getMimeType(filePath) === 'text/plain') {
                        allowedMethods.push('POST');
                    }
                    sendResponse({
                        socket,
                        statusCode: 200,
                        statusMessage: 'OK',
                        contentType: 'text/plain',
                        content: '',
                        allow: allowedMethods.join(', '),
                    });
                    break;

                case 'HEAD':
                    fs.readFile(filePath, (err) => {
                        const mimeType = getMimeType(filePath);
                        sendResponse({
                            socket,
                            statusCode: err ? 404 : 200,
                            statusMessage: err ? 'Not Found' : 'OK',
                            contentType: mimeType,
                            content: '',
                        });
                    });
                    break;

                default:
                    sendHttpCat({ socket, statusCode: 405, statusMessage: 'Method Not Allowed' });
            }
        }
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
