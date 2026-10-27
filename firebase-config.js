// ① Firebase コンソール →「プロジェクトの設定」→ 全般 → ウェブアプリの firebaseConfig の値を貼り付けます。
//    (この値は公開されても問題ない設定値です。守っているのは firestore.rules です)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBNzUm-Edn8M1VO3Cf3qxUAxM0lj95oCi0",
  authDomain: "josetsu-app.firebaseapp.com",
  projectId: "josetsu-app",
  messagingSenderId: "746688896",
  appId: "1:746688896:web:a6226e2574c23c4cb83165"
};
// ② 管理者のメールアドレス(firestore.rules の ADMIN_EMAILS と同じものにします)
window.ADMIN_EMAILS = ["admin@sanoh-ltd.jp"];
