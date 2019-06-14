"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const app = express_1.default();
app.set("view engine", "ejs");
app.set("views", "public");
console.log(__dirname);
app.use("/assets", express_1.default.static(path_1.default.join(__dirname, "../client")));
app.get("/*", (req, res) => {
    res.render("index");
});
exports.start = (port) => {
    const server = http_1.default.createServer(app);
    return new Promise((resolve, reject) => {
        server.listen(port, resolve);
    });
};
//# sourceMappingURL=server.js.map