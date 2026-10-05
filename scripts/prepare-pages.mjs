import { copyFileSync, writeFileSync } from "node:fs"

const shell = "dist/client/_shell.html"
copyFileSync(shell, "dist/client/index.html")
copyFileSync(shell, "dist/client/404.html")
writeFileSync("dist/client/.nojekyll", "")
