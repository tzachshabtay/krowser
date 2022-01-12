import { SERVER_PORT } from "./config";

import { start } from "./server";

async function main() {
	await start(SERVER_PORT);
	console.log(`Server started at http://localhost:${SERVER_PORT}`);
}

main().catch(error => console.error(error));
