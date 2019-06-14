import express from "express";
import http from "http";
import path from "path";

const app = express();

app.set("view engine", "ejs");
app.set("views", "public");

console.log(__dirname)
app.use("/assets", express.static(path.join(__dirname, "../client")));

app.get("/*", (req, res) => {
	res.render("index");
});

export const start = (port: number): Promise<void> => {
	const server = http.createServer(app);

	return new Promise<void>((resolve, reject) => {
		server.listen(port, resolve);
	});
};
