const fs = require("fs");
const acorn = require("./server/node_modules/acorn");
const source = fs.readFileSync("./server/server.js", "utf8");
const t = acorn.tokenizer(source, { ecmaVersion: "latest", locations: true });
const stack = [];

while (true) {
    const x = t.getToken();
    const v = x.type.label;
    if (v === "eof") break;

    if (["(", "{", "[", "${"].includes(v)) {
        stack.push({ open: v, line: x.loc.start.line, column: x.loc.start.column + 1 });
    } else if ([")", "}", "]"].includes(v)) {
        const top = stack[stack.length - 1];
        const ok = v === ")" ? top?.open === "(" :
                   v === "]" ? top?.open === "[" :
                   top?.open === "{" || top?.open === "${";

        if (ok) stack.pop();
        else console.log("Unexpected closing:", v, "line:", x.loc.start.line);
    }
}

console.log("UNCLOSED OPENINGS:");
console.log(stack);
