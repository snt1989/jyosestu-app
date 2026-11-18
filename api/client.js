// お客さん(role: client)用の API。サーバー側で「その人に割り当てた現場」だけに絞って返します。
// お客さんのアカウントは Firestore を直接読めない(ルールで拒否)ので、情報はここ経由だけです。
const admin = require("firebase-admin");

function init() {
  if (admin.apps.length) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return true;
}
const SITE_FIELDS = ["name", "area", "address", "loc", "threshold", "sqm", "handovers", "handover", "createdAt"];
const REPORT_FIELDS = ["date", "siteId", "siteName", "start", "end", "snowCm", "haisetsu", "machines", "at"];
const pick = (o, keys) => { const r = {}; keys.forEach((k) => { if (o && o[k] !== undefined) r[k] = o[k]; }); return r; };
const clip = (s, n) => String(s || "").replace(/\r/g, "").trim().slice(0, n);

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
    const ud = await fs.doc("users/" + me.uid).get();
    const u = ud.exists ? ud.data() : {};
    if (u.role !== "client") return res.status(403).json({ error: "forbidden" });
    const mine = (Array.isArray(u.clientSites) ? u.clientSites : []).filter((x) => typeof x === "string" && x && x.indexOf("/") < 0).slice(0, 60);
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(b.action || "get");

    if (action === "send") {
      const sid = String(b.siteId || "");
      const text = clip(b.text, 1000);
      if (!sid || mine.indexOf(sid) < 0) return res.status(403).json({ error: "forbidden_site" });
      if (!text) return res.status(400).json({ error: "empty" });
      const sd = await fs.doc("sites/" + sid).get();
      if (!sd.exists) return res.status(404).json({ error: "no_site" });
      const at = Date.now();
      const ref = await fs.collection("notes").add({ kind: "cmsg", room: "client:" + sid, siteId: sid, siteName: String(sd.data().name || ""), text, by: me.uid, at, fromClient: true });
      return res.status(200).json({ ok: true, id: ref.id, at });
    }

    // get: 現場・作業状況・日報(抜粋)・やりとり・設定
    const [settings, areas, works] = await Promise.all([
      fs.doc("settings/main").get(), fs.doc("masters/areas").get(), fs.doc("masters/works").get(),
    ]);
    const siteDocs = await Promise.all(mine.map((id) => fs.doc("sites/" + id).get()));
    const opDocs = await Promise.all(mine.map((id) => fs.doc("ops/" + id).get()));
    const sites = [], ops = {};
    siteDocs.forEach((d, i) => { if (d.exists) { sites.push(Object.assign({ id: d.id }, pick(d.data(), SITE_FIELDS))); const o = opDocs[i]; if (o.exists) ops[d.id] = pick(o.data(), ["status", "statusAt"]); } });
    const reports = [], msgs = [];
    await Promise.all(mine.map(async (id) => {
      const rq = await fs.collection("reports").where("siteId", "==", id).limit(60).get();
      rq.docs.forEach((d) => reports.push(Object.assign({ id: d.id }, pick(d.data(), REPORT_FIELDS))));
      const mq = await fs.collection("notes").where("siteId", "==", id).where("kind", "==", "cmsg").limit(200).get();
      mq.docs.forEach((d) => { const o = d.data(); msgs.push({ id: d.id, room: "client:" + id, siteId: id, text: String(o.text || ""), at: o.at || 0, fromClient: o.fromClient === true, mine: o.by === me.uid, kind: "chat" }); });
    }));
    reports.sort((a, c) => String(c.date || "").localeCompare(String(a.date || "")) || (c.at || 0) - (a.at || 0));
    msgs.sort((a, c) => (a.at || 0) - (c.at || 0));
    return res.status(200).json({
      ok: true, name: u.name || "", sites, ops, reports: reports.slice(0, 200), msgs,
      settings: settings.exists ? settings.data() : {},
      areas: areas.exists ? (areas.data().items || []) : [],
      works: works.exists ? (works.data().items || null) : null,
    });
  } catch (e) {
    return res.status(500).json({ error: "server", detail: String(e && e.message || e).slice(0, 120) });
  }
};
