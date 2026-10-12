import { createServer } from "node:http";
import { handleRequest } from "./http.js";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4317);
if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
  throw new Error("HOST must be a loopback address (127.0.0.1, localhost, or ::1)");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");

const server = createServer((req, res) => {
  void handleRequest(req, res).catch(() => {
    if (!res.headersSent) { res.writeHead(500, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify({ error: "internal_error", message: "Request could not be completed" })); }
    else res.destroy();
  });
});
server.listen(port, host, () => console.log(`Workflow Setup listening at http://${host}:${port}`));
