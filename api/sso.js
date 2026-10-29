// 現場管理アプリからのシングルサインオン。
// 現場管理アプリが発行した「60秒だけ有効な署名付きチケット」を受け取り、
// メンバー名簿(members)で同じ氏名の人が「ちょうど1人」・ログインあり・有効なら、その人としてログインするためのトークンを返す。
// 一致しない/複数いる場合は何もしない(通常のログイン画面になる)。
// 環境変数: FIREBASE_SERVICE_ACCOUNT(account.js と同じ)、SSO_SECRET(現場管理アプリと同じ値・16文字以上)
const admin = require("firebase-admin");
const crypto = require("crypto");

const norm = (v) => String(v == null ? "" : v).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function init() {
  if (admin.apps.length) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return true;
}

function readTicket(ticket, secret) {
  const parts = String(ticket || "").split(".");
  if (parts.length !== 2) return null;
  const want = b64u(crypto.createHmac("sha256", secret).update(parts[0]).digest());
  const x = Buffer.from(want), y = Buffer.from(parts[1]);
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch (e) { return null; }
  if (!p || !p.n || p.k !== "j" || typeof p.exp !== "number" || Date.now() > p.exp || p.exp - Date.now() > 5 * 60000) return null;
  return { n: String(p.n) };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "POST only" }); }
  try {
    const secret = String(process.env.SSO_SECRET || "").trim();
    if (secret.length < 16) return res.status(200).json({ ok: false, error: "not-configured" });
    const body = req.body && typeof req.body === "object" ? req.body : (() => { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } })();
    const tk = readTicket(body.ticket, secret);
    if (!tk) return res.status(200).json({ ok: false, error: "bad-ticket" });
    if (!init()) return res.status(200).json({ ok: false, error: "not-configured" });
    const key = norm(tk.n);
    const snap = await admin.firestore().collection("members").get();
    const hits = snap.docs.map((d) => d.data() || {}).filter((m) => norm(m.name) === key && m.uid && m.active !== false);
    if (hits.length !== 1) return res.status(200).json({ ok: false, error: hits.length ? "ambiguous" : "no-match" });
    const u = await admin.firestore().doc("users/" + hits[0].uid).get();
    if (!u.exists || ["member", "admin"].indexOf((u.data() || {}).role) < 0) return res.status(200).json({ ok: false, error: "no-account" });
    const token = await admin.auth().createCustomToken(hits[0].uid);
    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(200).json({ ok: false, error: "server" });
  }
};
