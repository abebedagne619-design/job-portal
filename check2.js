const fs = require("fs");
const acorn = require("./server/node_modules/acorn");
const source = fs.readFileSync("./server/server.js", "utf8");
const tokenizer = acorn.tokenizer(source, {
    ecmaVersion: "latest",
    locations: true
});

const stack = [];

while (true) {
    const token = tokenizer.getToken();
    const type = token.type.label;

    if (type === "eof") break;

    if (["(", "{", "[", "${"].includes(type)) {
        stack.push({
            opening: type,
            line: token.loc.start.line,
            column: token.loc.start.column + 1
        });
    } else if ([")", "}", "]"].includes(type)) {
        const expected = {
            ")": "(",
            "}": "{",
            "]": "["
        }[type];

        if (stack.length && stack[stack.length - 1].opening === expected) {
            stack.pop();
        } else {
            console.log("Unexpected closing:", type, "at line", token.loc.start.line);
        }
    }
}

console.log("UNCLOSED BLOCKS:");
console.log(stack);
