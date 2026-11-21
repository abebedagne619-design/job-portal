const fs = require("fs");
const acorn = require("./server/node_modules/acorn");

try {
    acorn.parse(
        fs.readFileSync("server/server.js", "utf8"),
        { ecmaVersion: "latest", sourceType: "script" }
    );
    console.log("Syntax OK");
} catch (e) {
    console.log("ERROR:", e.message);
    console.log("LINE:", e.loc?.line);
    console.log("COLUMN:", e.loc?.column);
}
