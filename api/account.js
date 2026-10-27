// 管理者が、メンバーのログインID(電話番号/メール)とパスワードを変更するための API。
// 環境変数 FIREBASE_SERVICE_ACCOUNT(サービスアカウントの鍵 JSON)が必要です。
const admin = require("firebase-admin");
const PD = "@phone.josetsu-app.example";
const ADMINS = String(process.env.ADMIN_EMAILS || "admin@sanoh-ltd.jp").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

function init() {
  if (admin.apps.length) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return true;
}
function toId(v) {
  v = String(v || "").trim();
  if (v.indexOf("@") >= 0) return v.toLowerCase();
  const d = v.replace(/[\s\-－ー‐()（）+]/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248));
  return /^\d{9,15}$/.test(d) ? d + PD : "";
}
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  let ok;
  try { ok = init(); } catch (e) { return res.status(500).json({ error: "bad_service_account" }); }
  if (!ok) return res.status(500).json({ error: "not_configured" });
  try {
    const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!tok) return res.status(401).json({ error: "unauthorized" });
    const me = await admin.auth().verifyIdToken(tok);
    let isAdm = ADMINS.indexOf(String(me.email || "").toLowerCase()) >= 0;
    if (!isAdm) {
      const d = await admin.firestore().doc("users/" + me.uid).get();
      isAdm = !!(d.exists && d.data().role === "admin");
    }
    if (!isAdm) return res.status(403).json({ error: "forbidden" });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const uid = String(b.uid || "");
    if (!uid) return res.status(400).json({ error: "bad_uid" });
    const upd = {};
    if (b.password) {
      if (String(b.password).length < 6) return res.status(400).json({ error: "weak_password" });
      upd.password = String(b.password);
    }
    let email = "";
    if (b.id) {
      email = toId(b.id);
      if (!email) return res.status(400).json({ error: "bad_id" });
      upd.email = email;
    }
    if (!Object.keys(upd).length) return res.status(400).json({ error: "nothing" });
    await admin.auth().updateUser(uid, upd);
    if (email) await admin.firestore().doc("users/" + uid).set({ email }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    const c = (e && e.code) || "error";
    const st = c === "auth/email-already-exists" ? 409 : c === "auth/user-not-found" ? 404 : 500;
    return res.status(st).json({ error: c });
  }
};
