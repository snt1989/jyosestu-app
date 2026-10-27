// 【一時的】引き継ぎデータの取り込み用。取り込み後に削除します。
const crypto = require("crypto");
const admin = require("firebase-admin");
const ALLOW = ["sites", "masters", "ops", "prices"];
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const want = String(process.env.IMPORT_TOKEN || "");
  const got = String(req.headers["x-import-token"] || "");
  const a = Buffer.from(want), b = Buffer.from(got);
  if (!want || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "unauthorized" });
  try {
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const cols = body.collections || {};
    const fs = admin.firestore();
    let n = 0;
    for (const c of ALLOW) {
      const o = cols[c] || {};
      const ids = Object.keys(o);
      for (let i = 0; i < ids.length; i += 400) {
        const batch = fs.batch();
        ids.slice(i, i + 400).forEach((id) => { batch.set(fs.doc(c + "/" + id), o[id]); n++; });
        await batch.commit();
      }
    }
    return res.status(200).json({ ok: true, written: n });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.code) || (e && e.message) || "error").slice(0, 120) });
  }
};
