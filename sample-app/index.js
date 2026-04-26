import http from "http";
import os from "os";

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  const body = JSON.stringify({
    message: "Hello from the Brimble sample app",
    hostname: os.hostname(),
    path: req.url,
    time: new Date().toISOString(),
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`sample-app listening on port ${PORT}`);
});
