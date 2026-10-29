
  /* ---------- 日付・共通表示 ---------- */
  function p2(n){return ("0"+n).slice(-2)}
  function dstr(d){return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())}
  function todayStr(){return dstr(new Date())}
  function timeStr(t){var d=new Date(t);return p2(d.getHours())+":"+p2(d.getMinutes())}
  function dayLabel(iso,i){
    var d=String(iso||"").slice(0,10).split("-");
    if(d.length<3)return "";
    var dt=new Date(+d[0],+d[1]-1,+d[2]);
    var base=i===0?"今日":i===1?"明日":"";
    return base||((+d[1])+"/"+(+d[2])+"("+"日月火水木金土"[dt.getDay()]+")");
  }
  function dlabel(ds){
    var d=String(ds||"").split("-"); if(d.length<3)return ds||"";
    var dt=new Date(+d[0],+d[1]-1,+d[2]);
    var t=todayStr(), y=dstr(new Date(Date.now()-86400000));
    var s=(+d[1])+"月"+(+d[2])+"日("+"日月火水木金土"[dt.getDay()]+")";
    return ds===t?"今日 "+s:ds===y?"昨日 "+s:s;
  }
  function yen(n){return "¥"+Math.round(n).toLocaleString("ja-JP")}
  function okId(id){return typeof id==="string"&&/^[0-9a-zA-Z_-]{8,64}$/.test(id)}
  function who(id){if(id&&nameMap[id])return nameMap[id];return id&&id===myId?"自分":"スタッフ"}
  function toast(t){var el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){el.hidden=true},3200)}
  function flash(id,txt){var el=$(id);el.textContent=txt;setTimeout(function(){if(el.textContent===txt)el.textContent=""},6000)}
  var ST={standby:"待機",prep:"準備中",out:"出動中",done:"完了"};
  var canWrite=function(){return !!db&&canStatus};

  function kvHtml(c){
    return '<div class="kv"><div><small>現在の降雪</small><b>'+fmt(num(c.snowCM),1)+' cm</b></div><div><small>風(突風)</small><b>'+fmt(ms(num(c.windSpeedKPH)),1)+'<span style="font-weight:400"> ('+fmt(ms(num(c.windGustKPH)),0)+')</span> m/s</b></div><div><small>視程</small><b>'+fmt(num(c.visibilityKM),1)+' km</b></div></div>';
  }
  function fcHtml(fc){
    if(!fc||!fc.length)return "";
    return '<div class="fc">'+fc.slice(0,4).map(function(f,i){
      var m=ms(num(f.windSpeedMaxKPH));
      return '<div><div class="d">'+esc(dayLabel(f.dateTimeISO,i))+'</div>'+icon(f.weather)+'<div class="tt">'+fmt(num(f.maxTempC),0)+'/'+fmt(num(f.minTempC),0)+'℃</div><div class="tt">'+fmt(num(f.precipMM),0)+'mm</div><div class="s">'+snowLabel(snowEst(f))+'</div><div class="d">風'+fmt(m,0)+'m/s</div></div>';
    }).join("")+'</div>';
  }
  function tagsHtml(a,w){
    var al=(w&&w.alerts)||[], h="";
    al.slice(0,3).forEach(function(x){h+='<span>'+esc(jpAlert(x))+'</span>'});
    if(al.length>3)h+='<span>ほか'+(al.length-3)+'件</span>';
    if(a.ice)h+='<span class="tag ice">凍結注意</span>';
    if(a.snowing)h+='<span class="tag ice">降雪中</span>';
    return h?'<div class="alerts">'+h+'</div>':'';
  }
  function meterHtml(a){
    var th=a.th||10, pct=Math.min(100,Math.round(a.snow2/th*100));
    return '<div class="sn"><span>降雪目安 <b class="num">'+snowLabel(a.snow2)+'</b></span><span class="muted">基準 '+th+'cm</span></div><div class="track" role="img" aria-label="出動基準に対して'+pct+'パーセント"><div class="fill'+(a.snow2>=th?' hot':'')+'" style="width:'+pct+'%"></div></div>';
  }
  function wxState(s){
    var w=wx[s.id];
    if(!mcp)return '<div class="muted">この画面では天気を取得できません</div>';
    if(!w||(w.state==="loading"&&!w.cur))return '<div class="muted">天気を取得中…</div>';
    if(w.state==="noloc")return '<div class="muted">天気を調べる場所が未設定です</div>';
    if(w.state==="err")return '<div class="err">天気を取得できません</div><button class="link" type="button" data-act="retry" data-id="'+esc(s.id)+'">再取得</button>';
    return "";
  }
  function wxBrief(s,a){
    var w=wx[s.id], bad=wxState(s);
    if(bad)return bad;
    var c=w.cur||{}, f0=w.fc&&w.fc[0];
    return '<div class="wb"><div class="wb-w">'+icon(c.weather)+'<div><div class="t num">'+fmt(num(c.tempC),1)+'<small>℃</small></div><div class="w">'+esc(jp(c.weather))+'</div></div></div><div>'+meterHtml(a)+'</div></div>'+tagsHtml(a,w);
  }
  function segHtml(s){
    var st=stOf(s), id=esc(s.id);
    var h='<div class="seg" role="group" aria-label="'+esc(s.name)+'の作業状況">';
    ["standby","prep","out","done"].forEach(function(k){
      h+='<button type="button" class="'+(k==="standby"?"":k)+'" data-act="status" data-id="'+id+'" data-v="'+k+'" aria-pressed="'+(st===k)+'"'+(canWrite()?"":" disabled")+'>'+ST[k]+'</button>';
    });
    return h+'</div>';
  }
  function siteCard(s){
    var a=assess(s), st=stOf(s), id=esc(s.id);
    return '<article class="sc l'+a.lv+'"><div class="sc-main" data-act="open" data-id="'+id+'" role="button" tabindex="0" aria-label="'+esc(s.name)+'の詳細を開く"><div class="sc-top"><div style="min-width:0"><div class="sc-name">'+esc(s.name)+(s.sample?' <span class="tag">サンプル</span>':'')+'</div><div class="sc-sub">'+esc([s.area,s.crew?('担当 '+s.crew):'担当 未設定'].filter(Boolean).join(' ・ '))+'</div></div><span class="pill l'+a.lv+'">'+a.label+'</span></div>'+wxBrief(s,a)+'</div><div class="sc-st">'+segHtml(s)+'<div class="mt" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>'+(stAt(s)?esc(ST[st])+' '+timeStr(stAt(s))+' に更新':'')+'</span>'+'<button class="link" type="button" data-act="open" data-id="'+id+'">現場情報を見る</button>'+'</div></div></article>';
  }
  function stSelHtml(s){
    var st=stOf(s);
    return '<select class="stsel s-'+st+'" data-stsel="'+esc(s.id)+'" aria-label="'+esc(s.name)+'の作業状況"'+(canWrite()?'':' disabled')+'>'+["standby","prep","out","done"].map(function(k){return '<option value="'+k+'"'+(k===st?' selected':'')+'>'+ST[k]+'</option>'}).join("")+'</select>';
  }
  function siteRow(s){
    var a=assess(s), w=wx[s.id], ok=!!(w&&w.state==="ok"), c=ok?(w.cur||{}):{}, id=esc(s.id);
    var tg="";
    if(ok){
      ((w.alerts)||[]).slice(0,2).forEach(function(x){tg+='<span>'+esc(jpAlert(x))+'</span>'});
      if(a.ice)tg+='<span class="ice">凍結注意</span>';
      if(a.snowing)tg+='<span class="ice">降雪中</span>';
    }
    var wxh=ok?icon(c.weather)+'<span class="t">'+fmt(num(c.tempC),1)+'℃</span><span class="sw">'+esc(jp(c.weather))+'<span class="sx"> ・ 降雪 '+snowLabel(a.snow2)+' / 基準'+(a.th||10)+'cm</span></span>':wxState(s).replace(/<button[\s\S]*?<\/button>/,"");
    return '<article class="sr l'+a.lv+'" data-act="open" data-id="'+id+'" role="button" tabindex="0" aria-label="'+esc(s.name)+'の詳細を開く"><div class="nm"><b>'+esc(s.name)+(s.sample?' <span class="tag">サンプル</span>':'')+'</b><span>'+esc([s.area,s.crew?('担当 '+s.crew):'担当 未設定'].filter(Boolean).join(' ・ '))+'</span></div><span class="pill l'+a.lv+'">'+a.label+'</span><div class="stg">'+tg+'</div><div class="wx">'+wxh+'</div>'+(ok?'<div class="sn">'+meterHtml(a)+'</div>':'<div class="sn"></div>')+stSelHtml(s)+'</article>';
  }
  var layout="row";
  try{var L0=localStorage.getItem("josetsu.layout2");if(L0==="card"||L0==="row")layout=L0}catch(e){}
  function prioritySort(items){
    var ratio=function(x){return x.a.th?x.a.snow2/x.a.th:0};
    return items.sort(function(p,r){
      if(r.a.lv!==p.a.lv)return r.a.lv-p.a.lv;
      if(p.a.lv>=2&&ratio(r)!==ratio(p))return ratio(r)-ratio(p);
      return String(p.s.area||"").localeCompare(String(r.s.area||""),"ja")||String(p.s.name).localeCompare(String(r.s.name),"ja");
    });
  }
  function banners(){
    var b="";
    if(dbState==="unavailable")b+='<div class="banner">現場データを読み込めません。ログインしているか、このページの共有設定を確認してください。</div>';
    if(!mcp&&mcpState!=="loading")b+='<div class="banner">この表示環境では天気データに接続できません。claude.aiのアプリまたはブラウザで開き直してください。</div>';
    else if(mcpState==="not_in_manifest"||mcpState==="server_not_connected"||mcpState==="needs_reauth"){
      var any=false;for(var k in wx){if(wx[k].state==="ok")any=true}
      if(!any)b+='<div class="banner">気象コネクタに接続できていません。上の「天気を更新」を押して許可するか、claude.aiの設定 → コネクタを確認してください。</div>';
    }
    return b;
  }

  /* ---------- 日報・連絡の部品 ---------- */
  function sortReps(list){
    return list.slice().sort(function(a,b){
      return String(b.date||"").localeCompare(String(a.date||""))||String(b.start||"").localeCompare(String(a.start||""))||((b.at||0)-(a.at||0));
    });
  }
  function repCard(r){
    var n=(r.photos||[]).length, ln=[];
    if(r.crew)ln.push(esc(r.crew));
    if(r.snowCm!=null&&r.snowCm!=="")ln.push('積雪 '+esc(r.snowCm)+'cm');
    if(r.machines&&r.machines.length)ln.push(esc(r.machines.join("・")));
    var h='<article class="rc" data-act="rep" data-id="'+esc(r.id)+'" role="button" tabindex="0"><div class="top"><span class="nm">'+esc(r.siteName||"(現場名なし)")+'</span><span class="tm">'+esc(r.start||"--:--")+'〜'+esc(r.end||"--:--")+'</span></div>';
    h+='<div class="ln">'+(ln.length?'<span>'+ln.join('</span><span>')+'</span>':'')+(r.haisetsu?'<span class="tag ice">排雪</span>':'')+(n?'<span>写真 '+n+'枚</span>':'')+'</div>';
    h+='<div class="ln"><span>'+esc(dlabel(r.date))+' ・ 記入 '+esc(who(r.by))+'</span></div>';
    if(r.note)h+='<div class="sc-sub" style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(r.note.length>80?r.note.slice(0,80)+"…":r.note)+'</div>';
    return h+'</article>';
  }
  function canDelete(x){return !!db&&(canAdmin||(!!myId&&x.by===myId))}
  function noteCard(n){
    var site=n.siteId?siteById(n.siteId):null, nm=n.siteId?(site?site.name:(n.siteName||"削除された現場")):"全体への連絡";
    var d=new Date(n.at||0);
    var h='<article class="note"><div class="hd"><span><b style="color:var(--ink)">'+esc(nm)+'</b></span><span>'+(n.at?esc((d.getMonth()+1)+"/"+d.getDate()+" "+timeStr(n.at)):"")+'</span></div><div class="tx">'+esc(n.text)+'</div><div class="hd"><span>'+esc(who(n.by))+'</span><span>';
    if(n.siteId&&site)h+='<button class="link" type="button" data-act="open" data-id="'+esc(n.siteId)+'">現場を見る</button> ';
    if(canDelete(n))h+='<button class="link" type="button" data-act="ntdel" data-id="'+esc(n.id)+'">削除</button>';
    return h+'</span></div></article>';
  }
  function photoGrid(list,group){
    if(!list||!list.length)return "";
    return '<div class="ph">'+list.map(function(p,i){
      if(!okId(p.id))return "";
      return '<button type="button" data-act="photo" data-g="'+esc(group)+'" data-i="'+i+'" aria-label="写真を大きく表示"><img src="'+esc(blobUrl(p.id))+'" alt="'+esc(KIND[p.kind]||"写真")+'" loading="lazy"><span class="pk">'+esc(KIND[p.kind]||"その他")+'</span></button>';
    }).join("")+'</div>';
  }
  var KIND={before:"作業前",after:"作業後",other:"その他"};

  /* ---------- ホーム ---------- */
  /* ---------- 誰がどこに(ホーム) ---------- */
  function whoHtml(){
    var td=todayStr(), now=Date.now(), crews={}, order=[];
    function C(n){n=n||"";if(!crews[n]){crews[n]={n:n,act:[],done:[]};order.push(n)}return crews[n]}
    (masters.crews||[]).forEach(function(c){if(c)C(c)});
    sites.forEach(function(s){
      var st=stOf(s), at=stAt(s), o=ops[s.id]||{};
      var isToday=at&&dstr(new Date(at))===td;
      if(st==="out"||st==="prep")C(s.crew||"").act.push({s:s,st:st,at:at,by:o.statusBy||""});
      else if(st==="done"&&isToday)C(s.crew||"").done.push({name:s.name,id:s.id,time:timeStr(at),by:o.statusBy||"",site:true});
    });
    // 本日の日報(完了した作業)を、日報の班名から班に振り分ける
    var names=order.filter(Boolean);
    reports.filter(function(r){return r.date===td}).forEach(function(r){
      var cn="";names.forEach(function(n){if(!cn&&r.crew&&String(r.crew).indexOf(n)>=0)cn=n});
      var g=C(cn);
      if(g.done.some(function(d){return d.id===r.siteId}))return;
      g.done.push({name:r.siteName||"(現場名なし)",id:r.siteId,time:(r.start||"--:--")+"〜"+(r.end||"--:--"),by:cn?String(r.crew).replace(cn,"").trim():(r.crew||""),site:true});
    });
    var list=order.map(function(n){return crews[n]});
    var busy=list.filter(function(g){return g.act.length||g.done.length}), idle=list.filter(function(g){return g.n&&!g.act.length&&!g.done.length});
    busy.sort(function(a,b){return (b.act.length>0)-(a.act.length>0)||(a.n?0:1)-(b.n?0:1)||a.n.localeCompare(b.n,"ja")});
    var out=0;list.forEach(function(g){g.act.forEach(function(x){if(x.st==="out")out++})});
    var h='<div class="sec"><h2>いま誰がどこに<span class="gc num">出動中 '+out+'件</span></h2></div>';
    if(!busy.length)return h+'<div class="empty"><b>出動中・準備中の現場はありません</b>「現場一覧」や詳細で作業状況を「準備中」「出動中」にすると、ここに出ます。</div>'+(idle.length?'<p class="muted whi">待機: '+idle.map(function(g){return esc(g.n)}).join("・")+'</p>':'');
    h+='<div class="whg">'+busy.map(function(g){
      var run=g.act.some(function(x){return x.st==="out"});
      return '<article class="card2 who'+(run?' run':'')+'"><div class="who-h"><b>'+esc(g.n||"担当班なし")+'</b><span class="who-p'+(run?' run':'')+'">'+(g.act.length?(run?'出動中':'準備中'):'本日完了')+'</span></div>'+
        g.act.map(function(x){
          var today=x.at&&dstr(new Date(x.at))===td, el=x.at?Math.max(0,Math.round((now-x.at)/60000)):0;
          var tm=x.at?(today?timeStr(x.at)+'から':fmtDT(x.at).split(" ")[0]+'から'):'';
          var dur=today&&x.at?(el>=60?Math.floor(el/60)+'時間'+(el%60?el%60+'分':''):el+'分'):'';
          return '<button type="button" class="whl '+x.st+'" data-act="open" data-id="'+esc(x.s.id)+'"><span class="sp">'+esc(ST[x.st])+'</span><span class="nm">'+esc(x.s.name)+'</span><span class="mt">'+[x.by,tm,dur&&'経過 '+dur].filter(Boolean).map(esc).join(' ・ ')+'</span></button>';
        }).join("")+
        g.done.map(function(x){return '<button type="button" class="whl done" data-act="open" data-id="'+esc(x.id)+'"><span class="sp">完了</span><span class="nm">'+esc(x.name)+'</span><span class="mt">'+[x.by,x.time].filter(Boolean).map(esc).join(' ・ ')+'</span></button>'}).join("")+'</article>';
    }).join("")+'</div>'+(idle.length?'<p class="muted whi">待機: '+idle.map(function(g){return esc(g.n)}).join("・")+'</p>':'');
    return h;
  }
  function renderHome(){
    var items=sites.map(function(s){return {s:s,a:assess(s)}});
    var c3=0,c2=0,out=0;
    items.forEach(function(x){if(x.a.lv===3)c3++;else if(x.a.lv===2)c2++; if(stOf(x.s)==="out")out++});
    var td=todayStr(), todayReps=sortReps(reports.filter(function(r){return r.date===td}));
    var h=banners()+annHome();
    h+='<div class="hello"><span class="d">'+esc(new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"}))+'</span><span class="muted">全'+sites.length+'現場</span></div>';
    h+='<div class="tiles">'+
      '<button type="button" class="tile c3" data-nav="sites" data-f="l3"><span class="n">'+c3+'</span><span class="l">出動目安</span></button>'+
      '<button type="button" class="tile c2" data-nav="sites" data-f="l2"><span class="n">'+c2+'</span><span class="l">警戒</span></button>'+
      '<button type="button" class="tile" data-nav="sites" data-f="out"><span class="n">'+out+'</span><span class="l">出動中</span></button>'+
      '<button type="button" class="tile" data-nav="reports"><span class="n">'+todayReps.length+'</span><span class="l">本日の日報</span></button></div>';
    h+=whoHtml();
    var urgent=prioritySort(items.filter(function(x){return x.a.lv>=2&&stOf(x.s)!=="out"}));
    h+='<div class="sec"><h2>要対応の現場<span class="gc num">'+urgent.length+'件</span></h2>'+(urgent.length>5?'<button class="link" type="button" data-nav="sites" data-f="l3">すべて見る</button>':'')+'</div>';
    h+=urgent.length?'<div class="stack">'+urgent.slice(0,5).map(function(x){return siteCard(x.s)}).join("")+'</div>':'<div class="empty"><b>いま対応が必要な現場はありません</b>出動目安・警戒の現場がないか、すでに出動中です。</div>';
    var outs=items.filter(function(x){return stOf(x.s)==="out"});
    if(outs.length){
      h+='<div class="sec"><h2>出動中<span class="gc num">'+outs.length+'件</span></h2></div><div class="stack">'+outs.map(function(x){return siteCard(x.s)}).join("")+'</div>';
    }
    var nt=notes.slice(0,3);
    h+='<div class="sec"><h2>最新の連絡</h2><button class="link" type="button" data-nav="notes">連絡板を開く</button></div>';
    h+=nt.length?'<div class="stack">'+nt.map(noteCard).join("")+'</div>':'<div class="empty"><b>連絡はまだありません</b>申し送りは「連絡」から書けます。</div>';
    h+='<div class="sec"><h2>本日の日報</h2><button class="link" type="button" data-nav="reports">日報を見る</button></div>';
    h+=todayReps.length?'<div class="stack">'+todayReps.slice(0,5).map(repCard).join("")+'</div>':'<div class="empty"><b>今日の日報はまだありません</b>作業が終わったら、右下のボタンから書けます。</div>';
    $("v-home").innerHTML=h;
  }

  /* ---------- 現場一覧 ---------- */
  var crewF="", stF="", sortK="manual", sortDir=1, lastCrewKey="";
  function syncCrewSel(){
    var set={}; sites.forEach(function(s){if(s.crew)set[s.crew]=1}); (masters.crews||[]).forEach(function(c){if(c)set[c]=1});
    var list=Object.keys(set).sort(function(a,b){return a.localeCompare(b,"ja")}), key=list.join("|");
    if(key!==lastCrewKey){
      lastCrewKey=key; if(crewF&&!set[crewF])crewF="";
      $("crewSel").innerHTML='<option value="">すべての担当班</option>'+list.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join("");
    }
  }
  function manKey(s){return typeof s.order==="number"?s.order:1e12+(+s.createdAt||0)}
  function manualList(){return sites.slice().sort(function(a,b){return manKey(a)-manKey(b)||String(a.name).localeCompare(String(b.name),"ja")})}
  var mvBusy=false;
  async function moveSite(id,dir,shownIds){
    if(!canAdmin||mvBusy)return;
    var i=shownIds.indexOf(id), j=i+dir; if(i<0||j<0||j>=shownIds.length)return;
    var full=manualList().map(function(s){return s.id}), a=full.indexOf(id), b=full.indexOf(shownIds[j]);
    if(a<0||b<0)return;
    full[a]=shownIds[j]; full[b]=id;
    mvBusy=true;
    try{
      var ws=[];
      full.forEach(function(sid,k){var s=sites.filter(function(x){return x.id===sid})[0]; if(s&&s.order!==k){s.order=k; ws.push(db.doc("sites/"+sid).update({order:k}))}});
      render();
      await Promise.all(ws);
    }catch(e){toast("並べ替えを保存できませんでした。")}
    mvBusy=false;
  }
  function addMoveBtns(shown){
    if(!canAdmin)return;
    var ids=shown.map(function(x){return x.s.id});
    Array.prototype.forEach.call($("siteList").querySelectorAll("article"),function(el){
      var o=el.querySelector("[data-act=open]")||el, id=o.getAttribute("data-id"), i=ids.indexOf(id); if(i<0)return;
      var d=document.createElement("span"); d.className="mvb";
      d.innerHTML='<button type="button" data-act="mv" data-d="-1" data-id="'+esc(id)+'" aria-label="上へ"'+(i===0?" disabled":"")+'>↑</button><button type="button" data-act="mv" data-d="1" data-id="'+esc(id)+'" aria-label="下へ"'+(i===ids.length-1?" disabled":"")+'>↓</button>';
      el.appendChild(d);
    });
    $("siteList").__ids=ids;
  }
  function flatSort(items){
    var tx=function(v){return String(v||"")}, ja=function(a,b){return a.localeCompare(b,"ja")};
    var get={
      name:function(x){return tx(x.s.name)}, area:function(x){return tx(x.s.area)}, crew:function(x){return tx(x.s.crew)},
      snow:function(x){return x.a.snow2||0}, th:function(x){return +x.s.threshold||0},
      count:function(x){return siteSeasonCount(x.s.id)}, created:function(x){return +x.s.createdAt||0}, manual:function(x){return manKey(x.s)}
    }[sortK]||function(x){return tx(x.s.name)};
    var isText=(sortK==="name"||sortK==="area"||sortK==="crew");
    items.sort(function(p,r){
      var a=get(p), b=get(r), c;
      if(isText){
        if(!a&&b)return 1; if(a&&!b)return -1;
        c=ja(a,b);
      }else c=a-b;
      if(c)return c*sortDir;
      return ja(tx(p.s.name),tx(r.s.name));
    });
    return items;
  }
  function syncAreaSel(){
    var set={}; sites.forEach(function(s){if(s.area)set[s.area]=1});
    var list=Object.keys(set).sort(function(a,b){return a.localeCompare(b,"ja")});
    var key=list.join("|");
    if(key!==lastAreaKey){
      lastAreaKey=key;
      if(areaF&&!set[areaF])areaF="";
      $("areaSel").innerHTML='<option value="">すべての地区</option>'+list.map(function(a){return '<option value="'+esc(a)+'">'+esc(a)+'</option>'}).join("");
    }
    $("areaSel").value=areaF;
  }
  function renderSites(){
    var items=sites.map(function(s){return {s:s,a:assess(s)}});
    var cnt={all:items.length,l3:0,l2:0,l1:0,out:0};
    items.forEach(function(x){if(x.a.lv===3)cnt.l3++;else if(x.a.lv===2)cnt.l2++;else if(x.a.lv===1)cnt.l1++; if(stOf(x.s)==="out")cnt.out++});
    var defs=[["all","全現場"],["l3","出動目安"],["l2","警戒"],["l1","平常"],["out","出動中"]];
    $("siteChips").innerHTML=defs.map(function(d){return '<button type="button" data-filter="'+d[0]+'" aria-pressed="'+(filter===d[0])+'">'+d[1]+'<span class="num">'+cnt[d[0]]+'</span></button>'}).join("");
    syncAreaSel();
    Array.prototype.forEach.call($("layoutT").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.layout===layout))});
    syncCrewSel();
    $("sortDir").hidden=(sortK==="prio"||sortK==="manual"); $("sortDir").textContent=sortDir>0?"昇順 ↑":"降順 ↓";
    $("sortSel").value=sortK; $("stSel").value=stF; $("crewSel").value=crewF;
    var qs=query.trim().toLowerCase();
    var shown=items.filter(function(x){
      if(areaF&&(x.s.area||"")!==areaF)return false;
      if(crewF&&(x.s.crew||"")!==crewF)return false;
      if(stF&&stOf(x.s)!==stF)return false;
      if(qs&&[x.s.name,x.s.area,x.s.crew,x.s.address].join(" ").toLowerCase().indexOf(qs)<0)return false;
      if(filter==="all")return true;
      if(filter==="out")return stOf(x.s)==="out";
      return x.a.lv===({l3:3,l2:2,l1:1})[filter];
    });
    if(sortK==="prio")prioritySort(shown); else flatSort(shown);
    $("siteCount").textContent=shown.length+"件を表示";
    $("banner").innerHTML=banners();
    if(!sites.length){
      $("siteList").innerHTML='<div class="empty"><b>'+(dbState==="loading"?"読み込み中…":"現場がまだ登録されていません")+'</b>'+(dbState==="loading"?"":(canAdmin?"「設定」の「現場を追加」から、現場名と天気を調べる場所を登録してください。":"登録された現場がここに表示されます。"))+'</div>';
    }else if(!shown.length){
      $("siteList").innerHTML='<div class="empty"><b>該当する現場はありません</b>絞り込みを「全現場」に戻してください。</div>';
    }else{
      var GN={3:"出動目安",2:"警戒",1:"平常",0:"天気を取得できていない現場"}, out="";
      if(sortK!=="prio"){
        out='<div class="stack'+(layout==="row"?" rows":"")+'">'+shown.map(function(x){return layout==="row"?siteRow(x.s):siteCard(x.s)}).join("")+'</div>';
        $("siteList").innerHTML=out; if(sortK==="manual")addMoveBtns(shown); return;
      }
      [3,2,1,0].forEach(function(lv){
        var g=shown.filter(function(x){return x.a.lv===lv}); if(!g.length)return;
        out+='<div class="grp-h l'+lv+'">'+GN[lv]+'<span class="gc num">'+g.length+'件</span></div><div class="stack'+(layout==="row"?" rows":"")+'">'+g.map(function(x){return layout==="row"?siteRow(x.s):siteCard(x.s)}).join("")+'</div>';
      });
      $("siteList").innerHTML=out;
    }
  }

  /* ---------- 現場の詳細 ---------- */
  function seasonOf(ds){var y=+String(ds).slice(0,4), m=+String(ds).slice(5,7);return m>=10?y:y-1}
  function seasonRange(sy){return [sy+"-10-01",(sy+1)+"-09-30"]}
  function siteSeasonCount(id){
    var sy=seasonOf(todayStr()), r=seasonRange(sy);
    return reports.filter(function(x){return x.siteId===id&&x.date>=r[0]&&x.date<=r[1]}).length;
  }
  var LOCK='<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function admBadge(){return '<span class="adm-badge">'+LOCK+'管理者のみ</span>'}
  function unitText(s){
    var ls=siteLines(s).filter(function(l){return l.unitPrice>0}), multi=siteLines(s).length>1;
    return ls.map(function(l){return (multi?lineLabel(l)+" ":"")+yen(l.unitPrice)+" / "+(l.unit==="時間"?"時間":"回")}).join(" ・ ");
  }
  function siteSeasonCountK(id,kind){
    var sy=seasonOf(todayStr()), r=seasonRange(sy);
    return reports.filter(function(x){return x.siteId===id&&x.date>=r[0]&&x.date<=r[1]&&lineMatch(kind,x)}).length;
  }
  function detailHtml(s){
    var a=assess(s), w=wx[s.id], id=esc(s.id), h='<div class="dv">';
    var bad=wxState(s);
    h+='<div class="card2 dvh"><div class="top" style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px"><span class="pill big l'+a.lv+'">'+a.label+'</span><span class="muted">'+esc([s.area,s.crew?('担当 '+s.crew):''].filter(Boolean).join(' ・ '))+'</span></div>';
    if(bad)h+=bad;
    else{
      var c=w.cur||{};
      h+='<div class="bignow">'+icon(c.weather)+'<div><div class="t">'+fmt(num(c.tempC),1)+'<small>℃</small></div><div class="w">'+esc(jp(c.weather))+'</div></div></div><div style="margin-top:12px">'+meterHtml(a)+'</div>'+tagsHtml(a,w)+'<div style="margin-top:12px">'+kvHtml(c)+'</div><div style="margin-top:10px">'+fcHtml(w.fc)+'</div>';
    }
    if(mcp)h+='<div style="margin-top:6px"><button class="link" type="button" data-act="retry" data-id="'+id+'">この現場の天気を更新</button></div>';
    h+='</div>';
    h+='<div class="card2 dva"><div class="dvah"><b>作業状況</b><span class="muted">'+(stAt(s)?esc(ST[stOf(s)])+' '+timeStr(stAt(s)):'')+'</span></div>'+segHtml(s)+
      '<div class="row2" style="margin-top:10px"><button class="btn primary" type="button" data-act="newrep" data-id="'+id+'"'+(canWrite()?'':' disabled')+' style="flex:1">日報を書く</button><button class="btn" type="button" data-act="newnote" data-id="'+id+'"'+(canWrite()?'':' disabled')+' style="flex:1">連絡を書く</button></div></div>';
    h+='<div class="dvn" role="navigation" aria-label="この画面の項目"><button type="button" data-act="jump" data-t="dvInfo">現場の情報</button><button type="button" data-act="jump" data-t="dvCt">契約・単価</button><button type="button" data-act="jump" data-t="dvDw">図面</button><button type="button" data-act="jump" data-t="dvPh">写真</button><button type="button" data-act="jump" data-t="dvRp">日報</button><button type="button" data-act="jump" data-t="dvNt">連絡</button></div>';
    var n=siteSeasonCount(s.id), sl=siteLines(s);
    h+='<div class="sec" id="dvInfo"><h2>現場の情報</h2></div><div class="card2 dvi">';
    h+='<div class="dvt"><div class="tl"><span>出動基準</span><b class="num">降雪 '+esc(s.threshold||10)+'<small> cm</small></b></div><div class="tl"><span>今シーズンの出動</span><b class="num">'+n+'<small> 回</small></b></div></div>';
    h+='<div class="dvr"><span class="k">住所</span><div class="v">'+(s.address?esc(s.address)+'<a class="btn sm" style="margin-left:8px" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.address)+'" target="_blank" rel="noopener">地図を開く</a>':'<span class="muted">未登録</span>')+'</div></div>';
    h+='<div class="dvr"><span class="k">メモ</span><div class="v" style="white-space:pre-wrap">'+(s.note?esc(s.note):'<span class="muted">なし</span>')+'</div></div></div>';
    h+='<div class="sec" id="dvCt"><h2>契約・単価'+(canAdmin?admBadge():'')+'</h2></div><div class="card2 dvc">'+sl.map(function(l){
      var m=l.kind==="other"?null:siteSeasonCountK(s.id,l.kind), over=m!=null&&l.count&&m>l.count, pc=l.count&&m!=null?Math.min(100,Math.round(m/l.count*100)):0;
      return '<div class="dcr"><div class="dcn"><b>'+esc(lineLabel(l)||"全作業")+'</b>'+(over?'<span class="tag ice">契約回数を超過</span>':'')+'</div>'+
        (canAdmin?'<div class="dcp">'+(l.unitPrice>0?'<b class="num">'+yen(l.unitPrice)+'</b><small> / '+(l.unit==="時間"?"時間":"回")+'</small>':'<span class="muted">単価 未登録</span>')+'</div>':'')+
        '<div class="dcb">'+(l.count?'<div class="bar'+(over?' over':'')+'"><i style="width:'+pc+'%"></i></div><div class="bt">'+(m==null?'':'出動 <b class="num">'+m+'</b>回 / ')+'契約 <b class="num">'+l.count+'</b>回</div>':'<div class="bt muted">'+(m==null?'契約回数なし':'出動 <b class="num">'+m+'</b>回(契約回数の設定なし)')+'</div>')+'</div></div>';
    }).join("")+'</div>';
    h+=siteDrawSec(s)+sitePhotoSec(s);
    var reps=sortReps(reports.filter(function(r){return r.siteId===s.id}));
    h+='<div class="sec" id="dvRp"><h2>日報<span class="gc num">'+reps.length+'件</span></h2>'+(reps.length>5?'<button class="link" type="button" data-act="allreps" data-id="'+id+'">すべて見る</button>':'')+'</div>';
    h+=reps.length?'<div class="stack">'+reps.slice(0,5).map(repCard).join("")+'</div>':'<div class="empty"><b>この現場の日報はまだありません</b></div>';
    var phs=[]; reps.forEach(function(r){(r.photos||[]).forEach(function(p){phs.push({id:p.id,kind:p.kind,cap:(r.date||"")})})});
    detailPhotos=phs.slice(0,18);
    if(detailPhotos.length)h+='<div class="sec"><h2>日報の写真<span class="gc num">'+phs.length+'枚</span></h2></div>'+photoGrid(detailPhotos,"detail");
    var nts=notes.filter(function(x){return x.siteId===s.id});
    h+='<div class="sec" id="dvNt"><h2>この現場への連絡</h2></div>';
    h+=nts.length?'<div class="stack">'+nts.slice(0,5).map(noteCard).join("")+'</div>':'<div class="empty"><b>連絡はありません</b></div>';
    return h+'</div>';
  }
  var detailPhotos=[], sitePh=[];
  var PQD={light:{n:"軽量",side:1000,q:60,kb:110},std:{n:"標準",side:1600,q:78,kb:260},high:{n:"高画質",side:2000,q:85,kb:520}};
  function pql(k){var d=PQD[k]||PQD.std, o=(settings.photo&&settings.photo[k])||{};
    var side=Math.min(4000,Math.max(300,+o.side||d.side)), q=Math.min(95,Math.max(30,+o.q||d.q)), kb=Math.min(700,Math.max(30,+o.kb||d.kb));
    return {n:d.n,side:side,q:q/100,limit:Math.round(kb*1365)}}
  function pqKey(){var k=settings.photo&&settings.photo.level;return PQD[k]?k:"std"}
  window.__PQ=function(){return pql(pqKey())};
  function fmtSize(n){n=+n||0;return n>=1048576?(n/1048576).toFixed(1)+"MB":Math.max(1,Math.round(n/1024))+"KB"}
  function siteDrawSec(s){
    var ds=sphotos.filter(function(x){return x.siteId===s.id&&okId(x.id)&&x.kind==="drawing"}).sort(function(a,b){return (b.at||0)-(a.at||0)});
    var can=canPhoto&&assets, h='<div class="sec" id="dvDw"><h2>図面<span class="gc num">'+ds.length+'件</span></h2>'+(can?'<button class="btn sm primary" type="button" data-act="dwadd" data-id="'+esc(s.id)+'">＋ 図面を追加</button>':'')+'</div>';
    if(can)h+='<div class="help dvhelp" id="dwMsg" role="status">PDFまたは画像(PDFは4MBまで。画像は自動で軽くします)</div>';
    if(!ds.length)return h+'<div class="empty"><b>この案件の図面はまだありません</b></div>';
    return h+'<div class="stack">'+ds.map(function(p){
      var pdf=p.type==="application/pdf";
      return '<div class="card2 dvd"><span class="fi '+(pdf?'pdf':'img')+'" aria-hidden="true">'+(pdf?'PDF':'画像')+'</span><div class="fn"><b>'+esc(p.name||"図面")+'</b><div class="muted">'+(p.size?fmtSize(p.size):"")+(p.at?" ・ "+esc(fmtDT(p.at).split(" ")[0]):"")+'</div></div>'+
        '<button class="btn sm" type="button" data-act="dwopen" data-id="'+esc(p.id)+'">開く</button>'+(can?'<button class="btn sm" type="button" data-act="dwdel" data-id="'+esc(p.id)+'" aria-label="この図面を削除">削除</button>':'')+'</div>';
    }).join("")+'</div>';
  }
  function sitePhotoSec(s){
    sitePh=sphotos.filter(function(x){return x.siteId===s.id&&okId(x.id)&&x.kind!=="drawing"});
    var can=canPhoto&&assets, h='<div class="sec" id="dvPh"><h2>案件の写真<span class="gc num">'+sitePh.length+'枚</span></h2>'+(can?'<button class="btn sm primary" type="button" data-act="spadd" data-id="'+esc(s.id)+'">＋ 写真を追加</button>':'')+'</div>';
    if(can)h+='<div class="help dvhelp" id="spMsg" role="status">保存時の画質:'+esc(PQD[pqKey()].n)+'(管理者が設定で決めています)。保存するとき自動で軽くします。</div>';
    if(!sitePh.length)return h+'<div class="empty"><b>この案件の写真はまだありません</b></div>';
    return h+'<div class="ph">'+sitePh.map(function(p,i){
      return '<div class="phb"><button type="button" data-act="photo" data-g="site" data-i="'+i+'" style="border:0;padding:0;background:none;width:100%;height:100%;cursor:pointer" aria-label="写真を大きく表示"><img src="'+esc(blobUrl(p.id))+'" alt="案件の写真" loading="lazy"></button><span class="pk">'+esc(p.at?fmtDT(p.at).split(" ")[0]:"")+'</span>'+(can?'<button class="px" type="button" data-act="spdel" data-id="'+esc(p.id)+'" aria-label="この写真を削除">×</button>':'')+'</div>';
    }).join("")+'</div>';
  }
  function renderDetail(){
    if(!detailId||$("detail").hidden)return;
    var s=siteById(detailId);
    if(!s){closeSheet("detail");return}
    var sc=$("detail").scrollTop;
    $("detailTitle").textContent=s.name;
    $("detailEdit").innerHTML='';
    $("detailBody").innerHTML=detailHtml(s);
    $("detail").scrollTop=sc;
  }

  /* ---------- シート ---------- */
  function lockBody(){
    var any=["detail","rview","rform","sform"].some(function(id){return !$(id).hidden});
    document.body.style.overflow=any?"hidden":"";
  }
  function openSheet(id){$(id).hidden=false;$(id).scrollTop=0;lockBody()}
  function closeSheet(id){$(id).hidden=true;if(id==="detail")detailId=null;lockBody();render()}
  function openDetail(id){detailId=id;openSheet("detail");renderDetail()}
