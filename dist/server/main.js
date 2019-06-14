"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const server_1 = require("./server");
async function main() {
    await server_1.start(config_1.SERVER_PORT);
    console.log(`Server started at http://localhost:${config_1.SERVER_PORT}`);
}
main().catch(error => console.error(error));
//# sourceMappingURL=main.js.map