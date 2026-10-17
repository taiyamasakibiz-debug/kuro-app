// くろブリッジ（実験）: Mac の Claude Code CLI（`claude -p`）をアプリから呼ぶための中継サーバー。
// ブラウザのページは CLI を起動できないので、このサーバーが代わりに起動して答えを返す。
// - 依存なし（Node 18+）。`node bridge/server.mjs` で起動 → http://127.0.0.1:8787/（この Mac だけ）
// - `HOST=0.0.0.0 node bridge/server.mjs` で同じ Wi-Fi の iPhone からも届く
// - 起動のたびに6けたの合言葉を作って画面に出す。合言葉がないと聞けない。5回まちがえたら止まる
// - CLI は改造せずそのまま起動。ログインは Mac の Claude Code のもの（コードにキーは書かない）
// - ツールは全部オフ（--tools ""）。くろはファイルを読んだり書いたりできない、話すだけ
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { networkInterfaces } from "node:os";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const CLAUDE = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 120_000;
const page = new URL("./test.html", import.meta.url);

const CODE = String(randomInt(0, 1_000_000)).padStart(6, "0");
let misses = 0;
let busy = false;  // 同時に動かすのは1本だけ

function askClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence"];
    const child = spawn(CLAUDE, args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("時間切れ（2分）")); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const j = JSON.parse(out);
        if (j.is_error) return reject(new Error(j.result || "CLI がエラーを返した"));
        resolve({ text: j.result, ms: j.duration_ms, model: Object.keys(j.modelUsage || {})[0] || "" });
      } catch {
        reject(new Error(`CLI の出力を読めなかった（終了コード ${code}）: ${(err || out).slice(0, 300)}`));
      }
    });
    child.stdin.end(prompt);  // プロンプトは引数でなく標準入力で渡す
  });
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") return send(res, 200, await readFile(page, "utf8"), "text/html; charset=utf-8");
  if (req.method !== "POST" || req.url !== "/ask") return send(res, 404, { error: "not found" });
  // 別のサイトのページから勝手に呼ばれないように、同じ出どころだけ受ける
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return send(res, 403, { error: "origin" });
  if (misses >= 5) return send(res, 403, { error: "合言葉を5回まちがえたので止めた。サーバーを起動し直してね" });
  if (req.headers["x-kuro-code"] !== CODE) { misses++; return send(res, 401, { error: "合言葉がちがう" }); }
  if (busy) return send(res, 429, { error: "くろは今べつの返事を考え中" });

  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 20_000) return send(res, 413, { error: "長すぎ" }); }
  let prompt;
  try { prompt = String(JSON.parse(raw).prompt || "").trim(); } catch { return send(res, 400, { error: "JSON じゃない" }); }
  if (!prompt) return send(res, 400, { error: "prompt が空" });

  busy = true;
  try { send(res, 200, await askClaude(prompt)); }
  catch (e) { send(res, 500, { error: e.message }); }
  finally { busy = false; }
}).listen(PORT, HOST, () => {
  const lan = Object.values(networkInterfaces()).flat().find((a) => a.family === "IPv4" && !a.internal)?.address;
  console.log(`くろブリッジ: http://${HOST === "0.0.0.0" && lan ? lan : HOST}:${PORT}/`);
  console.log(`合言葉: ${CODE}`);
});
