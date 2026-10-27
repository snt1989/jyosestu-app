/* claude.ai の実行環境(window.claude)を Firebase で置き換える互換層。
   db → Firestore / user → Firebase Auth + users コレクション / assets → Firestore(photos) / mcp(天気) → /api/weather */
(function(){
  var cfg=window.FIREBASE_CONFIG||{}, ADMINS=(window.ADMIN_EMAILS||[]).map(function(x){return String(x).toLowerCase()});
  var CSS='position:fixed;inset:0;z-index:200;background:#F8F9F8;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Noto Sans JP","Hiragino Sans","Yu Gothic",Meiryo,sans-serif;color:#20241F';
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function overlay(html){
    var el=document.getElementById("fbov"); if(!el){el=document.createElement("div");el.id="fbov";el.style.cssText=CSS;document.body.appendChild(el)}
    el.innerHTML='<div style="max-width:380px;width:100%;background:#fff;border:1px solid #E3E7E5;border-radius:16px;padding:26px 22px;box-shadow:0 6px 16px -10px rgba(20,30,22,.18)">'+html+'</div>';
    return el;
  }
  var INPUT='width:100%;min-height:46px;border:1px solid #E3E7E5;border-radius:10px;padding:8px 12px;font:inherit;box-sizing:border-box;margin:4px 0 12px';
  var BTN='width:100%;min-height:48px;border:0;border-radius:999px;background:#1E8449;color:#fff;font:inherit;font-weight:700;cursor:pointer';
  var LINK='background:none;border:0;color:#2F6FA8;font:inherit;text-decoration:underline;cursor:pointer;padding:6px';
  function title(t){return '<div style="text-align:center;margin-bottom:14px"><div style="font-size:1.25rem;font-weight:700;color:#175C40">除雪管理アプリ</div><div style="color:#5C6459;font-size:.9rem;margin-top:2px">'+t+'</div></div>'}
  function never(){return new Promise(function(){})}
  function failScreen(msg){overlay(title("設定が必要です")+'<p style="line-height:1.7;font-size:.92rem">'+msg+'</p>');return never()}
  var ERR={"auth/invalid-email":"電話番号またはメールアドレスの形式が正しくありません。","auth/user-not-found":"電話番号(メール)かパスワードが違います。","auth/wrong-password":"電話番号(メール)かパスワードが違います。","auth/invalid-credential":"電話番号(メール)かパスワードが違います。","auth/email-already-in-use":"この電話番号(メール)は、すでに登録されています。","auth/weak-password":"パスワードは6文字以上にしてください。","auth/too-many-requests":"試行が多すぎます。しばらくしてからお試しください。","auth/network-request-failed":"通信できませんでした。"};

  if(!cfg.apiKey||!window.firebase){
    window.claude={use:async function(){return failScreen("Firebase の設定が未入力です。<code>firebase-config.js</code> に設定値を入れて、もう一度デプロイしてください。")}};
    return;
  }
  firebase.initializeApp(cfg);
  var auth=firebase.auth(), fs=firebase.firestore();
  var cur=null;
  // 写真は Firestore(photos コレクション)に、縮小した画像として保存する(Storage は有料プランが必要なため)
  var pcache={}, pwait={};
  window.__blobUrl=function(id){
    if(pcache[id])return pcache[id];
    if(!pwait[id]){
      pwait[id]=1;
      fs.doc("photos/"+id).get().then(function(s){
        var d=s.exists?s.data():null;
        pcache[id]=d&&d.data||"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
        window.dispatchEvent(new CustomEvent("blobloaded",{detail:id}));
      },function(){delete pwait[id]});
    }
    return "";
  };
  function shrinkTo(blob,limit){
    return new Promise(function(resolve,reject){
      var img=new Image(), u=URL.createObjectURL(blob);
      img.onload=function(){
        URL.revokeObjectURL(u);
        var side=1200, q=0.78;
        for(var i=0;i<8;i++){
          var k=Math.min(1,side/Math.max(img.width,img.height)), c=document.createElement("canvas");
          c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k));
          c.getContext("2d").drawImage(img,0,0,c.width,c.height);
          var url=c.toDataURL("image/jpeg",q);
          if(url.length<=limit)return resolve(url);
          side=Math.round(side*0.8); q=Math.max(0.5,q-0.06);
        }
        reject(new Error("too_large"));
      };
      img.onerror=function(){URL.revokeObjectURL(u);reject(new Error("bad_image"))};
      img.src=u;
    });
  }
  window.__FB={
    signOut:function(){return auth.signOut().then(function(){location.reload()})},
    setRole:function(uid,role){
      if(!cur||!cur.isAdm)return Promise.reject(new Error("admin only"));
      return fs.doc("users/"+uid).update({role:role});
    }
  };

  var PD="@phone.josetsu-app.example";
  function toId(v){
    v=String(v||"").trim(); if(v.indexOf("@")>=0)return v;
    var d=v.replace(/[\s\-－ー‐()（）+]/g,"").replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248)});
    return /^\d{9,15}$/.test(d)?d+PD:"";
  }
  function disp(e){e=String(e||"");return e.slice(-PD.length)===PD?e.slice(0,-PD.length):e}
  function showLogin(){
    var mode="in";
    function draw(msg,ok){
      var el=overlay(title(mode==="in"?"ログイン":"新規登録")+
        (mode==="up"?'<label style="font-size:.85rem;font-weight:700">お名前<input id="fbName" autocomplete="name" style="'+INPUT+'"></label>':'')+
        '<label style="font-size:.85rem;font-weight:700">電話番号(またはメールアドレス)<input id="fbMail" type="text" inputmode="tel" autocomplete="username" placeholder="09012345678" style="'+INPUT+'"></label>'+
        '<label style="font-size:.85rem;font-weight:700">パスワード<input id="fbPw" type="password" autocomplete="'+(mode==="in"?"current-password":"new-password")+'" style="'+INPUT+'"></label>'+
        '<div id="fbMsg" role="status" style="min-height:1.4em;font-size:.85rem;color:'+(ok?"#1E6B45":"#C1443C")+';margin-bottom:8px">'+esc(msg||"")+'</div>'+
        '<button id="fbGo" type="button" style="'+BTN+'">'+(mode==="in"?"ログイン":"登録する")+'</button>'+
        '<div style="text-align:center;margin-top:10px"><button id="fbSw" type="button" style="'+LINK+'">'+(mode==="in"?"はじめての方は新規登録":"ログインに戻る")+'</button>'+(mode==="in"?'<button id="fbRs" type="button" style="'+LINK+'">パスワードを忘れた</button>':'')+'</div>'+
        (mode==="up"?'<p style="font-size:.8rem;color:#5C6459;line-height:1.6">登録後は、管理者が承認するまで使えません。</p>':''));
      var mail=el.querySelector("#fbMail"), pw=el.querySelector("#fbPw");
      el.querySelector("#fbSw").onclick=function(){mode=mode==="in"?"up":"in";draw()};
      var rs=el.querySelector("#fbRs"); if(rs)rs.onclick=function(){
        var m=toId(mail.value); if(!m||m.slice(-PD.length)===PD){draw(m?"電話番号のパスワード再設定は、管理者に依頼してください。":"メールアドレスを入力してください。");return}
        auth.sendPasswordResetEmail(m).then(function(){draw("再設定のメールを送りました。",true)},function(e){draw(ERR[e.code]||"送信できませんでした。")});
      };
      function go(){
        var m=toId(mail.value), p=pw.value; if(!mail.value.trim()||!p){draw("電話番号とパスワードを入力してください。");return} if(!m){draw("電話番号は数字9〜15桁で入力してください。");return}
        var b=el.querySelector("#fbGo"); b.disabled=true;
        if(mode==="in")auth.signInWithEmailAndPassword(m,p).then(function(){location.reload()},function(e){draw(ERR[e.code]||"ログインできませんでした。")});
        else{
          var nm=(el.querySelector("#fbName").value||"").trim();
          auth.createUserWithEmailAndPassword(m,p).then(function(c){
            return c.user.updateProfile({displayName:nm||disp(m)}).catch(function(){});
          }).then(function(){location.reload()},function(e){draw(ERR[e.code]||"登録できませんでした。")});
        }
      }
      el.querySelector("#fbGo").onclick=go; pw.onkeydown=function(e){if(e.key==="Enter")go()};
    }
    draw();
  }
  function showPending(email,msg){
    var el=overlay(title("承認待ち")+'<p style="line-height:1.7;font-size:.92rem">'+esc(msg||"登録ありがとうございます。管理者が承認すると、使えるようになります。")+'</p><p style="font-size:.85rem;color:#5C6459;word-break:break-all">'+esc(disp(email))+'</p>'+
      '<button id="fbRe" type="button" style="'+BTN+'">もう一度確認する</button><div style="text-align:center;margin-top:8px"><button id="fbOut" type="button" style="'+LINK+'">ログアウト</button></div>');
    el.querySelector("#fbRe").onclick=function(){location.reload()};
    el.querySelector("#fbOut").onclick=function(){window.__FB.signOut()};
  }

  var sessP=new Promise(function(resolve){
    var un=auth.onAuthStateChanged(async function(u){
      un();
      if(!u){showLogin();return}
      try{
        var ref=fs.doc("users/"+u.uid), snap=await ref.get();
        if(!snap.exists){
          await ref.set({name:u.displayName||disp(u.email||""),email:u.email||"",role:"pending",createdAt:Date.now()});
          snap=await ref.get();
        }
        var d=snap.data()||{}, email=String(u.email||"").toLowerCase();
        var isAdm=ADMINS.indexOf(email)>=0||d.role==="admin";
        if(!(isAdm||d.role==="member")){showPending(u.email);return}
        cur={u:u,d:d,isAdm:isAdm,name:d.name||u.displayName||disp(email)};
        resolve(cur);
      }catch(e){showPending(u.email,"確認できませんでした。通信状況と、Firestore のルールが公開されているかを確認してください。("+(e&&e.code||"error")+")")}
    });
  });

  var users=null;
  async function allUsers(){
    if(users)return users;
    var s=await fs.collection("users").get(); users={};
    s.docs.forEach(function(x){var o=x.data();users[x.id]={id:x.id,name:o.name||disp(o.email)||"",email:disp(o.email),role:o.role}});
    return users;
  }
  var wcache={};
  function wfetch(loc,force){
    var c=wcache[loc];
    if(c&&!force&&Date.now()-c.at<300000)return c.p;
    var p=fetch("/api/weather?location="+encodeURIComponent(loc)).then(function(r){
      if(!r.ok){var e=new Error("weather "+r.status);e.code=r.status===400?"tool_error":"unavailable";throw e}
      return r.json();
    });
    wcache[loc]={at:Date.now(),p:p};
    p.catch(function(){if(wcache[loc]&&wcache[loc].p===p)delete wcache[loc]});
    return p;
  }

  var caps={
    user:async function(){
      var s=await sessP;
      return {
        isOwner:async function(){return s.isAdm},
        canEdit:async function(){return s.isAdm},
        can:async function(){return true},
        id:async function(){return s.u.uid},
        me:async function(){return {id:s.u.uid,name:s.name}},
        profiles:async function(ids){var us=await allUsers(),o={};(ids||[]).forEach(function(i){o[i]={id:i,name:us[i]?us[i].name:""}});return o},
        search:async function(q){
          var us=await allUsers(), t=String(q||"").toLowerCase();
          return Object.keys(us).map(function(k){return us[k]}).filter(function(x){return !t||(x.name+" "+x.email).toLowerCase().indexOf(t)>=0}).slice(0,20).map(function(x){return {id:x.id,name:x.name||x.email}});
        }
      };
    },
    db:async function(){
      await sessP;
      return {collection:function(p){return fs.collection(p)},doc:function(p){return fs.doc(p)}};
    },
    mcp:async function(){
      await sessP;
      return {callTool:async function(server,tool,input,opt){
        var force=!!(opt&&opt.cache&&opt.cache.refresh), d=await wfetch(String(input&&input.location||""),force);
        var payload=tool==="xweather_get_current_weather"?d.current:d.forecast;
        return {payload:payload,cache:{storedAt:d.fetchedAt||Date.now()}};
      }};
    },
    assets:async function(){
      var s0=await sessP;
      return {
        upload:async function(blob,o){
          var id=(crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):String(Date.now())+Math.random().toString(36).slice(2));
          var url=await shrinkTo(blob,700000);
          await fs.doc("photos/"+id).set({data:url,type:"image/jpeg",at:Date.now(),by:s0.u.uid});
          pcache[id]=url;
          return {id:id,url:url,sizeBytes:url.length,contentType:"image/jpeg"};
        },
        delete:function(id){delete pcache[id];return fs.doc("photos/"+id).delete()}
      };
    },
    downloads:async function(){
      return {save:async function(o){
        var b=new Blob([o.data],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");
        a.href=URL.createObjectURL(b); a.download=o.filename; document.body.appendChild(a); a.click();
        setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);
      }};
    }
  };
  window.claude={use:async function(n){return caps[n]?caps[n]():null}};
})();
