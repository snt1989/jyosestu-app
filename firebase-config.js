// ① Firebase コンソール →「プロジェクトの設定」→ 全般 → ウェブアプリの firebaseConfig の値を貼り付けます。
//    (この値は公開されても問題ない設定値です。守っているのは firestore.rules / storage.rules です)
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// ② 管理者のメールアドレス(firestore.rules の ADMIN_EMAILS と同じものにします)
window.ADMIN_EMAILS = ["admin@sanoh-ltd.jp"];
