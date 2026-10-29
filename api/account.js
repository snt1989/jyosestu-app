// 管理者が、メンバーのログイン(電話番号+パスワード)を 作る・変える・消す ための API。
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
const isAdminEmail = (e) => ADMINS.indexOf(String(e || "").toLowerCase()) >= 0;

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
    const fs = admin.firestore();
    let isAdm = isAdminEmail(me.email);
    if (!isAdm) {
      const d = await fs.doc("users/" + me.uid).get();
      isAdm = !!(d.exists && d.data().role === "admin");
    }
    if (!isAdm) return res.status(403).json({ error: "forbidden" });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(b.action || "update");
    const name = String(b.name || "").trim().slice(0, 40);

    if (action === "create") {
      const email = toId(b.id);
      if (!email) return res.status(400).json({ error: "bad_id" });
      const pw = String(b.password || "");
      if (pw.length < 6) return res.status(400).json({ error: "weak_password" });
      const u = await admin.auth().createUser({ email, password: pw, displayName: name || undefined });
      await fs.doc("users/" + u.uid).set({ name: name || email.replace(PD, ""), email, role: b.active === false ? "pending" : "member", createdAt: Date.now() });
      return res.status(200).json({ ok: true, uid: u.uid });
    }

    const uid = String(b.uid || "");
    if (!uid) return res.status(400).json({ error: "bad_uid" });
    const target = await admin.auth().getUser(uid);
    const udoc = await fs.doc("users/" + uid).get();
    const targetIsAdmin = isAdminEmail(target.email) || (udoc.exists && udoc.data().role === "admin");

    if (action === "delete") {
      if (targetIsAdmin || uid === me.uid) return res.status(400).json({ error: "cannot_delete_admin" });
      await admin.auth().deleteUser(uid);
      await fs.doc("users/" + uid).delete().catch(() => {});
      return res.status(200).json({ ok: true });
    }

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
    if (name) upd.displayName = name;
    if (Object.keys(upd).length) await admin.auth().updateUser(uid, upd);
    const patch = {};
    if (email) patch.email = email;
    if (name) patch.name = name;
    if (typeof b.active === "boolean" && !targetIsAdmin) patch.role = b.active ? "member" : "pending";
    if (Object.keys(patch).length) await fs.doc("users/" + uid).set(patch, { merge: true });
    if (!Object.keys(upd).length && !Object.keys(patch).length) return res.status(400).json({ error: "nothing" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    const c = (e && e.code) || "error";
    const st = c === "auth/email-already-exists" ? 409 : c === "auth/user-not-found" ? 404 : 500;
    return res.status(st).json({ error: c });
  }
};
