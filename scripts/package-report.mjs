import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve("dist-report");
const output = resolve("output/interactive-report-2026");
mkdirSync(output, { recursive: true });
const snippet = readFileSync("docs/weebly-embed-2026.html", "utf8")
  .replaceAll(
    "https://lfac-pt.github.io/bms-report/report-2026.html",
    "https://YOUR-REPORT-HOST/index.html"
  )
  .replaceAll(
    "https://lfac-pt.github.io/bms-report/embed-report.js",
    "https://YOUR-REPORT-HOST/embed-report.js"
  );
writeFileSync(join(root, "weebly-embed.html"), snippet);
writeFileSync(
  join(root, "README.txt"),
  `Relatório interativo 2026 — Portugal continental\n\nGerado em ${new Date().toISOString()}.\n\n1. Alojar todo o conteúdo desta pasta num servidor HTTPS estático.\n2. Abrir index.html através do servidor (não diretamente como ficheiro local).\n3. Em weebly-embed.html, substituir https://YOUR-REPORT-HOST pelo endereço público da pasta.\n4. No Weebly: Embed Code > Edit Custom HTML; colar o bloco completo.\n5. Publicar e testar a página em computador e telemóvel.\n\nOs dados e fotografias são uma cópia dos ficheiros disponíveis na data de geração.\nOs fundos dos mapas precisam de internet. Os links de espécies e concelhos abrem a aplicação completa numa nova janela.\nOs créditos das fotografias são apresentados no relatório.\n`
);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [relative(root, path)];
  });
}
const archive = join(output, "report-2026-standalone.zip");
rmSync(archive, { force: true });
// zip's argument array avoids shell expansion; all inputs are generated build files.
execFileSync("zip", ["-q", "-r", archive, ...files(root)], { cwd: root });
// eslint-disable-next-line no-console
console.log(`Standalone report: ${root}\nArchive: ${archive}`);
