
  /* ---------- 日報一覧 ---------- */
  function periodOk(d){
    var p=repFilter.period, now=new Date(), t=todayStr();
    if(p==="all")return true;
    if(p==="7d"){return d>=dstr(new Date(now.getTime()-6*86400000))&&d<=t}
    var ym=now.getFullYear()*12+now.getMonth()-(p==="prev"?1:0);
    var y=Math.floor(ym/12), m=ym%12+1;
    return String(d).slice(0,7)===y+"-"+p2(m);
  }
  function syncSiteSels(){
    var opts=sites.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name),"ja")});
    var o='<option value="">すべての現場</option>'+opts.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join("");
    var key=opts.map(function(s){return s.id+s.name}).join("|");
    if(syncSiteSels.k!==key){
      syncSiteSels.k=key;
      $("repSiteSel").innerHTML=o;
      var cur=$("ntSite").value;
      $("ntSite").innerHTML='<option value="">全体(現場を指定しない)</option>'+opts.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join("");
      $("ntSite").value=cur;
      var cf=ntF;
      $("ntFilter").innerHTML='<option value="all">すべての連絡</option><option value="none">全体への連絡</option>'+opts.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join("");
      $("ntFilter").value=cf;
    }
    $("repSiteSel").value=repFilter.site;
  }
  function renderReports(){
    syncSiteSels();
    $("repPeriod").value=repFilter.period;
    var list=sortReps(reports.filter(function(r){return periodOk(r.date)&&(!repFilter.site||r.siteId===repFilter.site)}));
    if(!list.length){$("repList").innerHTML='<div class="empty"><b>該当する日報はありません</b>期間や現場の絞り込みを変えるか、右下のボタンから日報を書いてください。</div>';return}
    var h="", last="";
    list.forEach(function(r){
      if(r.date!==last){last=r.date;h+='<div class="dgrp">'+esc(dlabel(r.date))+'</div><div class="stack">'}
      h+=repCard(r);
      var nx=list[list.indexOf(r)+1];
      if(!nx||nx.date!==r.date)h+='</div>';
    });
    $("repList").innerHTML=h;
  }

  /* ---------- 日報の表示 ---------- */
  var viewRepId=null;
  function openRepView(id){
    var r=reports.filter(function(x){return x.id===id})[0]; if(!r)return;
    viewRepId=id; openSheet("rview"); renderRepView();
  }
  function hoursOf(r){
    var a=/^(\d{1,2}):(\d{2})$/.exec(r.start||""), b=/^(\d{1,2}):(\d{2})$/.exec(r.end||"");
    if(!a||!b)return null;
    var m=(+b[1]*60+ +b[2])-(+a[1]*60+ +a[2]);
    if(m<0)m+=1440;
    return m/60;
  }
  function renderRepView(){
    if($("rview").hidden)return;
    var r=reports.filter(function(x){return x.id===viewRepId})[0];
    if(!r){closeSheet("rview");return}
    var hr=hoursOf(r), s=r.siteId?siteById(r.siteId):null, h="";
    h+='<div class="card2"><dl class="dl">';
    h+='<dt>現場</dt><dd><b>'+esc(r.siteName||"")+'</b>'+(s?' <button class="link" type="button" data-act="open2" data-id="'+esc(s.id)+'">現場を見る</button>':'')+'</dd>';
    h+='<dt>作業日</dt><dd>'+esc(dlabel(r.date))+'</dd>';
    h+='<dt>時間</dt><dd class="num">'+esc(r.start||"--:--")+' 〜 '+esc(r.end||"--:--")+(hr!=null?' ('+fmt(hr,1)+'時間)':'')+'</dd>';
    h+='<dt>担当</dt><dd>'+(r.crew?esc(r.crew):'未入力')+'</dd>';
    h+='<dt>積雪量</dt><dd class="num">'+(r.snowCm!=null&&r.snowCm!==""?esc(r.snowCm)+' cm':'未入力')+'</dd>';
    h+='<dt>使用機械</dt><dd>'+(r.machines&&r.machines.length?esc(r.machines.join("、")):'未入力')+'</dd>';
    h+='<dt>排雪</dt><dd>'+(r.haisetsu?'あり':'なし')+'</dd>';
    h+='<dt>メモ</dt><dd style="white-space:pre-wrap">'+(r.note?esc(r.note):'なし')+'</dd>';
    h+='<dt>記入者</dt><dd>'+esc(who(r.by))+(r.at?' ・ '+esc(new Date(r.at).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})):'')+'</dd></dl></div>';
    var ph=(r.photos||[]).filter(function(p){return okId(p.id)});
    h+='<div class="sec"><h2>写真<span class="gc num">'+ph.length+'枚</span></h2></div>';
    h+=ph.length?photoGrid(ph,"rep:"+r.id):'<div class="empty"><b>写真はありません</b></div>';
    if(db&&(canAdmin||(myId&&r.by===myId))){
      h+='<div class="row2" style="margin-top:20px"><button class="btn" type="button" data-act="repedit" data-id="'+esc(r.id)+'" style="flex:1">編集</button><button class="btn danger" type="button" data-act="repdel" data-id="'+esc(r.id)+'" style="flex:1">削除</button></div>';
    }
    $("rviewBody").innerHTML=h;
  }

  /* ---------- 日報フォーム ---------- */
  function shrink(file){
    return new Promise(function(resolve,reject){
      var fallback=function(){
        if(/^image\/(jpeg|png|webp|gif)$/.test(file.type)&&file.size<=20*1048576)resolve({blob:file,type:file.type});
        else reject(new Error("unsupported"));
      };
      if(!window.createImageBitmap)return fallback();
      createImageBitmap(file,{imageOrientation:"from-image"}).then(function(bm){
        var PQ=(window.__PQ?window.__PQ():{side:1600,q:0.82}), sc=Math.min(1,PQ.side/Math.max(bm.width,bm.height));
        var c=document.createElement("canvas"); c.width=Math.max(1,Math.round(bm.width*sc)); c.height=Math.max(1,Math.round(bm.height*sc));
        c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
        if(bm.close)bm.close();
        c.toBlob(function(b){if(b)resolve({blob:b,type:"image/jpeg"});else fallback()},"image/jpeg",PQ.q);
      },fallback);
    });
  }
  /* ---------- 報告書(印刷・PDF) ---------- */
  var rpt={site:"",period:"month",from:"",to:"",addr:"",by:"",photos:true,memo:true};
  try{rpt.addr=localStorage.getItem("josetsu.rpt.addr")||"";rpt.by=localStorage.getItem("josetsu.rpt.by")||""}catch(e){}
  function mRange(off){var n=new Date(), a=new Date(n.getFullYear(),n.getMonth()+off,1), b=new Date(n.getFullYear(),n.getMonth()+off+1,0);return [dstr(a),dstr(b)]}
  function rptRange(){
    if(rpt.period==="prev")return mRange(-1);
    if(rpt.period==="season")return seasonRange(seasonOf(todayStr()));
    if(rpt.period==="custom"){var f=rpt.from||todayStr(), t=rpt.to||f; return f<=t?[f,t]:[t,f]}
    return mRange(0);
  }
  function mdw(ds){var d=String(ds||"").split("-"); if(d.length<3)return ds||""; var dt=new Date(+d[0],+d[1]-1,+d[2]); return (+d[1])+"/"+(+d[2])+"("+"日月火水木金土"[dt.getDay()]+")"}
  function jdate(ds){var d=String(ds||"").split("-"); return d.length<3?ds:(+d[0])+"年"+(+d[1])+"月"+(+d[2])+"日"}
  function rptRows(){
    var r=rptRange();
    return reports.filter(function(x){return x.siteId===rpt.site&&x.date>=r[0]&&x.date<=r[1]}).sort(function(a,b){return String(a.date).localeCompare(String(b.date))||String(a.start||"").localeCompare(String(b.start||""))});
  }
  function openRpt(siteId){
    var list=manualList();
    rpt.site=siteId&&siteById(siteId)?siteId:(rpt.site&&siteById(rpt.site)?rpt.site:(list[0]?list[0].id:""));
    if(!rpt.by)rpt.by=(window.__brand&&window.__brand.name)||($("hdName")&&$("hdName").textContent)||"";
    openSheet("rpt"); renderRptCtl(); renderRptDoc();
  }
  function renderRptCtl(){
    var o=manualList().map(function(s){return '<option value="'+esc(s.id)+'"'+(s.id===rpt.site?' selected':'')+'>'+esc(s.name)+'</option>'}).join("");
    var P=[["month","今月"],["prev","先月"],["season","今シーズン"],["custom","期間を指定"]];
    $("rptCtl").innerHTML=
      '<label class="nt-field">現場<select id="rcSite">'+o+'</select></label>'+
      '<label class="nt-field">対象期間<select id="rcPer">'+P.map(function(p){return '<option value="'+p[0]+'"'+(rpt.period===p[0]?' selected':'')+'>'+p[1]+'</option>'}).join("")+'</select></label>'+
      '<div class="rc-cu" id="rcCu"'+(rpt.period==="custom"?'':' hidden')+'><label class="nt-field">開始日<input type="date" id="rcFrom" value="'+esc(rpt.from)+'"></label><label class="nt-field">終了日<input type="date" id="rcTo" value="'+esc(rpt.to)+'"></label></div>'+
      '<label class="nt-field">提出先(宛名・任意)<input id="rcAddr" maxlength="40" placeholder="例:○○ビル管理事務所" value="'+esc(rpt.addr)+'"></label>'+
      '<label class="nt-field">作成者(会社名・任意)<input id="rcBy" maxlength="40" value="'+esc(rpt.by)+'"></label>'+
      '<label class="pw-ck"><input type="checkbox" id="rcPh"'+(rpt.photos?' checked':'')+'>作業写真をのせる</label>'+
      '<label class="pw-ck" style="margin-top:6px"><input type="checkbox" id="rcMemo"'+(rpt.memo?' checked':'')+'>日報の備考をのせる</label>'+
      '<div class="pw-bt" style="margin-top:12px"><button class="btn primary" type="button" data-act="rptprint">印刷・PDFにする</button><button class="btn" type="button" data-act="rptcsv">表をCSVで保存</button></div>'+
      '<div class="help" id="rptMsg" role="status" style="margin-top:8px">「印刷・PDFにする」を押して、印刷先に「PDFに保存」を選ぶとPDFになります。</div>';
  }
  $("rptCtl").addEventListener("input",rptCtlChange);
  $("rptCtl").addEventListener("change",rptCtlChange);
  function rptCtlChange(e){
    var t=e.target;
    if(t.id==="rcSite")rpt.site=t.value;
    else if(t.id==="rcPer"){rpt.period=t.value;$("rcCu").hidden=t.value!=="custom"}
    else if(t.id==="rcFrom")rpt.from=t.value; else if(t.id==="rcTo")rpt.to=t.value;
    else if(t.id==="rcAddr"){rpt.addr=t.value;try{localStorage.setItem("josetsu.rpt.addr",rpt.addr)}catch(e0){}}
    else if(t.id==="rcBy"){rpt.by=t.value;try{localStorage.setItem("josetsu.rpt.by",rpt.by)}catch(e0){}}
    else if(t.id==="rcPh")rpt.photos=t.checked; else if(t.id==="rcMemo")rpt.memo=t.checked; else return;
    renderRptDoc();
  }
  function rptCsv(){
    var s=siteById(rpt.site); if(!s)return;
    var lines=[["日付","開始","終了","作業","使用機械","積雪(cm)","担当班","記入者","備考"].map(csvCell2).join(",")];
    rptRows().forEach(function(r){lines.push([r.date,r.start||"",r.end||"",r.haisetsu?"排雪":"除雪",(r.machines||[]).join("・"),r.snowCm==null?"":r.snowCm,r.crew||"",who(r.by),r.note||""].map(csvCell2).join(","))});
    var rg=rptRange();
    csvSave("報告書_"+s.name+"_"+rg[0]+"_"+rg[1]+".csv",lines,"rptMsg");
  }
  function renderRptDoc(){
    var el=$("rptDoc"), s=siteById(rpt.site);
    if(!s){el.innerHTML='<div class="empty"><b>現場がありません</b></div>';return}
    var rg=rptRange(), rows=rptRows(), tot=0, noT=0, hai=0, mx=null;
    rows.forEach(function(r){var h=hoursOf(r); if(h==null)noT++; else tot+=h; if(r.haisetsu)hai++; var v=parseFloat(r.snowCm); if(isFinite(v)&&(mx==null||v>mx))mx=v});
    var hs=siteHands(s), td=new Date();
    var h='<article class="rd"><div class="rd-h"><h1>除雪作業報告書</h1><div class="rd-d">作成日 '+esc(jdate(todayStr()))+'</div></div>';
    if(rpt.addr)h+='<div class="rd-to">'+esc(rpt.addr)+' 御中</div>';
    h+='<table class="rd-i"><tr><th>現場名</th><td>'+esc(s.name)+'</td></tr>'+
      '<tr><th>住所</th><td>'+esc(s.address||"")+'</td></tr>'+
      '<tr><th>対象期間</th><td>'+esc(jdate(rg[0]))+' 〜 '+esc(jdate(rg[1]))+'</td></tr>'+
      '<tr><th>担当班</th><td>'+esc(s.crew||"")+'</td></tr>'+
      (sqmText(s)?'<tr><th>面積</th><td>'+esc(sqmText(s))+'</td></tr>':'')+
      (hs.length?'<tr><th>引渡時間</th><td>'+esc(handText(s))+'</td></tr>':'')+'</table>';
    h+='<div class="rd-s"><div><span>出動回数</span><b>'+rows.length+'<small>回</small></b></div><div><span>作業時間</span><b>'+fmt(tot,1)+'<small>時間</small></b></div><div><span>排雪</span><b>'+hai+'<small>回</small></b></div><div><span>最大積雪</span><b>'+(mx==null?'–':fmt(mx,1))+'<small>cm</small></b></div></div>';
    h+='<h2>作業実績</h2>';
    if(!rows.length)h+='<p class="rd-e">この期間の日報はありません。</p>';
    else{
      h+='<div class="rd-tw"><table class="rd-t"><thead><tr><th>日付</th><th>時間</th><th>作業</th><th>使用機械</th><th>積雪</th><th>担当</th>'+(rpt.memo?'<th>備考</th>':'')+'</tr></thead><tbody>'+rows.map(function(r){
        return '<tr><td>'+esc(mdw(r.date))+'</td><td class="nw">'+esc((r.start||"--:--")+"〜"+(r.end||"--:--"))+'</td><td>'+(r.haisetsu?"排雪":"除雪")+'</td><td>'+esc((r.machines||[]).join("・"))+'</td><td class="nw">'+(r.snowCm===""||r.snowCm==null?'':esc(r.snowCm)+'cm')+'</td><td>'+esc(r.crew||who(r.by))+'</td>'+(rpt.memo?'<td class="rd-m">'+esc(r.note||"")+'</td>':'')+'</tr>';
      }).join("")+'</tbody></table></div>';
      if(noT)h+='<p class="rd-n">※ 開始・終了時刻のない日報'+noT+'件は、作業時間に含めていません。</p>';
    }
    if(rpt.photos){
      var phs=[]; rows.forEach(function(r){(r.photos||[]).forEach(function(p){if(okId(p.id))phs.push({id:p.id,kind:p.kind,date:r.date})})});
      if(phs.length){
        h+='<h2>作業写真</h2><div class="rd-p">'+phs.map(function(p){var u=blobUrl(p.id);return '<figure><div class="im">'+(u?'<img src="'+esc(u)+'" alt="作業写真">':'<span>読み込み中…</span>')+'</div><figcaption>'+esc(mdw(p.date))+' '+esc(KIND[p.kind]||"")+'</figcaption></figure>'}).join("")+'</div>';
      }
    }
    h+='<div class="rd-f">'+(rpt.by?'作成者: '+esc(rpt.by):'')+'</div></article>';
    el.innerHTML=h;
  }

  /* ---------- 全体マップ ---------- */
  var SM={map:null,layer:null,vsig:"",fsig:"",loading:null,me:null,pins:[]};
  var LEAF="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  function parseLL(s){var m=/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(s||""));if(!m)return null;var a=+m[1],b=+m[2];return Math.abs(a)<=90&&Math.abs(b)<=180?[a,b]:null}
  function loadLeaflet(){
    if(window.L&&window.L.map)return Promise.resolve();
    if(SM.loading)return SM.loading;
    SM.loading=new Promise(function(res,rej){
      var l=document.createElement("link"); l.rel="stylesheet"; l.href=LEAF+"leaflet.min.css"; document.head.appendChild(l);
      var sc=document.createElement("script"); sc.src=LEAF+"leaflet.min.js";
      sc.onload=function(){window.L&&window.L.map?res():(SM.loading=null,rej(new Error("leaflet")))};
      sc.onerror=function(){SM.loading=null;rej(new Error("load"))};
      document.head.appendChild(sc);
    });
    return SM.loading;
  }
  var MPC={3:"#C1443C",2:"#D79A1B",1:"#1E8449",0:"#7B8794"};
  function pinIcon(p){
    var out=stOf(p.s)==="out", lv=p.a.lv;
    return L.divIcon({className:"mpin-w",iconSize:[30,40],iconAnchor:[15,38],popupAnchor:[0,-34],
      html:'<div class="mpin l'+lv+(out?' out':'')+'"><i></i><span class="pl">'+esc(p.s.name)+'</span></div>'});
  }
  function pinPopup(p){
    var s=p.s, a=p.a, st=stOf(s);
    return '<div class="mpp"><b>'+esc(s.name)+'</b><div class="muted">'+esc([s.area,s.crew?('担当 '+s.crew):''].filter(Boolean).join(' ・ '))+'</div>'+
      '<div class="mpp-r"><span class="pill l'+a.lv+'">'+esc(a.label)+'</span><span class="tag">'+esc(ST[st])+'</span></div>'+
      (a.lv>0?'<div>降雪目安 <b>約'+fmt(a.snow2,0)+'cm</b> / 基準'+esc(s.threshold||10)+'cm</div>':'')+
      (siteHands(s).length?'<div>引渡 '+esc(handText(s,1))+'</div>':'')+
      '<button class="btn sm primary" type="button" data-mopen="'+esc(s.id)+'">詳細を見る</button></div>';
  }
  function mapFit(){
    if(!SM.map||!SM.pins.length)return;
    if(SM.pins.length===1)SM.map.setView(SM.pins[0].ll,14);
    else SM.map.fitBounds(L.latLngBounds(SM.pins.map(function(p){return p.ll})),{padding:[44,44],maxZoom:15});
  }
  function mapLbl(){if(SM.map)$("siteMap").classList.toggle("z-lbl",SM.map.getZoom()>=12)}
  function renderSiteMap(items){
    var pins=[], un=[];
    items.forEach(function(x){var ll=parseLL(effLoc(x.s)); if(ll)pins.push({s:x.s,a:x.a,ll:ll}); else un.push(x.s)});
    SM.pins=pins;
    var cnt={3:0,2:0,1:0,0:0}; pins.forEach(function(p){cnt[p.a.lv]++});
    $("mpLeg").innerHTML=[[3,"出動目安"],[2,"警戒"],[1,"平常"],[0,"未取得"]].map(function(g){return '<span class="lg"><i style="background:'+MPC[g[0]]+'"></i>'+g[1]+' <b class="num">'+cnt[g[0]]+'</b></span>'}).join("")+'<span class="lg"><i class="ring"></i>出動中</span>';
    $("mpUn").innerHTML=un.length?'<div class="mp-un"><b>地図に出せない現場('+un.length+'件)</b>:'+un.map(function(s){return esc(s.name)}).join("、")+'<div class="muted">「設定」の現場編集で、天気を調べる場所(位置)を登録すると表示されます。</div></div>':'';
    var vsig=pins.map(function(p){return [p.s.id,p.ll.join(),p.a.lv,p.a.label,stOf(p.s),p.s.name,p.a.snow2].join("~")}).join("|");
    if(SM.map&&vsig===SM.vsig){SM.map.invalidateSize();return}
    $("mpMsg").textContent=SM.map?"":"地図を読み込み中…";
    loadLeaflet().then(function(){
      if(layout!=="map")return;
      if(!SM.map){
        SM.map=L.map("siteMap",{zoomControl:true,worldCopyJump:false}).setView([39.7,141.15],10);
        L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",{maxZoom:18,attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'}).addTo(SM.map);
        SM.layer=L.layerGroup().addTo(SM.map);
        SM.map.on("zoomend",mapLbl);
        SM.map.on("popupopen",function(e){var el=e.popup.getElement(), b=el&&el.querySelector("[data-mopen]"); if(b)b.addEventListener("click",function(){SM.map.closePopup();openDetail(b.dataset.mopen)})});
      }
      SM.map.invalidateSize();
      SM.layer.clearLayers();
      SM.pins.forEach(function(p){
        L.marker(p.ll,{icon:pinIcon(p),title:p.s.name,riseOnHover:true,zIndexOffset:p.a.lv*100+(stOf(p.s)==="out"?1000:0)}).bindPopup(pinPopup(p),{maxWidth:260}).addTo(SM.layer);
      });
      SM.vsig=vsig;
      var fsig=SM.pins.map(function(p){return p.s.id}).join("|");
      if(fsig!==SM.fsig){SM.fsig=fsig;mapFit()}
      mapLbl(); $("mpMsg").textContent="";
    }).catch(function(){
      $("mpMsg").textContent="";
      $("siteMap").innerHTML='<div class="empty" style="margin:12px"><b>地図を読み込めませんでした</b>通信状態を確かめて、もう一度お試しください。</div>';
      SM.map=null;
    });
  }
  $("mpFit").addEventListener("click",function(){mapFit()});
  $("mpMe").addEventListener("click",function(){
    if(!SM.map)return;
    if(!navigator.geolocation){$("mpMsg").textContent="この端末では現在地を取得できません。";return}
    $("mpMsg").textContent="現在地を調べています…";
    navigator.geolocation.getCurrentPosition(function(pos){
      var ll=[pos.coords.latitude,pos.coords.longitude];
      if(SM.me)SM.me.remove();
      SM.me=L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#2F6FA8",fillOpacity:1}).addTo(SM.map);
      SM.map.setView(ll,Math.max(SM.map.getZoom(),13)); $("mpMsg").textContent="";
    },function(){$("mpMsg").textContent="現在地を取得できませんでした。位置情報の許可をご確認ください。"},{enableHighAccuracy:true,timeout:10000});
  });

  /* ---------- 機械・備品の稼働ボード ---------- */
  function mchRuns(m,day){
    // その機械を使った日報(日付が一致するもの)
    return reports.filter(function(r){return r.date===day&&r.machines&&r.machines.indexOf(m)>=0})
      .sort(function(a,b){return String(a.start||"").localeCompare(String(b.start||""))});
  }
  function mchState(r,day,nowM,today){
    // 稼働中か、終了済みか、これからか
    var st=hm2m(r.start), en=hm2m(r.end);
    if(r.date===today){
      if(st==null&&en==null)return "done";
      if(st!=null&&nowM<st)return "plan";
      if(en==null)return "run";
      var over=st!=null&&en<st;
      return (over||nowM<=en)?"run":"done";
    }
    return "done";
  }
  function hm2m(t){var m=/^(\d{1,2}):(\d{2})/.exec(t||"");return m?(+m[1])*60+(+m[2]):null}
  function renderMachines(){
    var now=new Date(), today=todayStr(), nowM=now.getHours()*60+now.getMinutes();
    var names=masters.machines.slice();
    reports.forEach(function(r){(r.machines||[]).forEach(function(m){if(names.indexOf(m)<0)names.push(m)})});
    var yd=dstr(new Date(now.getTime()-86400000));
    var days=[];for(var i=6;i>=0;i--)days.push(dstr(new Date(now.getTime()-i*86400000)));
    var sr=seasonRange(seasonOf(today));
    var rows=names.map(function(m){
      var tr=mchRuns(m,today), st="idle", cur=null;
      tr.forEach(function(r){var k=mchState(r,today,nowM,today);r.__k=k; if(k==="run"&&!cur){st="run";cur=r}});
      // 日をまたぐ作業(昨日開始・終了が翌日)
      if(st!=="run")mchRuns(m,yd).forEach(function(r){var s1=hm2m(r.start),e1=hm2m(r.end);if(s1!=null&&e1!=null&&e1<s1&&nowM<=e1){st="run";cur=r}});
      if(st!=="run"&&tr.some(function(r){return r.__k==="done"}))st="done";
      if(st==="idle"&&tr.some(function(r){return r.__k==="plan"}))st="plan";
      var used=days.map(function(d){return mchRuns(m,d).length});
      var season=reports.filter(function(r){return r.date>=sr[0]&&r.date<=sr[1]&&r.machines&&r.machines.indexOf(m)>=0}).length;
      var last=reports.filter(function(r){return r.machines&&r.machines.indexOf(m)>=0&&r.date<today}).map(function(r){return r.date}).sort().pop();
      return {m:m,st:st,cur:cur,tr:tr,used:used,season:season,last:last};
    });
    var ord={run:0,plan:1,done:2,idle:3};
    rows.sort(function(a,b){return ord[a.st]-ord[b.st]||a.m.localeCompare(b.m,"ja")});
    var cnt={run:0,plan:0,done:0,idle:0}; rows.forEach(function(r){cnt[r.st]++});
    var L={run:"稼働中",plan:"予定あり",done:"本日稼働済",idle:"待機"};
    var h='<div class="mbh"><h1 class="mbt">機械・備品の稼働</h1><span class="muted">'+esc(today.replace(/-/g,"/"))+' '+p2(now.getHours())+':'+p2(now.getMinutes())+' 現在</span></div>';
    h+='<div class="mbs">'+["run","plan","done","idle"].map(function(k){return '<div class="mbsn k-'+k+'"><span class="n num">'+cnt[k]+'</span><span class="l">'+L[k]+'</span></div>'}).join("")+'</div>';
    if(!rows.length)h+='<div class="empty"><b>機械が登録されていません</b><br>設定のマスタで機械・備品を登録すると、ここに表示されます。</div>';
    else h+='<div class="mbg">'+rows.map(function(x){
      var wd=["日","月","火","水","木","金","土"];
      var bars=x.used.map(function(c,i){var d=new Date(now.getTime()-(6-i)*86400000);return '<span class="mbd'+(c?' on':'')+(i===6?' tdy':'')+'" title="'+(d.getMonth()+1)+'/'+d.getDate()+' '+c+'回"><i>'+(c||'')+'</i><em>'+wd[d.getDay()]+'</em></span>'}).join("");
      var lines=x.tr.length?x.tr.map(function(r){
        var k=r.__k||"done";
        return '<button type="button" class="mbl k-'+k+'" data-act="rep" data-id="'+esc(r.id)+'"><span class="tm num">'+esc(r.start||"--:--")+'〜'+esc(r.end||"--:--")+'</span><span class="nm">'+esc(r.siteName||"(現場名なし)")+'</span><span class="cw">'+esc(r.crew||"")+'</span></button>';
      }).join(""):'<div class="mbn muted">'+(x.last?'最後の稼働 '+esc(x.last.slice(5).replace("-","/"))+'':'今シーズンはまだ稼働していません')+'</div>';
      return '<article class="card2 mbc k-'+x.st+'"><div class="mbc-h"><b class="mbnm">'+esc(x.m)+'</b><span class="mbp k-'+x.st+'">'+L[x.st]+'</span></div>'+
        '<div class="mbls">'+lines+'</div>'+
        '<div class="mbf"><div class="mbds" aria-label="直近7日の稼働回数">'+bars+'</div><div class="mbse"><span class="muted">今シーズン</span><b class="num">'+x.season+'</b><small>回</small></div></div></article>';
    }).join("")+'</div>';
    h+='<p class="legend">日報の「使用機械」から自動で集計しています。開始〜終了の時刻内は「稼働中」、時刻が過ぎると「本日稼働済」と表示します。日報に機械を入れ忘れると、ここには出ません。</p>';
    $("machBody").innerHTML=h;
  }

  function machList(extra){
    var l=masters.machines.slice();
    (extra||[]).forEach(function(m){if(l.indexOf(m)<0)l.push(m)});
    return l;
  }
  function renderMachChips(sel){
    $("rfMach").innerHTML=machList(sel).map(function(m){
      return '<label class="tg"><input type="checkbox" data-mach="'+esc(m)+'"'+(sel.indexOf(m)>=0?' checked':'')+'><span>'+esc(m)+'</span></label>';
    }).join("");
  }
  function machSel(){return Array.prototype.map.call($("rfMach").querySelectorAll("input:checked"),function(i){return i.getAttribute("data-mach")})}
  function renderRfPhotos(){
    var h=rf.photos.map(function(p,i){
      return '<div class="phb"><button type="button" data-act="photo" data-g="form" data-i="'+i+'" style="border:0;padding:0;background:none;width:100%;height:100%;cursor:pointer" aria-label="写真を大きく表示"><img src="'+esc(blobUrl(p.id))+'" alt="'+esc(KIND[p.kind]||"写真")+'"></button><span class="pk">'+esc(KIND[p.kind]||"その他")+'</span><button class="px" type="button" data-act="rfrm" data-i="'+i+'" aria-label="この写真を外す">×</button></div>';
    }).join("");
    if(rf.up)h+='<div class="phb ph-load">送信中…</div>';
    $("rfPhotos").innerHTML=h;
  }
  function openReportForm(siteId,repId){
    if(!canWrite()){toast("日報を書く権限がありません。");return}
    var r=repId?reports.filter(function(x){return x.id===repId})[0]:null;
    if(repId&&!r)return;
    rf={id:repId||null,photos:r?(r.photos||[]).filter(function(p){return okId(p.id)}).map(function(p){return {id:p.id,kind:p.kind||"other"}}):[],added:[],removed:[],up:0};
    $("rfTitle").textContent=r?"日報を編集":"作業日報を書く";
    var opts=sites.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name),"ja")});
    var sid=r?r.siteId:siteId;
    var o=opts.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join("");
    if(r&&!siteById(r.siteId))o='<option value="'+esc(r.siteId)+'">'+esc(r.siteName||"削除された現場")+'</option>'+o;
    $("rfSite").innerHTML='<option value="">現場を選んでください</option>'+o;
    $("rfSite").value=sid||"";
    $("rfDate").value=r?r.date:todayStr();
    $("rfStart").value=r?(r.start||""):"";
    $("rfEnd").value=r?(r.end||""):"";
    var s0=sid?siteById(sid):null;
    $("rfCrew").value=r?(r.crew||""):(s0&&s0.crew||"");
    $("rfSnow").value=r&&r.snowCm!=null?r.snowCm:"";
    renderMachChips(r?(r.machines||[]):[]);
    $("rfHai").checked=!!(r&&r.haisetsu);
    $("rfNote").value=r?(r.note||""):"";
    $("rfKind").value="after"; $("rfFile").value="";
    $("rfPhotoSec").hidden=!(canPhoto&&assets)&&!rf.photos.length;
    $("rfFile").closest("label").hidden=!(canPhoto&&assets);
    $("rfKind").closest("label").hidden=!(canPhoto&&assets);
    $("rfPhMsg").textContent=(canPhoto&&assets)?"":"写真を追加できるのは、このページの編集権限がある方のみです。";
    $("rfDoneWrap").hidden=!!r;
    $("rfDone").checked=!r;
    $("rfErr").textContent="";
    $("rfSave").disabled=false;
    renderRfPhotos();
    openSheet("rform");
  }
  async function dropAssets(ids){
    if(!assets)return;
    for(var i=0;i<ids.length;i++){try{await assets.delete(ids[i])}catch(e){}}
  }
  async function closeRform(){
    if(rf&&rf.added.length){var ids=rf.added.slice();rf.added=[];await dropAssets(ids)}
    rf=null; $("rform").hidden=true; lockBody();
  }
  function upErr(e){
    var c=e&&e.code;
    if(c==="too_large")return "写真が大きすぎます。";
    if(c==="unsupported_type")return "この形式の写真は追加できません。";
    if(c==="quota_exceeded"||c==="storage_full")return "写真の保存容量がいっぱいです。";
    if(c==="forbidden"||c==="permission_denied"||c==="not_writer")return "写真を追加する権限がありません。";
    return "写真を追加できませんでした。もう一度お試しください。";
  }
  $("rfFile").addEventListener("change",async function(e){
    var files=Array.prototype.slice.call(e.target.files||[]); e.target.value="";
    if(!rf||!assets||!files.length)return;
    var kind=$("rfKind").value, fails=0, last="";
    for(var i=0;i<files.length;i++){
      if(!rf)return;
      rf.up++; $("rfPhMsg").textContent="写真を送信しています…("+(i+1)+"/"+files.length+")"; renderRfPhotos();
      try{
        var sh=await shrink(files[i]);
        var res=await assets.upload(sh.blob,{type:sh.type});
        if(!rf){try{await assets.delete(res.id)}catch(e2){}return}
        rf.photos.push({id:res.id,kind:kind}); rf.added.push(res.id);
      }catch(err){fails++;last=err&&err.code?upErr(err):"この写真は読み込めませんでした。"}
      if(rf)rf.up--;
      if(rf)renderRfPhotos();
    }
    if(rf)$("rfPhMsg").textContent=fails?(fails+"枚を追加できませんでした。"+last):files.length+"枚を追加しました。";
  });
  $("rfSite").addEventListener("change",function(){
    var s=siteById($("rfSite").value);
    if(s&&s.crew&&!$("rfCrew").value.trim())$("rfCrew").value=s.crew;
  });
  function nowHM(){var d=new Date();return p2(d.getHours())+":"+p2(d.getMinutes())}
  $("rfForm").addEventListener("submit",async function(e){
    e.preventDefault();
    if(!rf||!db)return;
    var sid=$("rfSite").value, date=$("rfDate").value;
    if(!sid){$("rfErr").textContent="現場を選んでください。";return}
    if(!date){$("rfErr").textContent="作業日を入力してください。";return}
    if(rf.up){$("rfErr").textContent="写真の送信が終わるまでお待ちください。";return}
    var s=siteById(sid), old=rf.id?reports.filter(function(x){return x.id===rf.id})[0]:null;
    var sn=parseFloat($("rfSnow").value);
    var data={
      siteId:sid, siteName:s?s.name:(old&&old.siteName)||"", date:date,
      start:$("rfStart").value||"", end:$("rfEnd").value||"", crew:$("rfCrew").value.trim(),
      snowCm:isFinite(sn)?sn:"", machines:machSel(), haisetsu:$("rfHai").checked, note:$("rfNote").value.trim(),
      photos:rf.photos.map(function(p){return {id:p.id,kind:p.kind}}), updatedAt:Date.now()
    };
    $("rfSave").disabled=true; $("rfErr").textContent="";
    try{
      if(rf.id){await db.doc("reports/"+rf.id).update(data)}
      else{
        data.by=myId||""; data.at=Date.now();
        var rpr=await db.collection("reports").add(data);
        pwaNotify("report",rpr&&rpr.id);
        if($("rfDone").checked&&s){try{await db.doc("ops/"+sid).set({status:"done",statusAt:Date.now(),statusBy:myName||""});pwaNotify("status",sid)}catch(e2){}}
      }
      var gone=rf.removed.slice(); rf.added=[]; rf.removed=[];
      rf=null; $("rform").hidden=true; lockBody();
      dropAssets(gone);
      toast("日報を保存しました。");
      if(!$("rview").hidden)renderRepView();
      render();
    }catch(err){
      $("rfErr").textContent=(err&&err.code==="quota_exceeded")?"登録できる件数の上限に達しています。":"保存できませんでした。もう一度お試しください。";
      $("rfSave").disabled=false;
    }
  });

  /* ---------- 写真ビューア ---------- */
  function lbShow(){
    var p=lb.list[lb.i]; if(!p)return;
    $("lbImg").dataset.pid=p.src?"":p.id; $("lbImg").src=p.src||blobUrl(p.id);
    $("lbCap").textContent=(p.cap||(p.kind?(KIND[p.kind]||"写真"):(p.at?fmtDT(p.at):"案件の写真")))+"  "+(lb.i+1)+" / "+lb.list.length;
    $("lb").querySelector(".pv").hidden=lb.list.length<2; $("lb").querySelector(".nx").hidden=lb.list.length<2;
  }
  function openLb(group,i){
    var list=[];
    if(group==="form")list=rf?rf.photos:[];
    else if(group==="detail")list=detailPhotos;
    else if(group==="site")list=sitePh;
    else if(group==="draw")list=drawCur;
    else if(group.indexOf("rep:")===0){var r=reports.filter(function(x){return x.id===group.slice(4)})[0];list=r?(r.photos||[]):[]}
    list=list.filter(function(p){return okId(p.id)});
    if(!list.length)return;
    lb={list:list,i:Math.min(i,list.length-1)}; $("lb").hidden=false; lbShow();
  }

  /* ---------- 連絡板 ---------- */
  function renderNotes(){
    syncSiteSels();
    $("ntFilter").value=ntF;
    var list=notes.filter(function(n){return ntF==="all"||(ntF==="none"?!n.siteId:n.siteId===ntF)});
    $("ntPost").disabled=!canWrite();
    $("noteList").innerHTML=list.length?list.map(noteCard).join(""):'<div class="empty"><b>連絡はまだありません</b>現場への申し送りや、全員への連絡を書いておくと、みんなの画面に表示されます。</div>';
  }
  $("noteForm").addEventListener("submit",async function(e){
    e.preventDefault();
    if(!canWrite())return;
    var text=$("ntText").value.trim(); if(!text){toast("連絡内容を入力してください。");return}
    var sid=$("ntSite").value, s=sid?siteById(sid):null;
    $("ntPost").disabled=true;
    try{
      var ntr=await db.collection("notes").add({siteId:sid,siteName:s?s.name:"",text:text,by:myId||"",at:Date.now()});
      pwaNotify("note",ntr&&ntr.id);
      $("ntText").value=""; toast("連絡を投稿しました。");
    }catch(err){toast(err&&err.code==="quota_exceeded"?"登録できる件数の上限に達しています。":"投稿できませんでした。もう一度お試しください。")}
    finally{$("ntPost").disabled=false}
  });
  $("ntFilter").addEventListener("change",function(e){ntF=e.target.value;renderNotes()});

  /* ---------- 集計 ---------- */
  function initStats(){var n=new Date();stS.y=n.getFullYear();stS.m=n.getMonth()+1;stS.sy=seasonOf(todayStr())}
  function statRange(){
    if(stS.mode==="season"){var r=seasonRange(stS.sy);return {a:r[0],b:r[1],label:stS.sy+"〜"+(stS.sy+1)+"年シーズン"}}
    var ym=stS.y+"-"+p2(stS.m);
    return {a:ym+"-01",b:ym+"-31",label:stS.y+"年"+stS.m+"月"};
  }
  function statsData(){
    var rg=statRange(), by={}, rows=[];
    reports.forEach(function(r){
      if(!r.date||r.date<rg.a||r.date>rg.b)return;
      var k=r.siteId||("n:"+r.siteName);
      var o=by[k]||(by[k]={id:r.siteId,name:r.siteName||"",n:0,h:0,hai:0,noTime:0,kn:{all:0,joset:0,hai:0},kh:{all:0,joset:0,hai:0}});
      var hr=hoursOf(r);
      o.n++; if(hr==null)o.noTime++; else o.h+=hr;
      if(r.haisetsu)o.hai++;
      ["all",r.haisetsu?"hai":"joset"].forEach(function(kk){o.kn[kk]++; o.kh[kk]+=(hr==null?0:hr)});
    });
    var tot={n:0,h:0,hai:0,amt:0,noPrice:0,noTime:0};
    Object.keys(by).forEach(function(k){
      var o=by[k], s=o.id?siteById(o.id):null;
      if(s)o.name=s.name;
      o.area=s?s.area||"":""; var sl=s?siteLines(s):[], pl=sl.filter(function(l){return l.unitPrice>0&&l.kind!=="other"}); o.price=pl.length?pl[0].unitPrice:0; o.unit=pl.length?pl[0].unit:"回"; o.contract=sl.reduce(function(a,l){return a+l.count},0);
      o.amt=pl.length?pl.reduce(function(a,l){return a+l.unitPrice*(l.unit==="時間"?o.kh[l.kind]:o.kn[l.kind])},0):null;
      if(o.amt==null&&canAdmin)tot.noPrice++; else tot.amt+=o.amt;
      if(pl.some(function(l){return l.unit==="時間"}))tot.noTime+=o.noTime;
      tot.n+=o.n; tot.h+=o.h; tot.hai+=o.hai;
      rows.push(o);
    });
    rows.sort(function(a,b){return (b.amt||0)-(a.amt||0)||b.n-a.n||String(a.name).localeCompare(String(b.name),"ja")});
    return {rg:rg,rows:rows,tot:tot};
  }
  function renderStats(){
    var d=statsData(), t=d.tot;
    $("stLabel").textContent=d.rg.label;
    Array.prototype.forEach.call($("stMode").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.mode===stS.mode))});
    var h='<div class="tiles">'+
      '<div class="tile"><span class="n">'+t.n+'</span><span class="l">出動回数(日報の件数)</span></div>'+
      '<div class="tile"><span class="n">'+fmt(t.h,1)+'</span><span class="l">作業時間(時間)</span></div>'+
      '<div class="tile"><span class="n">'+t.hai+'</span><span class="l">排雪の回数</span></div>'+
      (canAdmin?'<div class="tile money"><span class="n" style="font-size:1.5rem;padding-top:.35rem">'+yen(t.amt)+'</span><span class="l">請求見込み'+admBadge()+'</span></div>':'')+'</div>';
    var notes2=[];
    if(canAdmin&&t.noPrice)notes2.push('単価が未登録の'+t.noPrice+'現場は、請求見込みに含みません。');
    if(canAdmin&&t.noTime)notes2.push('時間単価の現場で、開始・終了時刻のない日報'+t.noTime+'件は、作業時間0として計算しています。');
    if(notes2.length)h+='<div class="banner" style="margin-top:12px">'+esc(notes2.join(" "))+'</div>';
    h+='<div class="sec"><h2>現場ごとの実績<span class="gc num">'+d.rows.length+'件</span>'+(canAdmin?admBadge():'')+'</h2></div>';
    if(!d.rows.length)h+='<div class="empty"><b>この期間の日報はありません</b>日報を書くと、ここに出動回数などが集計されます。</div>';
    else h+='<div class="stack">'+d.rows.map(function(o){
      var left=['出動 '+o.n+'回'+(o.h>0||o.unit==="時間"?' ・ 作業 '+fmt(o.h,1)+'時間':'')+(o.hai?' ・ 排雪 '+o.hai+'回':'')];
      if(stS.mode==="season"&&o.contract)left.push('契約 '+o.contract+'回 中 '+o.n+'回'+(o.n>o.contract?'(契約回数を超過)':''));
      return '<div class="srow'+(canAdmin&&o.amt!=null?' money':'')+'"><div class="nm">'+esc(o.name||"(現場名なし)")+'</div><div class="amt">'+(!canAdmin?'':o.amt==null?'<span class="muted">単価なし</span>':yen(o.amt))+'</div><div class="sb">'+left.map(esc).join('<br>')+'</div><div class="sb r">'+(o.price?esc(yen(o.price)+' / '+o.unit):'')+'</div></div>';
    }).join("")+'</div>';
    $("statsBody").innerHTML=h;
    $("stLegend").hidden=!canAdmin;
    $("stCsv").disabled=!d.rows.length||!dl;
  }
  function csvCell(v){v=String(v==null?"":v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
  $("stCsv").addEventListener("click",async function(){
    if(!dl)return;
    var d=statsData(), hd=["現場名","地区","出動回数","作業時間(時間)","排雪の回数"].concat(canAdmin?["単価(円)","単価の単位","請求見込み(円)"]:[]).concat(["契約回数"]);
    var lines=[hd.map(csvCell).join(",")];
    d.rows.forEach(function(o){lines.push([o.name,o.area,o.n,fmt(o.h,1),o.hai].concat(canAdmin?[o.price||"",o.price?o.unit:"",o.amt==null?"":Math.round(o.amt)]:[]).concat([o.contract||""]).map(csvCell).join(","))});
    var fn="除雪実績_"+(stS.mode==="season"?stS.sy+"-"+(stS.sy+1)+"シーズン":stS.y+"-"+p2(stS.m))+".csv";
    try{await dl.save({filename:fn,data:"﻿"+lines.join("\r\n")});flash("stMsg","保存しました。")}
    catch(err){if(!err||err.code!=="declined")flash("stMsg","保存できませんでした。")}
  });
  $("stMode").addEventListener("click",function(e){var b=e.target.closest("button[data-mode]");if(!b)return;stS.mode=b.dataset.mode;renderStats()});
  function stepStat(dir){
    if(stS.mode==="season")stS.sy+=dir;
    else{stS.m+=dir;if(stS.m>12){stS.m=1;stS.y++}if(stS.m<1){stS.m=12;stS.y--}}
    renderStats();
  }
  $("stPrev").addEventListener("click",function(){stepStat(-1)});
  $("stNext").addEventListener("click",function(){stepStat(1)});
