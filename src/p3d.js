
  /* ---------- 画面の切り替え・描画 ---------- */
  var TABI={
    home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    machines:'<path d="M3 17h13v-5l-3-4H8v4H3z"/><circle cx="7" cy="18" r="2"/><circle cx="14" cy="18" r="2"/><path d="M16 12h4l1 3v3h-3"/>',
    sites:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    reports:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    notes:'<path d="M4 5h16v11H9l-5 4z"/>',
    stats:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    members:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.7 0 4.5 2 4.5 4.8"/>',
    admin:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
  };
  var TABS=[["home","ホーム"],["sites","現場一覧"],["machines","機械"],["reports","日報"],["notes","連絡"],["stats","集計"],["admin","設定"]];
  function goto(v,f){
    if(v==="sites"&&f){filter=f;query="";$("query").value="";areaF=""}
    if(v==="members"){view="admin";sub="members"}
    else{view=v;if(v==="admin"&&sub==="members")sub="sites"}
    render(); window.scrollTo(0,0);
  }
  window.addEventListener("blobloaded",function(){render();var lb=$("lbImg");if(lb&&lb.dataset.pid){var u=blobUrl(lb.dataset.pid);if(u)lb.src=u}});
  setInterval(function(){if(view==="machines"&&!document.hidden)render()},60000);
  var rqT=0;
  function render(){ if(rqT)return; rqT=setTimeout(function(){rqT=0;doRender()},16); }
  function doRender(){
    if(!canAdmin&&view==="admin")view="home";
    var NAV=TABS.filter(function(t){return t[0]!=="admin"});
    if(canAdmin){NAV.push(["members","メンバー管理"]);NAV.push(["admin","設定"])}
    $("tabbar").innerHTML=NAV.map(function(t){
      var cur=t[0]==="members"?(view==="admin"&&sub==="members"):t[0]==="admin"?(view==="admin"&&sub!=="members"):view===t[0];
      return '<button type="button" data-nav="'+t[0]+'"'+(cur?' aria-current="page"':'')+'><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+TABI[t[0]]+'</svg><span class="tf">'+t[1]+'</span><span class="ts">'+({sites:"現場",members:"メンバー"}[t[0]]||t[1])+'</span></button>';
    }).join("");
    TABS.forEach(function(t){$("v-"+t[0]).hidden=(view!==t[0])});
    $("fab").hidden=!(canWrite()&&(view==="home"||view==="sites"||view==="reports"));
    $("upd").textContent=lastAt?timeStr(lastAt):"--:--";
    if(view==="home")renderHome();
    else if(view==="sites")renderSites();
    else if(view==="machines")renderMachines();
    else if(view==="reports")renderReports();
    else if(view==="notes")renderNotes();
    else if(view==="stats")renderStats();
    else if(view==="admin")renderAdminAll();
    renderBell();
    renderDetail(); renderRepView(); if(!$("rpt").hidden)renderRptDoc();
  }
  $("filtBtn").addEventListener("click",function(){var v=$("v-sites");v.classList.toggle("fopen");render()});
  $("query").addEventListener("input",function(e){query=e.target.value;render()});
  $("areaSel").addEventListener("change",function(e){areaF=e.target.value;render()});
  $("crewSel").addEventListener("change",function(e){crewF=e.target.value;render()});
  $("stSel").addEventListener("change",function(e){stF=e.target.value;render()});
  $("sortSel").addEventListener("change",function(e){sortK=e.target.value;sortDir=(sortK==="snow"||sortK==="count"||sortK==="created")?-1:1;render()});
  $("sortDir").addEventListener("click",function(){sortDir=-sortDir;render()});
  $("siteReset").addEventListener("click",function(){query="";$("query").value="";areaF="";crewF="";stF="";filter="all";sortK="manual";sortDir=1;render()});
  $("repPeriod").addEventListener("change",function(e){repFilter.period=e.target.value;render()});
  $("repSiteSel").addEventListener("change",function(e){repFilter.site=e.target.value;render()});
  $("btnRefresh").addEventListener("click",function(){refreshAll(true)});

  /* ---------- 操作 ---------- */
  var armKey="", armT=0;
  function arm(key,btn,orig){
    if(armKey===key){armKey="";clearTimeout(armT);return true}
    armKey=key; btn.textContent="もう一度押すと削除";
    clearTimeout(armT); armT=setTimeout(function(){armKey="";btn.textContent=orig},4000);
    return false;
  }
  document.addEventListener("click",async function(e){
    if(e.target.closest("select"))return;
    var t=e.target.closest("[data-act],[data-nav],[data-filter],[data-layout]"); if(!t||t.disabled)return;
    var d=t.dataset;
    if(d.layout){layout=d.layout;if(layout!=="map"){try{localStorage.setItem("josetsu.layout2",layout)}catch(e2){}}render();return}
    if(d.act==="openmap"){layout="map";goto("sites");return}
    if(d.nav){goto(d.nav,d.f);return}
    if(d.filter){filter=d.filter;render();return}
    var act=d.act, id=d.id, s=id?siteById(id):null;
    if(act==="mv"){moveSite(id,+d.d,(t.closest("#admList")?$("admList"):$("siteList")).__ids||[])}
    else if(act==="open"){if(s)openDetail(id)}
    else if(act==="open2"){closeSheet("rview");if(s)openDetail(id)}
    else if(act==="close"){closeSheet(d.sheet)}
    else if(act==="logout"){if(window.__FB)window.__FB.signOut()}
    else if(act==="inbox"){openNotices()}
    else if(act==="annhist"){openAnnHist()}
    else if(act==="anopen"){openAnnView(id)}
    else if(act==="retry"){if(s)loadOne(s,true)}
    else if(act==="edit"){if(canAdmin)openDlg(id)}
    else if(act==="copy"){if(canAdmin)openDlg(id,true)}
    else if(act==="status"){
      if(!s||!canWrite()||busy[id]||stOf(s)===d.v)return;
      busy[id]=true;
      try{await db.doc("ops/"+id).set({status:d.v,statusAt:Date.now(),statusBy:myName||""});pwaNotify("status",id)}catch(err){toast("作業状況を保存できませんでした。")}
      busy[id]=false;
    }
    else if(act==="newrep"){openReportForm(id||(detailId||""),null)}
    else if(act==="newnote"){
      closeSheet("detail"); goto("notes");
      setTimeout(function(){$("ntSite").value=id||"";$("ntText").focus()},60);
    }
    else if(act==="allreps"){closeSheet("detail");repFilter={period:"all",site:id};goto("reports")}
    else if(act==="rep"){openRepView(id)}
    else if(act==="repedit"){var r0=reports.filter(function(x){return x.id===id})[0];if(r0)openReportForm(r0.siteId,id)}
    else if(act==="repdel"){
      if(!arm("rd"+id,t,"削除"))return;
      var r1=reports.filter(function(x){return x.id===id})[0];
      try{await db.doc("reports/"+id).delete();if(r1)dropAssets((r1.photos||[]).map(function(p){return p.id}));closeSheet("rview");toast("日報を削除しました。")}
      catch(err){toast("削除できませんでした。")}
    }
    else if(act==="ntdel"){
      if(!arm("nd"+id,t,"削除"))return;
      try{await db.doc("notes/"+id).delete();toast("連絡を削除しました。")}catch(err){toast("削除できませんでした。")}
    }
    else if(act==="rfcancel"){closeRform()}
    else if(act==="rfnow"){$(d.t==="end"?"rfEnd":"rfStart").value=nowHM()}
    else if(act==="rfrm"){
      if(!rf)return;
      var p=rf.photos.splice(+d.i,1)[0]; if(!p)return;
      var ai=rf.added.indexOf(p.id);
      if(ai>=0){rf.added.splice(ai,1);dropAssets([p.id])}else rf.removed.push(p.id);
      renderRfPhotos();
    }
    else if(act==="photo"){openLb(d.g,+d.i)}
    else if(act==="spadd"){spSite=id;$("spFile").click()}
    else if(act==="dwadd"){spSite=id;$("dwFile").click()}
    else if(act==="rptnew"){openRpt(id||repFilter.site||"")}
    else if(act==="rptprint"){try{window.print()}catch(e){toast("この画面では印刷できません。ブラウザで開いてください。")}}
    else if(act==="rptcsv"){rptCsv()}
    else if(act==="appset"){pwa.msg="";openAppSet()}
    else if(act==="appsetlater"){try{localStorage.setItem("josetsu.promo2","1")}catch(e){}render()}
    else if(act==="jump"){var el=$(d.t); if(el)el.scrollIntoView({behavior:"smooth",block:"start"});}
    else if(act==="dwopen"){
      var w=window.open("","_blank"), dm=$("dwMsg");
      try{
        var u=window.__fileUrl?await window.__fileUrl(id):("/_blob/"+id);
        if(w)w.location.href=u; else location.href=u;
      }catch(err){if(w)w.close();toast("図面を開けませんでした。")}
    }
    else if(act==="dwdel"){
      if(!arm("dwdel:"+id,t,"削除"))return;
      try{await db.doc("sphotos/"+id).delete();try{await assets.delete(id)}catch(e1){}toast("図面を削除しました。")}catch(err){toast("削除できませんでした。")}
    }
    else if(act==="spdel"){
      if(!arm("spdel:"+id,t,"×"))return;
      try{await db.doc("sphotos/"+id).delete();try{await assets.delete(id)}catch(e1){}toast("写真を削除しました。")}catch(err){toast("削除できませんでした。")}
    }
    else if(act==="lbclose"){$("lb").hidden=true}
    else if(act==="lbprev"){lb.i=(lb.i+lb.list.length-1)%lb.list.length;lbShow()}
    else if(act==="lbnext"){lb.i=(lb.i+1)%lb.list.length;lbShow()}
  });
  document.addEventListener("change",async function(e){
    var pc=e.target.closest&&e.target.closest("[data-pwp]");
    if(pc){pwa.prefs[pc.dataset.pwp]=pc.checked;try{localStorage.setItem("josetsu.pushprefs",JSON.stringify(pwa.prefs))}catch(e0){}if(pwa.sub)window.__FB.callPush({action:"prefs",endpoint:pwa.sub.endpoint,prefs:pwa.prefs}).catch(function(){});return}
    var sl=e.target.closest&&e.target.closest("select[data-stsel]"); if(!sl)return;
    var id=sl.dataset.stsel, s=siteById(id);
    if(!s||!canWrite()||busy[id])return;
    busy[id]=true;
    try{await db.doc("ops/"+id).set({status:sl.value,statusAt:Date.now(),statusBy:myName||""});pwaNotify("status",id)}catch(err){toast("作業状況を保存できませんでした。");render()}
    busy[id]=false;
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Enter"||e.key===" "){
      var t=e.target; if(t&&t.getAttribute&&t.getAttribute("role")==="button"&&t.tagName!=="BUTTON"){e.preventDefault();t.click();return}
    }
    if(e.key==="Escape"){
      if(!$("lb").hidden)$("lb").hidden=true;
      else if(!$("rform").hidden)closeRform();
      else if(!$("sform").hidden)closeDlg();
      else if(!$("rview").hidden)closeSheet("rview");
      else if(!$("detail").hidden)closeSheet("detail");
    }else if(!$("lb").hidden){
      if(e.key==="ArrowLeft"){lb.i=(lb.i+lb.list.length-1)%lb.list.length;lbShow()}
      else if(e.key==="ArrowRight"){lb.i=(lb.i+1)%lb.list.length;lbShow()}
    }
  });

  /* ---------- 現場の追加・編集 ---------- */
  var geoLoc="",geoSrc="city";
  function updLocHint(){
    var l=areaLoc($("fArea").value.trim());
    $("fLoc").placeholder=l?("空欄なら地区の代表地点 "+l):"例:39.72, 140.10";
  }
  $("fArea").addEventListener("input",updLocHint);
  function mapLink(){
    var a=$("fAddr").value.trim(), el=$("fMap");
    el.hidden=!a;
    el.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(a);
  }
  $("fAddr").addEventListener("input",mapLink);
  function openDlg(id,copy){
    editingId=copy?null:(id||null);
    var s=id?siteById(id):null, isNew=!s||copy;
    $("dlgTitle").textContent=copy?"現場をコピーして追加":s?"現場を編集":"現場を追加";
    $("fName").value=s?s.name+(copy?"(コピー)":""):""; $("fArea").value=s&&s.area||""; $("fLoc").value=s?s.loc:"";
    $("fTh").value=s&&s.threshold||settings.defaultTh||10; $("fCrew").value=s&&s.crew||""; fHands=s?siteHands(s).map(function(h){return Object.assign({},h)}):[]; drawHands(); $("fNote").value=s&&s.note||"";
    fLines=s?siteLines(s).map(function(l){return Object.assign({},l)}):[]; if(!fLines.length)fLines=[{work:"",kind:"all",count:0,unitPrice:0,unit:"回"}]; drawLines();
    $("fStatus").value=(s&&!copy)?stOf(s):"standby";
    var w0=(s&&!copy)?wx[s.id]:null; $("fWxState").textContent=isNew?"保存すると、天気の取得を始めます。":!mcp?"この画面では天気を取得できません。":(!w0||w0.state==="loading"&&!w0.cur)?"天気: 取得中…":w0.state==="ok"?"天気: 取得できています。":w0.state==="noloc"?"天気: 場所が未設定のため取得できません。":"天気: 取得できていません。場所の書き方を確認してください。";
    $("fDel").hidden=isNew; $("fDel").textContent="削除"; $("fErr").textContent="";
    updLocHint();
    $("fAddr").value=s&&s.address||""; $("fSqm").value=s&&+s.sqm>0?s.sqm:""; geoLoc=(s&&(s.locSrc==="city"||s.locSrc==="addr"))?s.loc:""; geoSrc=(s&&s.locSrc==="addr")?"addr":"city"; $("fGeoMsg").textContent=""; mapLink();
    openSheet("sform"); setTimeout(function(){$("fName").focus()},0);
  }
  function closeDlg(){$("sform").hidden=true;editingId=null;lockBody()}
  /* ---------- 契約・金額(作業内容ごとの行) ---------- */
  var fLines=[], fHands=[];
  function drawHands(){
    $("fHands").innerHTML=fHands.map(function(h,i){
      return '<div class="hr" data-i="'+i+'"><input data-h="label" maxlength="10" placeholder="名前(例:朝)" aria-label="引渡時間の名前" value="'+esc(h.label)+'"><input data-h="time" type="time" aria-label="引渡時間" value="'+esc(h.time)+'"><button type="button" class="btn sm" data-hrm="'+i+'" aria-label="この引渡時間を削除">削除</button></div>';
    }).join("")||'<div class="help">未設定</div>';
  }
  function readHands(){
    Array.prototype.forEach.call($("fHands").querySelectorAll(".hr"),function(r){var i=+r.dataset.i;if(!fHands[i])return;
      fHands[i].label=r.querySelector('[data-h="label"]').value.trim(); fHands[i].time=r.querySelector('[data-h="time"]').value||""});
  }
  $("fHandAdd").addEventListener("click",function(){readHands();if(fHands.length>=6)return;fHands.push({label:"",time:""});drawHands();var l=$("fHands").querySelectorAll('[data-h="time"]');if(l.length)l[l.length-1].focus()});
  $("fHands").addEventListener("click",function(e){var b=e.target.closest("[data-hrm]");if(!b)return;readHands();fHands.splice(+b.dataset.hrm,1);drawHands()});
  function drawLines(){
    $("fLines").innerHTML=fLines.map(function(l,i){
      return '<div class="cl" data-i="'+i+'"><label class="wide">作業内容<input data-f="work" data-combo="dlWork" maxlength="30" placeholder="例:除雪" value="'+esc(l.work)+'"></label>'+
        '<label class="wide">集計の対象<select data-f="kind">'+Object.keys(LKIND).map(function(k){return '<option value="'+k+'"'+(l.kind===k?' selected':'')+'>'+esc(LKIND[k])+'</option>'}).join("")+'</select></label>'+
        '<label>契約回数<input data-f="count" type="number" min="0" max="200" step="1" inputmode="numeric" placeholder="例:10" value="'+(l.count>0?l.count:"")+'"></label>'+
        (canAdmin?'<label>単価(円)'+admBadge()+'<input data-f="unitPrice" type="number" min="0" step="1" inputmode="numeric" placeholder="例:20000" value="'+(l.unitPrice>0?l.unitPrice:"")+'"></label>'+
        '<label class="wide">単価の単位'+admBadge()+'<select data-f="unit"><option value="回"'+(l.unit==="時間"?'':' selected')+'>1回あたり</option><option value="時間"'+(l.unit==="時間"?' selected':'')+'>1時間あたり</option></select></label>':'')+
        (fLines.length>1?'<button type="button" class="btn sm cl-rm" data-lrm="'+i+'">この行を削除</button>':'')+'</div>';
    }).join("");
  }
  function readLines(){
    Array.prototype.forEach.call($("fLines").querySelectorAll(".cl"),function(el){
      var l=fLines[+el.dataset.i]; if(!l)return;
      var g=function(f){var x=el.querySelector('[data-f="'+f+'"]');return x?x.value:null};
      l.work=String(g("work")||"").trim(); l.kind=g("kind")||"all"; l.count=Math.max(0,parseInt(g("count"),10)||0);
      if(canAdmin){l.unitPrice=Math.max(0,parseInt(g("unitPrice"),10)||0); l.unit=g("unit")==="時間"?"時間":"回"}
    });
  }
  $("fLineAdd").addEventListener("click",function(){
    readLines();
    if(fLines.length===1&&fLines[0].kind==="all")fLines[0].kind="joset";
    var hasHai=fLines.some(function(l){return l.kind==="hai"});
    fLines.push({work:hasHai?"":"排雪",kind:hasHai?"other":"hai",count:0,unitPrice:0,unit:"回"});
    drawLines();
  });
  $("fLines").addEventListener("change",function(e){
    var t=e.target; if(!t||t.getAttribute("data-f")!=="work")return;
    var m=masters.works.filter(function(w){return w.name===t.value.trim()})[0], row=t.closest(".cl"); if(!m||!row)return;
    var k=row.querySelector('[data-f="kind"]'), u=row.querySelector('[data-f="unit"]');
    if(k)k.value=m.kind; if(u)u.value=m.unit;
  });
  $("fLines").addEventListener("click",function(e){
    var b=e.target.closest("[data-lrm]"); if(!b)return;
    readLines(); fLines.splice(+b.dataset.lrm,1); drawLines();
  });
  $("form").addEventListener("submit",async function(e){
    e.preventDefault();
    if(!db)return;
    var th=parseInt($("fTh").value,10); if(!(th>0))th=10;
    readLines(); var kept=fLines.filter(function(l){return l.work||l.count>0||l.unitPrice>0}), ls=lineSave(kept);
    var data={name:$("fName").value.trim(),area:$("fArea").value.trim(),address:$("fAddr").value.trim(),loc:$("fLoc").value.trim(),threshold:th,sqm:(function(v){v=parseFloat($("fSqm").value);return v>0?Math.round(v*100)/100:0})(),handovers:(readHands(),fHands.filter(function(h){return h.time}).sort(function(a,b){return a.time.localeCompare(b.time)})),handover:"",crew:$("fCrew").value.trim(),note:$("fNote").value.trim(),
      lines:ls.site.lines,contractCount:ls.site.contractCount};
    var priceData=ls.price;
    data.locSrc=data.loc?(data.loc===geoLoc?geoSrc:"manual"):"";
    if(!data.name||(!data.loc&&!areaLoc(data.area))){$("fErr").textContent="現場名と天気を調べる場所を入力してください。場所を空欄にする場合は、代表地点を登録した地区を選んでください。";return}
    $("fSave").disabled=true;
    try{
      var sid=editingId;
      if(sid){await db.doc("sites/"+sid).update(data);}
      else{
        data.createdAt=Date.now();
        var ref=await db.collection("sites").add(data); sid=ref&&ref.id;
      }
      if(sid&&canAdmin){
        try{if(priceData)await db.doc("prices/"+sid).set(priceData);else if(prices[sid])await db.doc("prices/"+sid).delete()}
        catch(e3){toast("現場は保存しましたが、単価を保存できませんでした。")}
      }
      if(sid&&canWrite()){var cur=editingId?stOf(siteById(editingId)||{id:sid}):"standby"; var nv=$("fStatus").value; if(nv!==cur||!editingId){try{if(nv!=="standby"||editingId)await db.doc("ops/"+sid).set({status:nv,statusAt:Date.now()})}catch(e4){}}}
      closeDlg(); toast("保存しました。");
    }catch(err){
      $("fErr").textContent=(err&&err.code==="invalid_argument")?"保存する権限がありません。編集権限のある方に依頼してください。":(err&&err.code==="quota_exceeded")?"登録できる件数の上限に達しています。":"保存できませんでした。もう一度お試しください。";
    }finally{$("fSave").disabled=false}
  });
  $("fCancel").addEventListener("click",closeDlg);
  document.querySelector(".fjump").addEventListener("click",function(e){var b=e.target.closest("[data-jump]");if(!b)return;var el=$(b.dataset.jump);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})});
  $("fDel").addEventListener("click",async function(){
    if($("fDel").textContent==="削除"){$("fDel").textContent="もう一度押すと削除";return}
    try{var did=editingId;await db.doc("sites/"+did).delete();try{await db.doc("ops/"+did).delete()}catch(e2){}delete wx[did];delete sel[did];closeDlg();}
    catch(err){$("fErr").textContent="削除できませんでした。権限を確認してください。"}
  });
  $("btnAdd2").addEventListener("click",function(){openDlg(null)});

  /* ---------- 設定:現場の管理 ---------- */
  var timer=null;
  function schedule(){
    if(timer)clearInterval(timer);
    timer=setInterval(function(){if(document.visibilityState==="visible")refreshAll(true)},(+settings.refreshMin||10)*60000);
  }
  function selIds(){return sites.filter(function(s){return sel[s.id]}).map(function(s){return s.id})}
  function fillSettings(){
    if($("setForm").contains(document.activeElement))return;
    $("sDefTh").value=settings.defaultTh; $("sIce").value=settings.iceTemp; $("sMult").value=settings.mult; $("sRefresh").value=String(settings.refreshMin); $("sReq").value=settings.requireLogin?"1":"0";
    var bb=settings.brand||{}; $("brName").value=bb.name||""; brDraft={logo:bb.logo||"",icon:bb.icon||""}; brPreview();
    $("pqLevel").value=pqKey(); ["light","std","high"].forEach(function(k){var p=pql(k);$("pq_"+k+"_s").value=p.side;$("pq_"+k+"_q").value=Math.round(p.q*100);$("pq_"+k+"_k").value=Math.round(p.limit/1365)});
  }
  var members=[], mbEdit=null, mbDel=null;
  function mbVisible(){
    var q=($("mbQ").value||"").trim().toLowerCase(), f=$("mbF").value;
    return members.filter(function(m){
      if(f==="off"&&m.active!==false)return false;
      if(f.indexOf("c:")===0&&(m.crew||"")!==f.slice(2))return false;
      if(f==="on"&&m.active===false)return false;
      return !q||[m.name,m.crew,m.phone,m.role,m.note].join(" ").toLowerCase().indexOf(q)>=0;
    }).sort(function(a,b){return String(a.crew||"~").localeCompare(String(b.crew||"~"),"ja")||String(a.name).localeCompare(String(b.name),"ja")});
  }
  function renderMembers(){
    var act=members.filter(function(m){return m.active!==false}).length;
    var crews={};members.forEach(function(m){if(m.active!==false&&m.crew)crews[m.crew]=(crews[m.crew]||0)+1});
    $("mbStat").innerHTML='<div class="ms">在籍<b class="num">'+act+'人</b></div><div class="ms">休止中<b class="num">'+(members.length-act)+'人</b></div>'+Object.keys(crews).sort().map(function(c){return '<div class="ms">'+esc(c)+'<b class="num">'+crews[c]+'人</b></div>'}).join("");
    var cur=$("mbF").value||"all";
    $("mbF").innerHTML='<option value="all">すべて</option><option value="on">在籍のみ</option><option value="off">休止中のみ</option>'+Object.keys(crews).sort().map(function(c){return '<option value="c:'+esc(c)+'">'+esc(c)+'</option>'}).join("");
    $("mbF").value=cur; if($("mbF").value!==cur)$("mbF").value="all";
    var rows=mbVisible();
    $("mbList").innerHTML=rows.length?rows.map(function(m){
      var id=esc(m.id), askDel=mbDel===m.id;
      return '<article class="mr'+(m.active===false?' off':'')+'"><div class="nm"><b>'+esc(m.name)+'</b><span>'+esc([m.crew||"担当班 未設定",m.role||"現場スタッフ"].join(" ・ "))+'</span></div>'+
        '<div class="ed"><button class="btn sm" type="button" data-mb="edit" data-id="'+id+'">編集</button><button class="btn sm'+(askDel?' danger':'')+'" type="button" data-mb="del" data-id="'+id+'">'+(askDel?'本当に削除':'削除')+'</button></div>'+
        '<div class="kvs">'+(m.active===false?'<span class="k">休止中</span>':'')+'<span class="k">'+(window.__FB&&window.__FB.createAccount?(m.uid?'ログインできます':'ログイン未設定'):(m.uid?'ログイン連携済':'ログイン未連携'))+'</span>'+(m.phone?'<span class="k">電話 <a href="tel:'+esc(String(m.phone).replace(/[^0-9+]/g,""))+'">'+esc(m.phone)+'</a></span>':'')+(m.note?'<span class="k">'+esc(m.note)+'</span>':'')+'</div></article>';
    }).join(""):'<div class="empty"><b>'+(members.length?'該当するメンバーはいません':'メンバーが登録されていません')+'</b>'+(members.length?'':'「メンバーを追加」から登録してください。')+'</div>';
  }
  function mbOpen(m){
    mbEdit=m?m.id:null; $("mbFormTitle").textContent=m?"メンバーを編集":"メンバーを追加";
    $("mbName").value=m?m.name:""; $("mbCrew").value=m&&m.crew||""; $("mbRole").value=m&&m.role||"現場スタッフ";
    $("mbTel").value=m&&m.phone||""; $("mbNote").value=m&&m.note||""; $("mbActive").value=m&&m.active===false?"0":"1";
    mbUid=m&&m.uid||""; mbAcctShow(); $("mbAcctQ").value=""; $("mbAcctRes").innerHTML="";
    var simple=!!(window.__FB&&window.__FB.createAccount);
    $("mbAcctRow").hidden=simple; $("mbPwRow").hidden=!simple; $("mbPw").value="";
    if(simple){
      $("mbTelLab").innerHTML='電話番号(ログインID)<span class="req">必須</span>';
      $("mbPw").placeholder=mbUid?"変える場合だけ入力":"4文字以上(数字でも文字でも可)";
      $("mbPwHelp").textContent=mbUid?"パスワードを忘れた人は、ここで新しく決め直せます。変えないときは空のままにします。":"この電話番号と、このパスワードでログインします。本人に伝えてください。";
    }
    $("mbMsg").textContent=""; $("mbForm").hidden=false; $("mbName").focus();
  }
  var mbUid="";
  if(window.__FB&&window.__FB.createAccount&&$("mbLegend"))$("mbLegend").textContent="ここは社内の名簿です。メンバーの電話番号とパスワードを決めると、その人はこのアプリにログインできます。パスワードを忘れた人は、編集からパスワードを決め直してください。「全体設定」でログインの制限を「する」にすると、メンバー登録された人だけが画面を使えます。電話番号などの個人情報は、管理者だけが見られます。";
  async function mbAcctShow(){
    $("mbAcctClr").hidden=!mbUid; var t="未連携";
    if(mbUid){t="連携済";try{var ps=user&&user.profiles?await user.profiles([mbUid]):null;if(ps&&ps[mbUid]&&ps[mbUid].name)t="連携済:"+ps[mbUid].name}catch(e){}}
    $("mbAcctNow").textContent=t;
    var cr=$("mbCred"); cr.hidden=!(mbUid&&window.__FB&&window.__FB.updateAccount&&canAdmin);
    $("mbCredMsg").textContent=""; $("mbCredPw").value=""; $("mbCredId").value="";
    if(!cr.hidden){try{var cid=await window.__FB.accountId(mbUid);$("mbCredId").placeholder="現在のID:"+(cid||"不明")+"(変える場合だけ入力)"}catch(e){}}
  }
  if(window.__FB&&$("impPanel")){
    $("impPanel").hidden=false;
    $("impGo").addEventListener("click",async function(){
      var f=$("impFile").files[0], m=$("impMsg"); if(!f){m.textContent="ファイルを選んでください。";return}
      var j; try{j=JSON.parse(await f.text())}catch(e){m.textContent="ファイルを読めませんでした。";return}
      if(!j||j.format!=="josetsu-export-v1"||!j.collections){m.textContent="引き継ぎ用のファイルではありません。";return}
      var ALLOW=["sites","masters","ops","prices"], n=0, bad=0; $("impGo").disabled=true; m.textContent="取り込み中…";
      for(var ci=0;ci<ALLOW.length;ci++){var c=ALLOW[ci],o=j.collections[c]||{},ids=Object.keys(o);
        for(var k=0;k<ids.length;k++){try{await db.doc(c+"/"+ids[k]).set(o[ids[k]]);n++}catch(e){bad++}}}
      $("impGo").disabled=false; m.textContent=n+"件を取り込みました"+(bad?("(失敗 "+bad+"件)"):"。");
      toast("取り込みが終わりました。"); render();
    });
  }
  /* ---------- 写真の管理 ---------- */
  var phSel={}, phPage=0, phPS=24, phBusy=false;
  function allPhotos(){
    var out=[];
    sphotos.forEach(function(x){if(okId(x.id)&&x.kind!=="drawing")out.push({id:x.id,src:"site",siteId:x.siteId,at:x.at||0,rid:""})});
    reports.forEach(function(r){(r.photos||[]).forEach(function(p){if(okId(p.id))out.push({id:p.id,src:"rep",siteId:r.siteId,at:r.at||0,rid:r.id,date:r.date||""})})});
    out.sort(function(a,b){return b.at-a.at});
    return out;
  }
  function phList(){
    var sf=$("phSite").value, sr=$("phSrc").value;
    return allPhotos().filter(function(p){return (!sf||p.siteId===sf)&&(!sr||p.src===sr)});
  }
  function kb(id){var u=window.__blobUrl?window.__blobUrl(id):"";return u&&u.indexOf("data:image/jpeg")===0?Math.round(u.length*0.75/1024):0}
  function renderPhotos(){
    var ss=$("phSite"), cur=ss.value;
    ss.innerHTML='<option value="">すべての現場</option>'+sites.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name),"ja")}).map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join("");
    ss.value=cur;
    var all=phList(), pages=Math.max(1,Math.ceil(all.length/phPS)); if(phPage>=pages)phPage=pages-1;
    var canRe=!!window.__blobUrl; $("phShrink").hidden=!canRe; $("phQ").hidden=!canRe;
    var cnt=Object.keys(phSel).length;
    $("phInfo").textContent=all.length+"枚"+(cnt?(" / "+cnt+"枚を選択中"):"");
    $("phPg").textContent=(phPage+1)+" / "+pages; $("phPrev").disabled=phPage<=0; $("phNext").disabled=phPage>=pages-1;
    $("phGrid").innerHTML=all.length?all.slice(phPage*phPS,(phPage+1)*phPS).map(function(p){
      var s=siteById(p.siteId), k=kb(p.id), on=!!phSel[p.id];
      return '<div class="phb" style="aspect-ratio:auto;cursor:default"><label style="display:block;cursor:pointer"><div style="aspect-ratio:1;overflow:hidden"><img src="'+esc(blobUrl(p.id))+'" alt="" loading="lazy"></div>'+
        '<div style="padding:6px 8px;font-size:.78rem;line-height:1.4"><input type="checkbox" data-phid="'+esc(p.id)+'"'+(on?' checked':'')+' style="margin-right:6px">'+esc(s?s.name:"削除された現場")+'<br><span class="muted">'+(p.src==="site"?"案件":"日報")+' '+esc(p.at?fmtDT(p.at).split(" ")[0]:"")+(k?' / '+(k>=1024?(k/1024).toFixed(1)+"MB":k+"KB"):'')+'</span></div></label></div>';
    }).join(""):'<div class="empty" style="grid-column:1/-1"><b>写真はありません</b></div>';
  }
  $("phGrid").addEventListener("change",function(e){var c=e.target.closest("input[data-phid]");if(!c)return;if(c.checked)phSel[c.dataset.phid]=1;else delete phSel[c.dataset.phid];renderPhotos()});
  $("phSite").addEventListener("change",function(){phPage=0;renderPhotos()});
  $("phSrc").addEventListener("change",function(){phPage=0;renderPhotos()});
  $("phPrev").addEventListener("click",function(){phPage--;renderPhotos()});
  $("phNext").addEventListener("click",function(){phPage++;renderPhotos()});
  $("phAll").addEventListener("click",function(){phList().slice(phPage*phPS,(phPage+1)*phPS).forEach(function(p){phSel[p.id]=1});renderPhotos()});
  $("phNone").addEventListener("click",function(){phSel={};renderPhotos()});
  async function phDelete(ids){
    var byRep={};
    allPhotos().forEach(function(p){if(ids.indexOf(p.id)>=0&&p.rid){(byRep[p.rid]=byRep[p.rid]||[]).push(p.id)}});
    for(var rid in byRep){var r=reports.filter(function(x){return x.id===rid})[0];if(r)try{await db.doc("reports/"+rid).update({photos:(r.photos||[]).filter(function(p){return byRep[rid].indexOf(p.id)<0}).map(function(p){return {id:p.id,kind:p.kind}})})}catch(e){}}
    for(var i=0;i<ids.length;i++){
      try{await db.doc("sphotos/"+ids[i]).delete()}catch(e){}
      try{await assets.delete(ids[i])}catch(e){}
    }
  }
  function phRecode(id,lv){
    return new Promise(function(resolve,reject){
      var u=window.__blobUrl?window.__blobUrl(id):""; if(!u||u.indexOf("data:image")!==0)return reject(new Error("notloaded"));
      var img=new Image();
      img.onload=function(){
        var P=pql(lv), side=P.side, q=P.q, url="";
        for(var i=0;i<8;i++){
          var k=Math.min(1,side/Math.max(img.width,img.height)), c=document.createElement("canvas");
          c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k));
          c.getContext("2d").drawImage(img,0,0,c.width,c.height);
          url=c.toDataURL("image/jpeg",q); if(url.length<=P.limit)break; side=Math.round(side*0.8); q=Math.max(0.4,q-0.06);
        }
        resolve(url);
      };
      img.onerror=function(){reject(new Error("bad"))}; img.src=u;
    });
  }
  $("phDel").addEventListener("click",async function(){
    var ids=Object.keys(phSel); if(!ids.length||phBusy){$("phMsg").textContent="写真を選んでください。";return}
    if(!arm("phdel",$("phDel"),"選んだ写真を削除"))return;
    phBusy=true; $("phMsg").textContent="削除しています…";
    await phDelete(ids); phSel={}; phBusy=false; $("phMsg").textContent=ids.length+"枚を削除しました。"; renderPhotos();
  });
  $("phShrink").addEventListener("click",async function(){
    var ids=Object.keys(phSel); if(!ids.length||phBusy){$("phMsg").textContent="写真を選んでください。";return}
    var lv=$("phQ").value, ok=0, fail=0, saved=0; phBusy=true;
    for(var i=0;i<ids.length;i++){
      $("phMsg").textContent="軽量化しています…("+(i+1)+"/"+ids.length+")";
      try{
        var old=window.__blobUrl(ids[i]), nu=await phRecode(ids[i],lv);
        if(nu.length>=old.length){continue}
        await db.doc("photos/"+ids[i]).update({data:nu,at:Date.now()});
        if(window.__FB&&window.__FB.setPhotoCache)window.__FB.setPhotoCache(ids[i],nu);
        saved+=old.length-nu.length; ok++;
      }catch(e){fail++}
    }
    phBusy=false; $("phMsg").textContent=ok+"枚を軽量化しました(約 "+Math.round(saved*0.75/1024)+"KB 削減)"+(fail?("。"+fail+"枚は失敗しました。写真が読み込まれてから再度お試しください。"):"。"); renderPhotos();
  });
  var brDraft={logo:"",icon:""};
  function brPreview(){
    $("brLogoPv").innerHTML=brDraft.logo?'<img src="'+brDraft.logo+'" alt="" style="max-height:48px;max-width:200px">':'<span class="muted">未設定</span>';
    $("brIconPv").innerHTML=brDraft.icon?'<img src="'+brDraft.icon+'" alt="" style="width:100%;height:100%;object-fit:cover">':'<span class="muted">未設定</span>';
  }
  function brImage(file,mode){
    return new Promise(function(resolve,reject){
      var u=URL.createObjectURL(file), img=new Image();
      img.onload=function(){
        URL.revokeObjectURL(u);
        var out="", maxChars=mode==="icon"?60000:90000, scale=1;
        for(var i=0;i<6;i++){
          var c=document.createElement("canvas"), g;
          if(mode==="icon"){
            var sz=Math.round(192*scale), s0=Math.min(img.width,img.height);
            c.width=c.height=sz; g=c.getContext("2d");
            g.drawImage(img,(img.width-s0)/2,(img.height-s0)/2,s0,s0,0,0,sz,sz);
          }else{
            var k=Math.min(1,(360*scale)/img.width,(120*scale)/img.height);
            c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k)); g=c.getContext("2d");
            g.drawImage(img,0,0,c.width,c.height);
          }
          out=c.toDataURL("image/png");
          if(out.length<=maxChars)return resolve(out);
          out=c.toDataURL("image/jpeg",0.85); if(mode==="icon"&&out.length<=maxChars)return resolve(out);
          scale*=0.75;
        }
        reject(new Error("too_large"));
      };
      img.onerror=function(){URL.revokeObjectURL(u);reject(new Error("bad"))};
      img.src=u;
    });
  }
  ["Logo","Icon"].forEach(function(K){
    var key=K.toLowerCase();
    $("br"+K+"File").addEventListener("change",async function(e){
      var f=e.target.files[0]; e.target.value=""; if(!f)return;
      try{brDraft[key]=await brImage(f,key);brPreview();flash("sMsg","画像を読み込みました。「設定を保存」を押すと反映されます。")}
      catch(err){flash("sMsg","この画像は使えませんでした。別の画像をお試しください。")}
    });
    $("br"+K+"Clr").addEventListener("click",function(){brDraft[key]="";brPreview();flash("sMsg","「設定を保存」を押すと反映されます。")});
  });
  var setTab="jd";
  function showSetTab(){
    Array.prototype.forEach.call($("setTabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.sg===setTab))});
    Array.prototype.forEach.call($("setForm").querySelectorAll("[data-sg-box]"),function(d){d.hidden=d.dataset.sgBox!==setTab});
  }
  $("setTabs").addEventListener("click",function(e){var b=e.target.closest("button[data-sg]");if(!b)return;setTab=b.dataset.sg;showSetTab()});
  var spSite="";
  document.addEventListener("change",function(e){var t=e.target;if(t&&t.dataset&&t.dataset.pq){try{localStorage.setItem("josetsu.pq",t.value)}catch(e1){}}});
  $("dwFile").addEventListener("change",async function(e){
    var files=Array.prototype.slice.call(e.target.files||[]); e.target.value="";
    var sid=spSite; if(!sid||!assets||!db||!files.length)return;
    var msg=function(t){var m=$("dwMsg");if(m)m.textContent=t}, ok=0, bad=[];
    for(var i=0;i<files.length;i++){
      var f=files[i], isPdf=f.type==="application/pdf"||/\.pdf$/i.test(f.name), isImg=/^image\//.test(f.type);
      if(!isPdf&&!isImg){bad.push(f.name+"(PDFか画像だけ載せられます)");continue}
      if(isPdf&&f.size>4*1024*1024){bad.push(f.name+"(PDFは4MBまでです)");continue}
      msg("図面を保存しています…("+(i+1)+"/"+files.length+")");
      try{
        var up=isPdf&&f.type!=="application/pdf"?new Blob([f],{type:"application/pdf"}):f;
        var res=await assets.upload(up,{drawing:true,type:isPdf?"application/pdf":f.type});
        await db.doc("sphotos/"+res.id).set({siteId:sid,at:Date.now(),by:myId||"",kind:"drawing",name:String(f.name||"図面").slice(0,80),type:isPdf?"application/pdf":(res.contentType||f.type||"image/jpeg"),size:res.sizeBytes||f.size||0});
        ok++;
      }catch(err){bad.push(f.name+"(保存できませんでした)")}
    }
    msg((ok?ok+"件を保存しました。":"")+(bad.length?" 保存できなかったもの: "+bad.join("、"):""));
  });
  $("spFile").addEventListener("change",async function(e){
    var files=Array.prototype.slice.call(e.target.files||[]); e.target.value="";
    var sid=spSite; if(!sid||!assets||!db||!files.length)return;
    var msg=function(t){var m=$("spMsg");if(m)m.textContent=t}, ok=0, fails=0, before=0, after=0;
    for(var i=0;i<files.length;i++){
      msg("写真を保存しています…("+(i+1)+"/"+files.length+")");
      try{
        var sh=await shrink(files[i]); before+=files[i].size;
        var res=await assets.upload(sh.blob,{type:sh.type}); after+=res.sizeBytes||0;
        await db.doc("sphotos/"+res.id).set({siteId:sid,at:Date.now(),by:myId||""});
        ok++;
      }catch(err){fails++}
    }
    var mb=function(n){return n>=1048576?(n/1048576).toFixed(1)+"MB":Math.round(n/1024)+"KB"};
    msg(ok?(ok+"枚を保存しました(元 "+mb(before)+" → 約 "+mb(window.__blobUrl?after*0.75:after)+")"+(fails?("。"+fails+"枚は保存できませんでした。"):"")):"写真を保存できませんでした。");
  });
  var CERR={not_configured:"サーバーの設定がまだです(サービスアカウントの鍵が未登録)。",bad_service_account:"サービスアカウントの鍵が正しくありません。",forbidden:"管理者だけが変更できます。",weak_password:"パスワードは4文字以上にしてください。",bad_id:"電話番号(数字9〜15桁)を入力してください。","auth/email-already-exists":"この電話番号は、すでにログイン用に使われています。",cannot_delete_admin:"管理者のアカウントは削除できません。","auth/user-not-found":"アカウントが見つかりません。",nothing:"変更する項目を入力してください。"};
  $("mbCredGo").addEventListener("click",async function(){
    var id=$("mbCredId").value.trim(), pw=$("mbCredPw").value;
    if(!id&&!pw){$("mbCredMsg").textContent=CERR.nothing;return}
    var b=$("mbCredGo"); b.disabled=true; $("mbCredMsg").textContent="更新しています…";
    try{await window.__FB.updateAccount(mbUid,{id:id,password:pw});$("mbCredMsg").textContent="更新しました。本人には新しい情報を伝えてください。";$("mbCredPw").value="";$("mbCredId").value="";try{var cid=await window.__FB.accountId(mbUid);$("mbCredId").placeholder="現在のID:"+(cid||"不明")+"(変える場合だけ入力)"}catch(e){}}
    catch(err){$("mbCredMsg").textContent=CERR[err.message]||("更新できませんでした("+err.message+")")}
    b.disabled=false;
  });
  $("mbAcctMe").addEventListener("click",function(){if(myId){mbUid=myId;mbAcctShow()}else $("mbMsg").textContent="自分のアカウントを取得できませんでした。"});
  $("mbAcctClr").addEventListener("click",function(){mbUid="";mbAcctShow()});
  var mbSt;
  $("mbAcctQ").addEventListener("input",function(){
    clearTimeout(mbSt); var q=$("mbAcctQ").value.trim();
    if(!user||!user.search){$("mbAcctRes").innerHTML='<span class="help">この環境では、名前検索を使えません。「自分を連携」を使ってください。</span>';return}
    mbSt=setTimeout(async function(){
      try{var hits=await user.search(q)||[];hits=hits.slice(0,6);
        $("mbAcctRes").innerHTML=hits.length?hits.map(function(h){return '<button type="button" data-uid="'+esc(h.id)+'">'+esc(h.name||"(名前なし)")+'</button>'}).join(""):'<span class="help">見つかりませんでした。</span>';
      }catch(err){$("mbAcctRes").innerHTML='<span class="help">検索できませんでした。</span>'}
    },250);
  });
  $("mbAcctRes").addEventListener("click",function(e){var b=e.target.closest("button[data-uid]");if(!b)return;mbUid=b.dataset.uid;$("mbAcctRes").innerHTML="";$("mbAcctQ").value="";mbAcctShow()});
  $("mbAdd").addEventListener("click",function(){mbOpen(null)});
  $("mbCancel").addEventListener("click",function(){$("mbForm").hidden=true;mbEdit=null});
  $("mbQ").addEventListener("input",renderMembers); $("mbF").addEventListener("change",renderMembers);
  $("mbForm").addEventListener("submit",async function(e){
    e.preventDefault();
    var name=$("mbName").value.trim(); if(!name){$("mbMsg").textContent="氏名を入力してください。";return}
    var data={name:name,crew:$("mbCrew").value.trim(),role:$("mbRole").value,phone:$("mbTel").value.trim(),note:$("mbNote").value.trim(),active:$("mbActive").value==="1"};
    if(!db){$("mbMsg").textContent="保存できませんでした。";return}
    var simple=!!(window.__FB&&window.__FB.createAccount), pw=simple?$("mbPw").value:"";
    if(simple){
      var digits=data.phone.replace(/[^0-9０-９]/g,"").replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-65248)});
      if(!/^\d{9,15}$/.test(digits)){$("mbMsg").textContent="電話番号を、数字9〜15桁で入力してください。";return}
      if(members.some(function(x){return x.id!==mbEdit&&String(x.phone||"").replace(/[^0-9]/g,"")===digits})){$("mbMsg").textContent="この電話番号は、ほかのメンバーに登録されています。";return}
      if(!mbUid&&pw.length<4){$("mbMsg").textContent="ログインパスワードを4文字以上で入力してください。";return}
      if(mbUid&&pw&&pw.length<4){$("mbMsg").textContent="パスワードは4文字以上にしてください。";return}
    }else if(mbUid&&members.some(function(x){return x.uid===mbUid&&x.id!==mbEdit})){$("mbMsg").textContent="このアカウントは、ほかのメンバーに連携されています。";return}
    $("mbSave").disabled=true;
    try{
      if(simple){
        var o0=mbEdit?members.filter(function(x){return x.id===mbEdit})[0]:null, EM={create:"作成",upd:"更新"};
        if(!mbUid){mbUid=await window.__FB.createAccount({id:data.phone,password:pw,name:data.name,active:data.active})}
        else{
          var changed=!o0||String(o0.phone||"").replace(/[^0-9]/g,"")!==digits;
          await window.__FB.updateAccount(mbUid,{id:changed?data.phone:"",password:pw,name:data.name,active:data.active});
        }
      }
      data.uid=mbUid;
      var old=mbEdit?members.filter(function(x){return x.id===mbEdit})[0]:null, mid=mbEdit;
      if(mbEdit){await db.doc("members/"+mbEdit).update(data)}
      else{data.createdAt=Date.now();var ref=await db.collection("members").add(data);mid=ref&&ref.id||""}
      if(old&&old.uid&&old.uid!==mbUid){try{await db.doc("access/"+old.uid).delete()}catch(e1){}if(window.__FB)try{await window.__FB.setRole(old.uid,"pending")}catch(e1){}}
      if(mbUid&&window.__FB)await window.__FB.setRole(mbUid,data.active?"member":"pending");
      if(mbUid)await db.doc("access/"+mbUid).set({memberId:mid,name:data.name,crew:data.crew,role:data.role,active:data.active});
      $("mbForm").hidden=true; mbEdit=null; toast("メンバーを保存しました。");
    }catch(err){$("mbMsg").textContent=(CERR[err&&err.message]||"")||"保存できませんでした。編集権限を確認してください。"}
    $("mbSave").disabled=false;
  });
  $("mbList").addEventListener("click",async function(e){
    var b=e.target.closest("button[data-mb]"); if(!b)return;
    var id=b.dataset.id, m=members.filter(function(x){return x.id===id})[0]; if(!m)return;
    if(b.dataset.mb==="edit"){mbDel=null;mbOpen(m);window.scrollTo({top:0,behavior:"smooth"});return}
    if(mbDel!==id){mbDel=id;renderMembers();clearTimeout(mbOpen.t);mbOpen.t=setTimeout(function(){mbDel=null;renderMembers()},4000);return}
    mbDel=null;
    try{if(m.uid&&window.__FB&&window.__FB.deleteAccount){try{await window.__FB.deleteAccount(m.uid)}catch(e0){if(e0&&e0.message==="cannot_delete_admin"){toast("管理者のアカウントは削除できません。");return}}}
      await db.doc("members/"+id).delete();if(m.uid){try{await db.doc("access/"+m.uid).delete()}catch(e1){}if(window.__FB&&!window.__FB.deleteAccount)try{await window.__FB.setRole(m.uid,"pending")}catch(e1){}}toast("「"+m.name+"」を削除しました。")}catch(err){toast("削除できませんでした。");renderMembers()}
  });

  /* ---------- お知らせ(ベル) ---------- */
  var announcements=[], readMap={}, annFirst=true, annEdit=null;
  function fmtDT(t){if(!t)return "";var d=new Date(t);return (d.getMonth()+1)+"/"+d.getDate()+" "+timeStr(t)}
  function annSorted(){return announcements.slice().sort(function(a,b){return (b.important?1:0)-(a.important?1:0)||(b.at||0)-(a.at||0)})}
  function isUnread(x){return (x.at||0)>Date.now()-30*864e5&&x.by!==myId&&!readMap[x.id]}
  function iBell(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>'}
  function noticeItems(){
    var items=[];
    annSorted().filter(isUnread).forEach(function(a){
      items.push({grp:"ann",urgent:!!a.important,title:(a.important?"【重要】":"")+a.title,sub:fmtDT(a.at)+"("+who(a.by)+")",go:function(){openAnnView(a.id)}});
    });
    sites.forEach(function(s){
      var st=stOf(s), lv=0; try{lv=assess(s).lv}catch(e){}
      if(lv===3&&(st==="standby"||st==="prep"))items.push({grp:"site",urgent:true,title:s.name,sub:"出動目安です(いまは"+ST[st]+")",go:function(){openDetail(s.id)}});
    });
    notes.filter(isUnread).forEach(function(n){
      var site=n.siteId?siteById(n.siteId):null;
      items.push({grp:"note",title:n.siteId?(site?site.name:(n.siteName||"削除された現場")):"全体への連絡",sub:fmtDT(n.at)+"("+who(n.by)+") "+(n.text||"").slice(0,40),go:function(){markRead(n.id);goto("notes")}});
    });
    return items;
  }
  /* ---------- アプリのインストールと通知(本番アプリのみ) ---------- */
  var pwa={ev:null,reg:null,sub:null,on:false,msg:"",prefs:{note:true,ann:true,status:true,report:true}};
  try{var pp=JSON.parse(localStorage.getItem("josetsu.pushprefs")||"null");if(pp)Object.keys(pwa.prefs).forEach(function(k){if(pp[k]===false)pwa.prefs[k]=false})}catch(e){}
  function pwaOn(){return !!(window.__FB&&window.__FB.callPush)}
  function isStandalone(){try{return (window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true}catch(e){return false}}
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
  function pushCan(){return pwaOn()&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window}
  function u8(b64){var p="=".repeat((4-b64.length%4)%4), s=(b64+p).replace(/-/g,"+").replace(/_/g,"/"), r=atob(s), o=new Uint8Array(r.length);for(var i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o}
  window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();pwa.ev=e;if(isAppSetOpen())openAppSet()});
  window.addEventListener("appinstalled",function(){pwa.ev=null;toast("インストールしました。");if(isAppSetOpen())openAppSet()});
  function isAppSetOpen(){return $("mdl").classList.contains("open")&&!!$("mdBox").querySelector("[data-pw]")}
  async function pwaInit(){
    if(!pwaOn()||!("serviceWorker" in navigator))return;
    try{
      pwa.reg=await navigator.serviceWorker.register("/sw.js");
      navigator.serviceWorker.addEventListener("message",function(e){if(e.data&&e.data.type==="nav")applyDeepLink(e.data.url)});
      if(pushCan()){pwa.sub=await pwa.reg.pushManager.getSubscription();pwa.on=!!pwa.sub&&Notification.permission==="granted";render()}
    }catch(e){}
  }
  var dlTries=0;
  function applyDeepLink(u){
    var q;try{q=new URL(u||location.href,location.origin).searchParams}catch(e){return}
    var go=q.get("go"), site=q.get("site");
    if(!go&&!site)return;
    if(site){
      if(!sites.length&&dlTries++<30){setTimeout(function(){applyDeepLink(u)},500);return}
      if(siteById(site)){closeModal();openDetail(site)}
    }else if(["home","sites","machines","reports","notes","stats"].indexOf(go)>=0){closeModal();goto(go)}
    try{history.replaceState(null,"",location.pathname)}catch(e){}
  }
  function pwaNotify(type,id){if(pwaOn()&&id){window.__FB.callPush({action:"notify",type:type,id:id}).catch(function(){})}}
  function openAppSet(){
    var inst, push;
    if(isStandalone())inst='<p><b>インストール済み</b>です。ホーム画面のアイコンから開けます。</p>';
    else if(pwa.ev)inst='<p>ホーム画面に追加すると、アプリのように開けます。</p><button class="btn primary" type="button" data-mact="pwinstall">アプリをインストール</button>';
    else if(isIOS())inst='<p>iPhone・iPadでは、Safariの共有ボタン(□に↑)→「ホーム画面に追加」を選びます。<br>追加したアイコンから開くと、通知も使えます。</p>';
    else inst='<p>ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。</p>';
    if(!("serviceWorker" in navigator)||!("Notification" in window)||!("PushManager" in window)){
      push='<p class="muted">この端'+'末・ブラウザでは通知が使えません。'+(isIOS()&&!isStandalone()?'iPhone・iPadは、先にホーム画面に追加してから、そのアイコンから開いてください。':'')+'</p>';
    }else if(Notification.permission==="denied"){
      push='<p class="muted">通知がブロックされています。ブラウザ(またはOS)の設定で、このサイトの通知を「許可」にしてください。</p>';
    }else if(pwa.on){
      push='<p><b>この端末で通知を受け取っています。</b></p><div class="pw-pf">'+[["note","連絡"],["ann","お知らせ"],["status","出動状況の変更"],["report","日報の提出"]].map(function(x){return '<label class="pw-ck"><input type="checkbox" data-pwp="'+x[0]+'"'+(pwa.prefs[x[0]]?' checked':'')+'>'+x[1]+'</label>'}).join("")+'</div>'+
        '<div class="pw-bt"><button class="btn" type="button" data-mact="pwtest">テスト通知を送る</button><button class="btn" type="button" data-mact="pwoff">この端末の通知をオフにする</button></div>';
    }else{
      push='<p>連絡・お知らせ・出動状況・日報があったときに、この端末へ通知します。</p><button class="btn primary" type="button" data-mact="pwon">通知をオンにする</button>';
    }
    openModal("アプリ・通知",'<div data-pw class="pw"><h4>アプリのインストール</h4>'+inst+'<h4>通知</h4>'+push+(pwa.msg?'<p class="pw-msg" role="status">'+esc(pwa.msg)+'</p>':'')+'</div>','<button class="btn first" type="button" data-mact="notices">戻る</button><button class="btn" type="button" data-mclose>閉じる</button>');
  }
  async function pwaEnable(){
    pwa.msg="";
    try{
      var perm=await Notification.requestPermission();
      if(perm!=="granted"){pwa.msg=perm==="denied"?"通知が許可されませんでした。":"通知はオンになっていません。";openAppSet();return}
      var kr=await fetch("/api/push?key=1"); var kj=await kr.json(); if(!kj.publicKey)throw new Error("key");
      var reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription();
      if(!sub){
        try{sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(kj.publicKey)})}
        catch(e1){var old=await reg.pushManager.getSubscription(); if(old)await old.unsubscribe(); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(kj.publicKey)})}
      }
      await window.__FB.callPush({action:"subscribe",sub:sub.toJSON(),prefs:pwa.prefs});
      pwa.sub=sub; pwa.on=true; pwa.msg="通知をオンにしました。"; render();
    }catch(e){pwa.msg="通知をオンにできませんでした。しばらくしてからもう一度お試しください。(サーバーの通知設定が済んでいない場合があります)"}
    openAppSet();
  }
  async function pwaDisable(){
    try{var sub=pwa.sub||(pwa.reg&&await pwa.reg.pushManager.getSubscription()); if(sub){var ep=sub.endpoint; await sub.unsubscribe(); try{await window.__FB.callPush({action:"unsubscribe",endpoint:ep})}catch(e2){}}}catch(e){}
    pwa.sub=null; pwa.on=false; pwa.msg="この端末の通知をオフにしました。"; render(); openAppSet();
  }
  function appPromo(){
    if(!pwaOn())return "";
    try{if(localStorage.getItem("josetsu.promo2")==="1")return ""}catch(e){}
    if(isStandalone()&&(pwa.on||!pushCan()))return "";
    if(pwa.on)return "";
    return '<div class="card2 pw-promo"><div><b>アプリとして使う・通知を受け取る</b><div class="muted">ホーム画面に追加すると、連絡や出動の通知が届きます。</div></div><div class="pw-pb"><button class="btn primary sm" type="button" data-act="appset">設定する</button><button class="btn sm" type="button" data-act="appsetlater">あとで</button></div></div>';
  }
  window.__appPromo=appPromo;
  pwaInit();
  setTimeout(function(){applyDeepLink()},800);
  function renderBell(){
    var n=noticeItems().length, el=$("btnBell");
    el.innerHTML=iBell()+(n?'<span class="bell-dot">'+(n>99?"99+":n)+'</span>':'');
    el.setAttribute("aria-label","お知らせ"+(n?("(未対応"+n+"件)"):""));
    try{if(navigator.setAppBadge){if(n>0)navigator.setAppBadge(n).catch(function(){});else navigator.clearAppBadge().catch(function(){})}}catch(e){}
  }
  async function persistRead(){
    var ks=Object.keys(readMap); if(ks.length>300){ks.slice(0,ks.length-300).forEach(function(k){delete readMap[k]})}
    try{localStorage.setItem("josetsu.read",JSON.stringify(readMap))}catch(e){}
    if(db&&myId){try{await db.doc("data/users/"+myId+"/state").set({read:readMap})}catch(e){}}
  }
  function markRead(id){if(!id||readMap[id])return;readMap[id]=1;persistRead();renderBell()}
  function openModal(title,body,foot){
    $("mdBox").innerHTML='<div class="modal-head"><h3>'+esc(title)+'</h3><button class="iconbtn" type="button" data-mclose aria-label="閉じる">&times;</button></div><div class="modal-body">'+body+'</div><div class="modal-foot">'+foot+'</div>';
    $("mdl").classList.add("open"); $("mdl").setAttribute("aria-hidden","false"); $("mdl").scrollTop=0; document.body.style.overflow="hidden";
  }
  function closeModal(){$("mdl").classList.remove("open");$("mdl").setAttribute("aria-hidden","true");lockBody()}
  var noticeFns=[];
  function openNotices(){
    var items=noticeItems(); noticeFns=items;
    var GL={ann:"お知らせ",site:"出動の目安",note:"連絡"}, IC={ann:"📢",site:"🚨",note:"💬"};
    var body="";
    if(!items.length)body='<div class="nt-empty">新しいお知らせはありません</div>';
    ["ann","site","note"].forEach(function(g){
      var xs=items.map(function(it,i){return [it,i]}).filter(function(p){return p[0].grp===g});
      if(!xs.length)return;
      body+='<div class="nt-grp">'+GL[g]+'('+xs.length+')</div>'+xs.map(function(p){
        return '<button type="button" class="nt-row" data-notice="'+p[1]+'"><span class="ic">'+IC[g]+'</span><span style="flex:1;min-width:0"><span class="tt">'+esc(p[0].title)+'</span><span class="sb'+(p[0].urgent?' urg':'')+'">'+esc(p[0].sub)+'</span></span></button>';
      }).join("");
    });
    openModal("お知らせ",body,'<button class="btn first" type="button" data-mact="annhist">お知らせの履歴</button><button class="btn" type="button" data-mact="nthist">通知の履歴</button>'+(pwaOn()?'<button class="btn" type="button" data-mact="appset">アプリ・通知</button>':'')+'<a class="btn gb-link" href="https://genbakanri-app.vercel.app/" target="_blank" rel="noopener" style="text-decoration:none">現場管理アプリ</a>'+'<button class="btn" type="button" data-mclose>閉じる</button>');
  }
  function openAnnView(id){
    var a=announcements.filter(function(x){return x.id===id})[0]; if(!a){closeModal();return}
    markRead(id);
    openModal("お知らせ",'<div class="nt-item"><div class="h">'+(a.important?'<span class="nt-imp">重要</span> ':'')+esc(a.title)+'</div><div class="m">'+esc(fmtDT(a.at))+' ・ '+esc(who(a.by))+'</div><div class="d">'+esc(a.body)+'</div></div>',
      (canAdmin?'<button class="btn first" type="button" data-mact="anedit" data-id="'+esc(id)+'">編集</button>':'')+'<button class="btn primary" type="button" data-mclose>閉じる</button>');
  }
  function openAnnHist(){
    var l=annSorted(), unseen={};
    l.forEach(function(a){if(isUnread(a))unseen[a.id]=1});
    var body=l.length?l.map(function(a){
      return '<div class="nt-item"><div class="h">'+(a.important?'<span class="nt-imp">重要</span> ':'')+esc(a.title)+(unseen[a.id]?'<span class="nt-new">NEW</span>':'')+'</div><div class="m">'+esc(fmtDT(a.at))+' ・ '+esc(who(a.by))+'</div><div class="d">'+esc(a.body)+'</div>'+
        (canAdmin?'<div class="ops"><button class="link" type="button" data-mact="anedit" data-id="'+esc(a.id)+'">編集</button><button class="link" type="button" data-mact="andel" data-id="'+esc(a.id)+'">削除</button></div>':'')+'</div>';
    }).join(""):'<div class="nt-empty">お知らせはまだありません</div>';
    openModal("お知らせの履歴",body,'<button class="btn first" type="button" data-mact="notices">戻る</button>'+(canAdmin?'<button class="btn primary" type="button" data-mact="annew">お知らせを作成</button>':'')+'<button class="btn" type="button" data-mclose>閉じる</button>');
    Object.keys(unseen).forEach(function(k){readMap[k]=1}); if(Object.keys(unseen).length){persistRead();renderBell()}
  }
  function openNtHist(){
    var feed=[]; announcements.forEach(function(a){feed.push({at:a.at||0,ic:"📢",t:(a.important?"【重要】":"")+a.title,b:(a.body||"").slice(0,60)})});
    notes.forEach(function(n){var s=n.siteId?siteById(n.siteId):null;feed.push({at:n.at||0,ic:"💬",t:n.siteId?(s?s.name:(n.siteName||"削除された現場")):"全体への連絡",b:(n.text||"").slice(0,60)+"("+who(n.by)+")"})});
    var lim=Date.now()-30*864e5; feed=feed.filter(function(f){return f.at>=lim}).sort(function(a,b){return b.at-a.at}).slice(0,100);
    var last="", body=feed.length?feed.map(function(f){
      var d=new Date(f.at), day=d.getFullYear()+"/"+p2(d.getMonth()+1)+"/"+p2(d.getDate()), head="";
      if(day!==last){last=day;head='<div class="nt-day">'+day+'</div>'}
      return head+'<div class="nt-his"><span class="ic">'+f.ic+'</span><span style="flex:1;min-width:0"><b>'+esc(f.t)+'</b><span class="bd">'+esc(f.b)+'</span></span><span class="tm">'+timeStr(f.at)+'</span></div>';
    }).join(""):'<div class="nt-empty">この30日間に届いた通知はありません</div>';
    openModal("通知の履歴",body,'<button class="btn first" type="button" data-mact="notices">戻る</button><button class="btn" type="button" data-mclose>閉じる</button>');
  }
  function openAnnForm(a){
    annEdit=a?a.id:null;
    openModal(a?"お知らせを編集":"お知らせを作成",
      '<label class="nt-field">タイトル<input id="anTitle" maxlength="60" placeholder="例:明日の早朝出動について" value="'+esc(a?a.title:"")+'"></label>'+
      '<label class="nt-field">内容<textarea id="anBody" rows="6" maxlength="1000" placeholder="連絡したい内容を書きます">'+esc(a?a.body:"")+'</textarea></label>'+
      '<label class="nt-field">重要度<select id="anImp"><option value="0">通常</option><option value="1"'+(a&&a.important?' selected':'')+'>重要(ベルとホームで目立たせる)</option></select></label><div class="muted" id="anMsg" role="status"></div>',
      '<button class="btn" type="button" data-mact="annhist">キャンセル</button><button class="btn primary" type="button" id="anSave" data-mact="ansave">'+(a?"保存する":"投稿する")+'</button>');
    $("anTitle").focus();
  }
  async function saveAnn(){
    if(!db||!canAdmin)return;
    var d={title:$("anTitle").value.trim(),body:$("anBody").value.trim(),important:$("anImp").value==="1"};
    if(!d.title||!d.body){$("anMsg").textContent="タイトルと内容を入力してください。";return}
    $("anSave").disabled=true;
    try{
      if(annEdit){await db.doc("announcements/"+annEdit).update(d)}
      else{d.at=Date.now();d.by=myId||"";var anr=await db.collection("announcements").add(d);pwaNotify("ann",anr&&anr.id)}
      toast(annEdit?"お知らせを更新しました。":"お知らせを投稿しました。"); openAnnHist();
    }catch(err){$("anMsg").textContent="保存できませんでした。編集権限を確認してください。";$("anSave").disabled=false}
  }
  function annHome(){
    var l=annSorted().filter(function(a){return a.important||(Date.now()-(a.at||0))<7*864e5}).slice(0,2);
    if(!l.length)return "";
    return '<div class="sec"><h2>お知らせ</h2><button class="link" type="button" data-act="annhist">履歴を見る</button></div>'+l.map(function(a){
      return '<article class="anc'+(a.important?' imp':'')+'"><b class="t">'+(a.important?'<span class="nt-imp">重要</span> ':'')+(isUnread(a)?'<span class="nt-new">NEW</span> ':'')+esc(a.title)+'</b><div class="bd">'+esc(a.body)+'</div><div class="mt"><span>'+esc(fmtDT(a.at))+' ・ '+esc(who(a.by))+'</span><button class="link" type="button" data-act="anopen" data-id="'+esc(a.id)+'">続きを読む</button></div></article>';
    }).join("");
  }
  $("mdl").addEventListener("click",async function(e){
    if(e.target===$("mdl")||e.target.closest("[data-mclose]")){closeModal();return}
    var r=e.target.closest("[data-notice]");
    if(r){var f=noticeFns[+r.dataset.notice];closeModal();if(f&&f.go)f.go();return}
    var b=e.target.closest("[data-mact]"); if(!b)return;
    var k=b.dataset.mact, id=b.dataset.id;
    if(k==="notices")openNotices();
    else if(k==="annhist")openAnnHist();
    else if(k==="appset"){pwa.msg="";openAppSet()}
    else if(k==="pwinstall"){if(pwa.ev){pwa.ev.prompt();try{await pwa.ev.userChoice}catch(e){}pwa.ev=null;openAppSet()}}
    else if(k==="pwon")pwaEnable();
    else if(k==="pwoff")pwaDisable();
    else if(k==="pwtest"){try{var tr=await window.__FB.callPush({action:"test"});pwa.msg=tr.sent?"テスト通知を送りました。":"送信先が見つかりませんでした。通知をオフ→オンにしてみてください。"}catch(e){pwa.msg="テスト通知を送れませんでした。"}openAppSet()}
    else if(k==="nthist")openNtHist();
    else if(k==="annew"){if(canAdmin)openAnnForm(null)}
    else if(k==="anedit"){var a0=announcements.filter(function(x){return x.id===id})[0];if(a0&&canAdmin)openAnnForm(a0)}
    else if(k==="ansave")saveAnn();
    else if(k==="andel"){
      if(!canAdmin||!arm("ad"+id,b,"削除"))return;
      try{await db.doc("announcements/"+id).delete();toast("お知らせを削除しました。");openAnnHist()}catch(err){toast("削除できませんでした。")}
    }
  });
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&$("mdl").classList.contains("open"))closeModal()});
  function checkGate(){
    var me=access[myId], any=Object.keys(access).length>0;
    var ok=!(settings.requireLogin&&accessLoaded&&any&&!canAdmin&&myId)||!!(me&&me.active!==false);
    $("gate").hidden=ok;
    $("gateWho").textContent=myName?("ログイン中のアカウント:"+myName):"";
    var l=$("meLine"), t=me?(me.name+(me.role?"(" +me.role+ ")":"")):(myName?myName:"");
    if(t&&!canAdmin||t&&canAdmin){l.textContent="ログイン中:"+t+(canAdmin?"・管理者":"")+" ";if(window.__FB){var lb=document.createElement("button");lb.type="button";lb.className="link";lb.dataset.act="logout";lb.textContent="ログアウト";l.appendChild(lb)}l.hidden=false}else l.hidden=true;
  }
  $("gateRetry").addEventListener("click",function(){checkGate();location.reload()});
  function renderAdminAll(){
    Array.prototype.forEach.call($("subtabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.sub===sub))});
    var DESC={photos:"案件・日報の写真を一覧で確認し、まとめて削除・軽量化します。",members:"社内メンバーの名簿を管理します。担当班は、マスタの担当班から選べます。",sites:"現場の登録・編集と、出動基準・担当班のまとめ変更、作業状況のリセットができます。",master:"地区・担当班・使用機械の選択肢を管理します。現場や日報の入力欄の候補になります。",set:"出動目安の判定に使う基準と、天気の自動更新の間隔を設定します。"};
    $("admDesc").textContent=DESC[sub]||"";
    $("subtabs").hidden=(sub==="members");
    var h1=document.querySelector(".admh1"); if(h1)h1.textContent=(sub==="members"?"メンバー管理":"設定");
    Array.prototype.forEach.call($("siteTabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.st===stab))});
    Array.prototype.forEach.call($("mTabs").querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.mt===mtab))});
    $("adm-s-list").hidden=stab!=="list"; $("adm-s-csv").hidden=stab!=="csv";
    $("mp-area").hidden=mtab!=="area"; $("mp-crew").hidden=mtab!=="crew"; $("mp-mach").hidden=mtab!=="mach"; $("mp-work").hidden=mtab!=="work";
    $("adm-sites").hidden=sub!=="sites"; $("adm-master").hidden=sub!=="master"; $("adm-set").hidden=sub!=="set"; $("adm-members").hidden=sub!=="members"; $("adm-photos").hidden=sub!=="photos";
    if(sub==="sites")renderAdmin();
    else if(sub==="master")renderMaster(false);
    else if(sub==="members")renderMembers();
    else if(sub==="photos")renderPhotos();
  }
  var stab="list", mtab="area", pg=0, pgSize=10;
  $("siteTabs").addEventListener("click",function(e){var b=e.target.closest("button[data-st]");if(!b)return;stab=b.dataset.st;renderAdminAll()});
  $("mTabs").addEventListener("click",function(e){var b=e.target.closest("button[data-mt]");if(!b)return;mtab=b.dataset.mt;mDirty=false;renderAdminAll()});
  $("subtabs").addEventListener("click",function(e){var b=e.target.closest("button[data-sub]");if(!b)return;sub=b.dataset.sub;renderAdminAll()});
  function adminRows(){
    var q=($("admQ").value||"").trim().toLowerCase(), k=$("admSort").value;
    var jp2=function(a,b){return String(a||"").localeCompare(String(b||""),"ja")};
    var rows=sites.filter(function(s){return !q||[s.name,s.area,s.crew,s.address].join(" ").toLowerCase().indexOf(q)>=0});
    rows.sort(function(a,b){
      if(k==="manual")return manKey(a)-manKey(b)||jp2(a.name,b.name);
      if(k==="name")return jp2(a.name,b.name);
      if(k==="crew")return jp2(a.crew||"~",b.crew||"~")||jp2(a.name,b.name);
      if(k==="th")return (b.threshold||0)-(a.threshold||0)||jp2(a.name,b.name);
      if(k==="contract")return (b.contractCount||0)-(a.contractCount||0)||jp2(a.name,b.name);
      if(k==="new")return (b.createdAt||0)-(a.createdAt||0);
      if(k==="old")return (a.createdAt||0)-(b.createdAt||0);
      return jp2(a.area,b.area)||jp2(a.name,b.name);
    });
    return rows;
  }
  $("admQ").addEventListener("input",function(){pg=0;renderAdmin()});
  $("admSort").addEventListener("change",function(){pg=0;renderAdmin()});
  $("pager").addEventListener("click",function(e){
    var b=e.target.closest("[data-pg]"); if(!b)return;
    var v=b.dataset.pg;
    if(v==="prev")pg=Math.max(0,pg-1); else if(v==="next")pg++;
    else if(v==="all"){adminRows().forEach(function(s){sel[s.id]=true})}
    renderAdmin();
  });
  $("pager").addEventListener("change",function(e){if(e.target.id==="pgSize"){pgSize=+e.target.value||10;pg=0;renderAdmin()}});
  // 契約・単価を、作業内容ごとに1行ずつ見せる
  function ctHtml(s){
    var ls=siteLines(s);
    if(!ls.length)return '<div class="ct emp">契約・単価: 未登録</div>';
    return '<div class="ct">'+ls.map(function(l){
      return '<div class="cr"><span class="cw">'+esc(lineLabel(l)||"全体")+'</span><span class="cn">'+(l.count>0?'契約 '+l.count+'回':'')+'</span>'+
        (canAdmin?'<span class="cp">'+(l.unitPrice>0?yen(l.unitPrice)+' / '+(l.unit==="時間"?"時間":"回"):'<span class="muted" style="font-weight:400">単価未登録</span>')+'</span>':'')+'</div>';
    }).join("")+'</div>';
  }
  function renderAdmin(){
    var all=adminRows(), pages=Math.max(1,Math.ceil(all.length/pgSize));
    if(pg>=pages)pg=pages-1;
    var rows=all.slice(pg*pgSize,pg*pgSize+pgSize), mv=($("admSort").value==="manual"&&canAdmin), aids=all.map(function(s){return s.id});
    $("admList").__ids=aids;
    $("pager").innerHTML=all.length?'<button class="btn sm" type="button" data-pg="prev"'+(pg===0?' disabled':'')+'>‹ 前へ</button><span class="pg-info"><b class="num">'+(pg+1)+' / '+pages+'</b> ページ(全'+all.length+'件)</span><button class="btn sm" type="button" data-pg="next"'+(pg>=pages-1?' disabled':'')+'>次へ ›</button><select id="pgSize" aria-label="1ページの件数">'+[10,20,50].map(function(n){return '<option value="'+n+'"'+(n===pgSize?' selected':'')+'>'+n+'件ずつ</option>'}).join("")+'</select><button class="btn sm" type="button" data-pg="all">検索結果をすべて選択</button>':'';
    $("admList").innerHTML=rows.length?rows.map(function(s){
      var w=wx[s.id], id=esc(s.id), st=stOf(s);
      var wp=!mcp?'<span class="pill l0">未接続</span>':(!w||(w.state==="loading"&&!w.cur))?'<span class="pill l0">取得中</span>':w.state==="noloc"?'<span class="pill l0">場所未設定</span>':w.state==="err"?'<span class="pill l3">取得失敗</span>':'<span class="pill l1">取得OK</span>';
      var pt=unitText(s);
      return '<article class="ar"><label class="ck"><input type="checkbox" data-sel="'+id+'"'+(sel[s.id]?' checked':'')+' aria-label="'+esc(s.name)+'を選択"></label>'+
        '<div class="nm"><b>'+esc(s.name)+(s.sample?' <span class="tag">サンプル</span>':'')+'</b><span>'+esc([s.area,s.crew?('担当 '+s.crew):'担当 未設定'].filter(Boolean).join(' ・ '))+'</span></div>'+
        '<span class="ed edb">'+(mv?'<button class="btn sm" type="button" data-act="mv" data-d="-1" data-id="'+id+'" aria-label="上へ"'+(aids.indexOf(s.id)===0?' disabled':'')+'>↑</button><button class="btn sm" type="button" data-act="mv" data-d="1" data-id="'+id+'" aria-label="下へ"'+(aids.indexOf(s.id)===aids.length-1?' disabled':'')+'>↓</button>':'')+'<button class="btn sm" type="button" data-act="copy" data-id="'+id+'" aria-label="'+esc(s.name)+'をコピー">コピー</button><button class="btn sm" type="button" data-act="edit" data-id="'+id+'">編集</button></span>'+
        '<div class="kvs"><span class="k"><small>出動基準</small><span class="num">'+esc(s.threshold||"–")+'cm</span></span>'+
        '<span class="k'+(+s.sqm>0?'':' emp')+'"><small>平米数</small><span class="num">'+esc(sqmText(s)||"–")+'</span></span>'+
        '<span class="k'+(siteHands(s).length?'':' emp')+'"><small>引渡時間</small><span class="num">'+esc(handText(s)||"–")+'</span></span>'+
        '<span class="k'+(s.loc?'':' emp')+'"><small>位置</small><span>'+(s.loc?'設定済':'未設定')+'</span></span>'+
        '<span class="k wide'+(s.address?'':' emp')+'"><small>住所</small><span class="tx">'+esc(s.address||"–")+'</span></span>'+
        '<span class="k wide'+(s.note?'':' emp')+'"><small>備考</small><span class="tx">'+esc(s.note||"–")+'</span></span></div>'+
        ctHtml(s)+
        '</article>';
    }).join(""):'<div class="empty"><b>該当する現場はありません</b>「現場を追加」から登録するか、検索を変えてください。</div>';
    var n=selIds().length;
    $("bulk").hidden=n===0; $("bulkN").textContent=n;
    $("selAll").checked=rows.length>0&&rows.every(function(s){return sel[s.id]});
  }
  async function resetStatus(ids){
    var n=0;
    for(var i=0;i<ids.length;i++){
      var s=siteById(ids[i]);
      if(!s||stOf(s)==="standby")continue;
      try{await db.doc("ops/"+ids[i]).set({status:"standby",statusAt:Date.now()});n++}catch(e){}
    }
    return n;
  }
  function twoStep(btn,label,run){
    btn.addEventListener("click",function(){
      if(btn.dataset.arm!=="1"){btn.dataset.arm="1";btn.textContent="もう一度押すと実行します";setTimeout(function(){btn.dataset.arm="";btn.textContent=label},4000);return}
      btn.dataset.arm="";btn.textContent=label;run();
    });
  }
  $("admList").addEventListener("change",function(e){
    var id=e.target.getAttribute("data-sel"); if(!id)return;
    if(e.target.checked)sel[id]=true; else delete sel[id];
    renderAdmin();
  });
  $("selAll").addEventListener("change",function(e){
    adminRows().slice(pg*pgSize,pg*pgSize+pgSize).forEach(function(s){if(e.target.checked)sel[s.id]=true; else delete sel[s.id]});
    renderAdmin();
  });
  $("bClear").addEventListener("click",function(){sel={};renderAdmin()});
  $("bApply").addEventListener("click",async function(){
    if(!db)return;
    var ids=selIds(); if(!ids.length)return;
    var th=parseInt($("bTh").value,10), crew=$("bCrew").value.trim(), area=$("bArea").value.trim(), ct=$("bContract").value, data={};
    var pr=parseInt($("bPrice").value,10), un=$("bUnit").value, pdata={};
    if(th>0)data.threshold=th;
    if(crew)data.crew=crew;
    if(area)data.area=area;
    if(ct!==""&&parseInt(ct,10)>=0)data.contractCount=parseInt(ct,10);
    if(pr>=0)pdata.unitPrice=pr;
    if(un)pdata.unit=un;
    if(!Object.keys(data).length&&!Object.keys(pdata).length){flash("bMsg","変更する項目を入力してください。");return}
    $("bApply").disabled=true;
    var ok=0;
    for(var i=0;i<ids.length;i++){
      try{
        var bs=siteById(ids[i]), hasL=bs&&Array.isArray(bs.lines)&&bs.lines.length;
        if(hasL&&(data.contractCount!=null||pdata.unitPrice!=null||pdata.unit)){   // 行がある現場は、先頭の行に反映する
          var bl=siteLines(bs); if(data.contractCount!=null)bl[0].count=data.contractCount; if(canAdmin){if(pdata.unitPrice!=null)bl[0].unitPrice=pdata.unitPrice; if(pdata.unit)bl[0].unit=pdata.unit}
          var sv=lineSave(bl), d2=Object.assign({},data); d2.lines=sv.site.lines; d2.contractCount=sv.site.contractCount;
          await db.doc("sites/"+ids[i]).update(d2);
          if(canAdmin&&(pdata.unitPrice!=null||pdata.unit)){if(sv.price)await db.doc("prices/"+ids[i]).set(sv.price);else if(prices[ids[i]])await db.doc("prices/"+ids[i]).delete()}
        }else{
          if(Object.keys(data).length)await db.doc("sites/"+ids[i]).update(data);
          if(Object.keys(pdata).length&&canAdmin){var old=prices[ids[i]]||{unitPrice:0,unit:"回"};await db.doc("prices/"+ids[i]).set(Object.assign({},old,pdata))}
        }
        ok++;
      }catch(e){}
    }
    $("bApply").disabled=false;
    ["bTh","bCrew","bArea","bContract","bPrice"].forEach(function(x){$(x).value=""});$("bUnit").value="";
    flash("bMsg",ok+"件に反映しました"+(ok<ids.length?("("+(ids.length-ok)+"件は保存できませんでした)"):""));
  });
  twoStep($("bDel"),"選択した現場を削除",async function(){
    if(!db)return;
    var ids=selIds(), ok=0;
    for(var i=0;i<ids.length;i++){
      try{
        await db.doc("sites/"+ids[i]).delete();
        try{await db.doc("ops/"+ids[i]).delete()}catch(e1){}
        try{if(prices[ids[i]])await db.doc("prices/"+ids[i]).delete()}catch(e2){}
        delete wx[ids[i]]; delete sel[ids[i]]; ok++;
      }catch(e){}
    }
    renderAdmin();
    flash("bMsg",ok+"件の現場を削除しました。"+(ok<ids.length?("("+(ids.length-ok)+"件は削除できませんでした)"):"日報や連絡の記録は残ります。"));
  });
  $("bReset").addEventListener("click",async function(){
    if(!db)return;
    var n=await resetStatus(selIds());
    flash("bMsg",n?n+"件を待機に戻しました。":"待機に戻す現場はありませんでした。");
  });
  twoStep($("resetAll"),"すべて待機に戻す",async function(){
    if(!db)return;
    var n=await resetStatus(sites.map(function(s){return s.id}));
    flash("rMsg",n?n+"件を待機に戻しました。":"待機に戻す現場はありませんでした。");
  });
  $("setForm").addEventListener("submit",async function(e){
    e.preventDefault(); if(!db)return;
    var ice=parseFloat($("sIce").value), mult=parseFloat($("sMult").value);
    var d={
      defaultTh:Math.max(1,parseInt($("sDefTh").value,10)||10),
      iceTemp:isFinite(ice)?ice:0,
      mult:Math.min(3,Math.max(0.3,isFinite(mult)&&mult>0?mult:1)),
      refreshMin:parseInt($("sRefresh").value,10)||10,
      requireLogin:$("sReq").value==="1",
      brand:{name:$("brName").value.trim().slice(0,30),logo:brDraft.logo||"",icon:brDraft.icon||""},
      photo:(function(){var o={level:$("pqLevel").value};["light","std","high"].forEach(function(k){o[k]={side:+$("pq_"+k+"_s").value||0,q:+$("pq_"+k+"_q").value||0,kb:+$("pq_"+k+"_k").value||0}});return o})()
    };
    $("sSave").disabled=true;
    try{await db.doc("settings/main").set(d);flash("sMsg","保存しました。")}
    catch(err){flash("sMsg","保存できませんでした。編集権限を確認してください。")}
    finally{$("sSave").disabled=false}
  });


  /* ---------- 候補つき入力欄(地区・担当班・作業内容):タップすると候補をすべて表示。自由に入力もできる ---------- */
  var cbEl=null, cbIn=null, cbTyped=false, cbIdx=-1;
  function cbOpts(inp){
    var dl=document.getElementById(inp.getAttribute("data-combo")); if(!dl)return [];
    return Array.prototype.map.call(dl.querySelectorAll("option"),function(o){return o.value}).filter(Boolean);
  }
  function cbClose(){if(cbEl){cbEl.remove();cbEl=null}cbIn=null;cbTyped=false;cbIdx=-1}
  function cbPlace(){
    if(!cbEl||!cbIn)return;
    var r=cbIn.getBoundingClientRect(), below=window.innerHeight-r.bottom, h=Math.min(260,cbEl.scrollHeight+10);
    cbEl.style.left=r.left+"px"; cbEl.style.width=r.width+"px";
    if(below<h+8&&r.top>below){cbEl.style.top="auto";cbEl.style.bottom=(window.innerHeight-r.top+4)+"px";cbEl.style.maxHeight=Math.min(260,r.top-12)+"px"}
    else{cbEl.style.bottom="auto";cbEl.style.top=(r.bottom+4)+"px";cbEl.style.maxHeight=Math.min(260,Math.max(120,below-12))+"px"}
  }
  function cbDraw(){
    if(!cbIn)return;
    var all=cbOpts(cbIn), q=cbTyped?cbIn.value.trim().toLowerCase():"";
    var list=q?all.filter(function(v){return v.toLowerCase().indexOf(q)>=0}):all;
    if(!cbEl){cbEl=document.createElement("div");cbEl.id="cbPanel";cbEl.setAttribute("role","listbox");document.body.appendChild(cbEl);
      cbEl.addEventListener("mousedown",function(e){e.preventDefault()});
      cbEl.addEventListener("click",function(e){var b=e.target.closest("button[data-v]");if(!b||!cbIn)return;var t=cbIn;t.value=b.dataset.v;t.dispatchEvent(new Event("input",{bubbles:true}));t.dispatchEvent(new Event("change",{bubbles:true}));cbClose()});
    }
    cbEl.innerHTML=list.length?list.map(function(v,i){return '<button type="button" role="option" data-v="'+esc(v)+'"'+(i===cbIdx?' class="on"':'')+'>'+esc(v)+'</button>'}).join(""):
      '<div class="none">'+(all.length?'一致する候補がありません(そのまま入力もできます)。':'候補がまだありません。「設定」の「マスタ」で登録できます。')+'</div>';
    cbPlace();
  }
  function cbOpen(inp){cbIn=inp;cbTyped=false;cbIdx=-1;cbDraw()}
  document.addEventListener("focusin",function(e){var t=e.target;if(t&&t.matches&&t.matches("input[data-combo]"))cbOpen(t)});
  document.addEventListener("click",function(e){
    var t=e.target;
    if(t&&t.matches&&t.matches("input[data-combo]")){if(!cbEl||cbIn!==t)cbOpen(t)}
    else if(cbEl&&!e.target.closest("#cbPanel"))cbClose();
  });
  document.addEventListener("input",function(e){var t=e.target;if(t&&t.matches&&t.matches("input[data-combo]")){if(cbIn!==t)cbIn=t;cbTyped=true;cbIdx=-1;cbDraw()}});
  document.addEventListener("keydown",function(e){
    if(!cbEl||!cbIn)return;
    var bs=cbEl.querySelectorAll("button[data-v]");
    if(e.key==="Escape"){cbClose();return}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){
      e.preventDefault(); if(!bs.length)return;
      cbIdx=e.key==="ArrowDown"?Math.min(bs.length-1,cbIdx+1):Math.max(0,cbIdx-1);
      Array.prototype.forEach.call(bs,function(b,i){b.classList.toggle("on",i===cbIdx)}); bs[cbIdx].scrollIntoView({block:"nearest"});
    }else if(e.key==="Enter"&&cbIdx>=0&&bs[cbIdx]){e.preventDefault();bs[cbIdx].click()}
    else if(e.key==="Tab")cbClose();
  });
  window.addEventListener("resize",cbPlace);
  document.addEventListener("scroll",cbPlace,true);

  /* ---------- 設定:マスタ ---------- */
  function mflash(txt){flash("mMsg",txt)}
  function fillLists(){
    // 候補 = マスタ + すでに現場で使われている名前
    var ja=function(x,y){return x.localeCompare(y,"ja")}, uniq=function(arr){var o={};return arr.filter(function(v){v=String(v||"").trim();if(!v||o[v])return false;o[v]=1;return true})};
    var ar=masters.areas.map(function(a){return a.name}), cr=masters.crews.slice();
    sites.forEach(function(s){if(s.area)ar.push(s.area); if(s.crew)cr.push(s.crew)});
    var mo=function(l){return l.map(function(c){return '<option value="'+esc(c)+'"></option>'}).join("")};
    $("dlAreas").innerHTML=mo(uniq(ar).sort(ja));
    $("dlCrews").innerHTML=mo(uniq(cr).sort(ja));
    var wk=masters.works.map(function(w){return w.name}); sites.forEach(function(s){(Array.isArray(s.lines)?s.lines:[]).forEach(function(l){if(l.work)wk.push(l.work)})});
    $("dlWork").innerHTML=mo(uniq(wk));
  }
  function tagList(list,key,empty){
    return list.length?list.map(function(c,i){
      return '<span class="ctag">'+esc(c)+'<button type="button" data-mact="ldel" data-list="'+key+'" data-i="'+i+'" aria-label="'+esc(c)+'を削除">×</button></span>';
    }).join(""):'<span class="muted">'+empty+'</span>';
  }
  function renderMaster(force){
    var box=$("adm-master");
    if(!force&&box.contains(document.activeElement)&&document.activeElement.tagName==="INPUT")return;
    var cnt={}; sites.forEach(function(s){var k=s.area||"";cnt[k]=(cnt[k]||0)+1});
    $("atbody").innerHTML=masters.areas.length?masters.areas.map(function(a,i){
      return '<tr><td><input data-an="'+i+'" value="'+esc(a.name)+'" maxlength="30" aria-label="地区名"></td><td><input data-al="'+i+'" value="'+esc(a.loc||"")+'" maxlength="80" placeholder="未設定" aria-label="代表地点"></td><td class="num">'+(cnt[a.name]||0)+'</td><td><div class="row2"><button class="btn" type="button" data-mact="save" data-i="'+i+'">保存</button><button class="btn" type="button" data-mact="apply" data-i="'+i+'">地区の現場に反映</button><button class="btn danger" type="button" data-mact="del" data-i="'+i+'">削除</button></div></td></tr>';
    }).join(""):'<tr><td colspan="4" class="muted">地区が登録されていません。下の欄から追加してください。</td></tr>';
    $("ctags").innerHTML=tagList(masters.crews,"crews","担当班が登録されていません。");
    $("mtags").innerHTML=tagList(masters.machines,"machines","使用機械が登録されていません。");
    renderWorkMaster();
    mFill(false);
  }
  async function saveAreas(items){await db.doc("masters/areas").set({items:items});masters.areas=items;fillLists();}
  async function saveList(key,items){await db.doc("masters/"+key).set({items:items});masters[key]=items;fillLists();}
  async function loadMany(list){
    var i=0;
    var worker=async function(){while(i<list.length){var s=list[i++];await loadOne(s,false);}};
    await Promise.all([worker(),worker(),worker()]);
  }
  function syncWx(){
    if(!mcp||!sites.length)return;
    var need=sites.filter(function(s){return !wx[s.id]||wx[s.id].loc!==effLoc(s)});
    if(need.length)loadMany(need);
  }
  var armed="";
  $("adm-master").addEventListener("click",async function(e){
    var b=e.target.closest("[data-mact]"); if(!b||!db)return;
    var act=b.dataset.mact, i=+b.dataset.i;
    try{
      if(act==="ladd"){
        var key=b.dataset.list, inp=$(b.dataset.in), name=inp.value.trim();
        if(!name){mflash("名前を入力してください。");return}
        if(masters[key].indexOf(name)>=0){mflash("同じ名前がすでにあります。");return}
        await saveList(key,masters[key].concat([name])); inp.value=""; renderMaster(true); mflash("「"+name+"」を追加しました。");
      }else if(act==="save"){
        var row=b.closest("tr"), nm=row.querySelector("[data-an]").value.trim(), loc=row.querySelector("[data-al]").value.trim();
        if(!nm){mflash("地区名を入力してください。");return}
        if(masters.areas.some(function(a,j){return j!==i&&a.name===nm})){mflash("同じ名前の地区がすでにあります。");return}
        var old=masters.areas[i].name, items=masters.areas.slice();
        items[i]={name:nm,loc:loc};
        await saveAreas(items);
        var moved=0;
        if(old!==nm){
          var tg=sites.filter(function(s){return s.area===old});
          for(var k=0;k<tg.length;k++){try{await db.doc("sites/"+tg[k].id).update({area:nm});moved++}catch(e1){}}
        }
        renderMaster(true);
        mflash("保存しました。"+(moved?("地区名を変えたため、"+moved+"件の現場の地区名も更新しました。"):""));
      }else if(act==="apply"||act==="del"||act==="ldel"){
        var ak=act+(b.dataset.list||"")+i;
        if(armed!==ak){
          armed=ak; var orig=b.textContent; b.textContent="もう一度押すと実行";
          setTimeout(function(){if(armed===ak){armed="";b.textContent=orig}},4000);
          return;
        }
        armed="";
        if(act==="apply"){
          var a=masters.areas[i], l2=a.loc;
          if(!l2){mflash("この地区には代表地点がありません。先に入力して保存してください。");renderMaster(true);return}
          var tg2=sites.filter(function(s){return s.area===a.name}), n=0;
          for(var m=0;m<tg2.length;m++){try{await db.doc("sites/"+tg2[m].id).update({loc:l2});n++}catch(e2){}}
          renderMaster(true);
          mflash(n?(a.name+"の"+n+"件の現場に代表地点を反映しました。"):"反映する現場がありません。");
        }else if(act==="del"){
          var dn=masters.areas[i].name;
          await saveAreas(masters.areas.filter(function(x,j){return j!==i}));
          renderMaster(true);
          mflash("「"+dn+"」を削除しました。この地区の現場の地区名は変わりません。");
        }else{
          var lk=b.dataset.list, cn=masters[lk][i];
          await saveList(lk,masters[lk].filter(function(x,j){return j!==i}));
          renderMaster(true);
          mflash("「"+cn+"」を削除しました。");
        }
      }
    }catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });
  $("maAdd").addEventListener("click",async function(){
    if(!db)return;
    var name=$("maName").value.trim(), loc=$("maLoc").value.trim();
    if(!name){mflash("地区名を入力してください。");return}
    if(masters.areas.some(function(a){return a.name===name})){mflash("同じ名前の地区がすでにあります。");return}
    try{await saveAreas(masters.areas.concat([{name:name,loc:loc}]));$("maName").value="";$("maLoc").value="";renderMaster(true);mflash("「"+name+"」を追加しました。")}
    catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });



  /* ---------- 作業内容マスタ(契約・金額で選ぶ作業内容。単価はここに入れない) ---------- */
  var KW={all:"すべて",joset:"除雪",hai:"排雪",other:"その他"};
  function kindOf(v){v=String(v||"").trim();if(LKIND[v])return v;for(var k in KW){if(KW[k]===v||v===LSHORT[k])return k}return "all"}
  function cleanWork(w){return {name:String(w.name||"").trim(),kind:kindOf(w.kind),unit:w.unit==="時間"?"時間":"回"}}
  function kindOpts(sel){return Object.keys(LKIND).map(function(k){return '<option value="'+k+'"'+(sel===k?' selected':'')+'>'+esc(LKIND[k])+'</option>'}).join("")}
  function renderWorkMaster(){
    $("wtbody").innerHTML=masters.works.length?masters.works.map(function(w,i){
      return '<tr><td><input data-wn="'+i+'" value="'+esc(w.name)+'" maxlength="30" aria-label="作業内容"></td>'+
        '<td><select data-wk="'+i+'" aria-label="集計の対象">'+kindOpts(w.kind)+'</select></td>'+
        '<td><select data-wu="'+i+'" aria-label="単価の単位"><option value="回"'+(w.unit==="時間"?'':' selected')+'>1回あたり</option><option value="時間"'+(w.unit==="時間"?' selected':'')+'>1時間あたり</option></select></td>'+
        '<td style="white-space:nowrap"><button class="btn sm" type="button" data-wact="save" data-i="'+i+'">保存</button> <button class="btn sm" type="button" data-wact="del" data-i="'+i+'">削除</button></td></tr>';
    }).join(""):'<tr><td colspan="4" class="muted">作業内容が登録されていません。下の欄から追加してください。</td></tr>';
  }
  async function saveWorks(items){await db.doc("masters/works").set({items:items});masters.works=items;fillLists();}
  $("mwAdd").addEventListener("click",async function(){
    if(!db)return;
    var w=cleanWork({name:$("mwName").value,kind:$("mwKind").value,unit:$("mwUnit").value});
    if(!w.name){mflash("作業内容の名前を入力してください。");return}
    if(masters.works.some(function(x){return x.name===w.name})){mflash("同じ名前の作業内容がすでにあります。");return}
    try{await saveWorks(masters.works.concat([w]));$("mwName").value="";renderMaster(true);mflash("「"+w.name+"」を追加しました。")}
    catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });
  var wArmed="";
  $("wtbody").addEventListener("click",async function(e){
    var b=e.target.closest("[data-wact]"); if(!b||!db)return;
    var i=+b.dataset.i, row=b.closest("tr");
    try{
      if(b.dataset.wact==="save"){
        var w=cleanWork({name:row.querySelector("[data-wn]").value,kind:row.querySelector("[data-wk]").value,unit:row.querySelector("[data-wu]").value});
        if(!w.name){mflash("作業内容の名前を入力してください。");return}
        if(masters.works.some(function(x,j){return j!==i&&x.name===w.name})){mflash("同じ名前の作業内容がすでにあります。");return}
        var items=masters.works.slice(); items[i]=w; await saveWorks(items); renderMaster(true);
        mflash("保存しました。すでに現場に入っている作業内容は変わりません(新しく選ぶときから、この設定が入ります)。");
      }else{
        if(wArmed!=="d"+i){wArmed="d"+i;var o=b.textContent;b.textContent="もう一度押すと削除";setTimeout(function(){if(wArmed==="d"+i){wArmed="";b.textContent=o}},4000);return}
        wArmed=""; var nm=masters.works[i].name;
        await saveWorks(masters.works.filter(function(x,j){return j!==i})); renderMaster(true);
        mflash("「"+nm+"」を削除しました。すでに現場に入っている作業内容は変わりません。");
      }
    }catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });

  /* ---------- マスタの一括編集・CSV(いま開いている種類が対象) ---------- */
  var MK={area:{key:"areas",name:"地区",head:"地区名",max:30},crew:{key:"crews",name:"担当班",head:"班の名前",max:40},mach:{key:"machines",name:"使用機械",head:"機械の名前",max:30},work:{key:"works",name:"作業内容",head:"作業内容",max:30}};
  var mDirty=false, mPending="";
  function mItems(){return mtab==="area"?masters.areas.map(function(a){return {name:a.name,loc:a.loc||""}}):mtab==="work"?masters.works.map(function(w){return {name:w.name,kind:w.kind,unit:w.unit}}):masters[MK[mtab].key].map(function(n){return {name:n}})}
  function mText(){return mItems().map(function(x){return mtab==="area"?(x.loc?x.name+","+x.loc:x.name):mtab==="work"?x.name+","+KW[x.kind]+","+x.unit:x.name}).join("\n")}
  function mFill(force){
    var k=MK[mtab];
    $("mBulkT").textContent=k.name+"マスタの一括編集・CSV";
    $("mBulkL").textContent=k.name+"を1行に1つずつ書きます";
    $("mBulkH").textContent=mtab==="work"?"書き方:「作業内容,集計の対象,単位」(例:機械除雪(ローダー),除雪,時間)。集計の対象は すべて/除雪/排雪/その他、単位は 回/時間 です(省略すると すべて・回)。":mtab==="area"?"書き方:「地区名,緯度, 経度」(代表地点は省略できます。例:盛岡南,39.70, 141.13)。地区名を変えても、現場の地区名は自動では変わりません(現場の地区は、上の表で名前を変えたときだけ更新されます)。":"書き方:1行に1つ。空の行は無視し、同じ名前は1つにまとめます。";
    $("mCsvH").textContent="CSVの1行目は項目名("+(mtab==="area"?"地区名,代表地点":mtab==="work"?"作業内容,集計の対象,単価の単位":k.head)+")です。"+(mtab==="work"?"集計の対象は すべて/除雪/排雪/その他、単位は 回/時間 です。":"")+(mtab==="area"?"代表地点は「39.70, 141.13」のように書きます。":"");
    if(force||!mDirty){$("mBulk").value=mText();mDirty=false;mPending=""}
  }
  function mClean(list){
    var seen={},out=[],bad="";
    list.forEach(function(x){
      var nm=String(x.name||"").trim(), loc=String(x.loc||"").trim(); if(!nm||seen[nm])return; seen[nm]=1;
      if(mtab==="work"){if(nm.length>MK[mtab].max)bad="「"+nm.slice(0,12)+"…」は名前が長すぎます("+MK[mtab].max+"文字まで)。";out.push({name:nm,kind:kindOf(x.kind),unit:String(x.unit||"").trim()==="時間"?"時間":"回"});return}
      if(nm.length>MK[mtab].max)bad="「"+nm.slice(0,12)+"…」は名前が長すぎます("+MK[mtab].max+"文字まで)。";
      if(loc.length>80)bad="代表地点が長すぎます(80文字まで)。";
      out.push(mtab==="area"?{name:nm,loc:loc}:nm);
    });
    return {items:out,bad:bad};
  }
  function mCompare(next){
    var cur=mtab==="area"?masters.areas:masters[MK[mtab].key], by={};
    var nk=function(x){return mtab==="area"||mtab==="work"?x.name:x};
    cur.forEach(function(x){by[nk(x)]=x});
    var add=0,chg=0,names={};
    next.forEach(function(x){var n=nk(x); names[n]=1; if(!by[n])add++; else if(mtab==="area"&&(by[n].loc||"")!==x.loc)chg++; else if(mtab==="work"&&(by[n].kind!==x.kind||by[n].unit!==x.unit))chg++});
    var del=Object.keys(by).filter(function(n){return !names[n]}).length;
    return {add:add,chg:chg,del:del};
  }
  async function mSave(items){return mtab==="area"?saveAreas(items):mtab==="work"?saveWorks(items):saveList(MK[mtab].key,items)}
  $("mBulk").addEventListener("input",function(){mDirty=true;mPending=""});
  $("mBulkReset").addEventListener("click",function(){mFill(true);mflash("元に戻しました。")});
  $("mBulkGo").addEventListener("click",async function(){
    if(!db)return;
    var lines=$("mBulk").value.split(/\r?\n/).map(function(l){return l.trim()}).filter(Boolean);
    var res=mClean(lines.map(function(l){
      if(mtab==="work"){var p=l.split(/[,，\t]/).map(function(x){return x.trim()});return {name:p[0],kind:p[1]||"",unit:p[2]||""}}
      if(mtab!=="area")return {name:l};
      var i=l.search(/[,，\t]/); return i<0?{name:l,loc:""}:{name:l.slice(0,i),loc:l.slice(i+1)};
    }));
    if(res.bad){mflash(res.bad);return}
    var c=mCompare(res.items);
    if(!c.add&&!c.chg&&!c.del){mflash("変更はありません。");return}
    var sig=$("mBulk").value;
    if(mPending!==sig){mPending=sig;mflash("追加"+c.add+"件・変更"+c.chg+"件・削除"+c.del+"件になります。よければ、もう一度「この内容に置き換える」を押してください。");return}
    mPending="";
    try{await mSave(res.items);mDirty=false;renderMaster(true);mFill(true);mflash("反映しました(追加"+c.add+"件・変更"+c.chg+"件・削除"+c.del+"件)。")}
    catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });
  $("mCsvOut").addEventListener("click",function(){
    var hd=mtab==="area"?["地区名","代表地点"]:mtab==="work"?["作業内容","集計の対象","単価の単位"]:[MK[mtab].head], lines=[hd.map(csvCell2).join(",")];
    mItems().forEach(function(x){lines.push((mtab==="area"?[x.name,x.loc]:mtab==="work"?[x.name,KW[x.kind],x.unit]:[x.name]).map(csvCell2).join(","))});
    csvSave("マスタ_"+MK[mtab].name+"_"+todayStr()+".csv",lines,"mMsg");
  });
  $("mCsvTpl").addEventListener("click",function(){
    var ex=mtab==="area"?[["盛岡南","39.70, 141.13"],["滝沢西",""]]:mtab==="crew"?[["A班 山田"],["B班 佐藤"]]:mtab==="work"?[["機械除雪(ローダー)","除雪","時間"],["運搬排雪","排雪","回"]]:[["除雪トラック"],["ローダ"]];
    csvSave("マスタ取り込み見本_"+MK[mtab].name+".csv",[(mtab==="area"?["地区名","代表地点"]:mtab==="work"?["作業内容","集計の対象","単価の単位"]:[MK[mtab].head]).map(csvCell2).join(",")].concat(ex.map(function(r){return r.map(csvCell2).join(",")})),"mMsg");
  });
  $("mCsvIn").addEventListener("change",async function(e){
    var f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f||!db)return;
    var rows; try{rows=parseCsv(await f.text())}catch(err){mflash("ファイルを読み込めませんでした。");return}
    if(rows.length>501){mflash("一度に取り込めるのは500行までです。");return}
    var first=String(rows[0]&&rows[0][0]||"").trim();
    if(first===(mtab==="area"?"地区名":MK[mtab].head)||first==="名前")rows=rows.slice(1);
    if(!rows.length){mflash("取り込める行がありません。1行目に項目名、2行目以降にデータを入れてください。");return}
    var inc=mClean(rows.map(function(r){return {name:r[0],loc:r[1],kind:r[1],unit:r[2]}}));
    if(inc.bad){mflash(inc.bad);return}
    var del=$("mCsvDel").checked, base=mtab==="area"?masters.areas:masters[MK[mtab].key], next, nk2=function(x){return mtab==="area"||mtab==="work"?x.name:x};
    if(del)next=inc.items;
    else{
      var idx={}; base.forEach(function(x,i){idx[nk2(x)]=i});
      next=base.slice();
      inc.items.forEach(function(x){
        var n=nk2(x);
        if(idx[n]==null){idx[n]=next.length;next.push(x)}
        else if(mtab==="work")next[idx[n]]=x;
        else if(mtab==="area"&&x.loc)next[idx[n]]={name:n,loc:x.loc};
      });
    }
    var c=mCompare(next);
    try{await mSave(next);mDirty=false;renderMaster(true);mFill(true);mflash("取り込みました(追加"+c.add+"件・変更"+c.chg+"件"+(del?"・削除"+c.del+"件":"")+")。")}
    catch(err){mflash("保存できませんでした。編集権限を確認してください。")}
  });

  /* ---------- CSV ---------- */
  var CSVH=["現場名","地区","住所","天気を調べる場所","担当班","出動基準(cm)","契約回数","単価(円)","単価の単位","メモ","引渡時間","平米数"];
  function csvCell2(v){v=String(v==null?"":v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
  function parseCsv(t){
    t=String(t||"").replace(/^\uFEFF/,"");
    var rows=[],row=[],f="",q=false,i=0;
    for(;i<t.length;i++){
      var c=t[i];
      if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
      else if(c==='"')q=true;
      else if(c===","){row.push(f);f=""}
      else if(c==="\n"||c==="\r"){if(c==="\r"&&t[i+1]==="\n")i++;row.push(f);f="";rows.push(row);row=[]}
      else f+=c;
    }
    if(f!==""||row.length){row.push(f);rows.push(row)}
    return rows.filter(function(r){return r.some(function(x){return String(x).trim()!==""})});
  }
  function csvSave(name,lines,msgId){
    if(!dl){flash(msgId,"この表示環境では保存できません。");return}
    dl.save({filename:name,data:"\uFEFF"+lines.join("\r\n")}).then(function(){flash(msgId,"保存しました。")},function(err){if(!err||err.code!=="declined")flash(msgId,"保存できませんでした。")});
  }
  $("csvOut").addEventListener("click",function(){
    var lines=[CSVH.map(csvCell2).join(",")];
    adminRows().forEach(function(s){
      var p=canAdmin?priceOf(s.id):null;
      lines.push([s.name,s.area||"",s.address||"",s.loc||"",s.crew||"",s.threshold||"",s.contractCount||"",p&&p.unitPrice>0?p.unitPrice:"",p&&p.unitPrice>0?p.unit:"",s.note||"",siteHands(s).map(function(h){return (h.label?h.label+" ":"")+h.time}).join(" / "),+s.sqm>0?s.sqm:""].map(csvCell2).join(","));
    });
    csvSave("現場一覧_"+todayStr()+".csv",lines,"csvMsg");
  });
  $("csvTpl").addEventListener("click",function(){
    csvSave("現場取り込み見本.csv",[CSVH.map(csvCell2).join(","),["○○団地 駐車場","駅前","盛岡市盛岡駅前北通1-1","39.7017,141.1363","A班",10,8,20000,"回","除雪機は倉庫横"].map(csvCell2).join(",")],"csvMsg");
  });
  $("csvIn").addEventListener("change",async function(e){
    var f=e.target.files&&e.target.files[0]; e.target.value=""; if(!f||!db)return;
    var rows;
    try{rows=parseCsv(await f.text())}catch(err){flash("csvMsg","ファイルを読み込めませんでした。");return}
    if(rows.length<2){flash("csvMsg","取り込める行がありません。1行目に項目名、2行目以降に現場を入れてください。");return}
    var hd=rows[0].map(function(x){return String(x).trim()}), ix={};
    CSVH.forEach(function(h){ix[h]=hd.indexOf(h)});
    if(ix["現場名"]<0){flash("csvMsg","「現場名」の列がありません。見本のCSVを確認してください。");return}
    if(rows.length>501){flash("csvMsg","一度に取り込めるのは500行までです。");return}
    var norm=function(x){return String(x||"").normalize("NFKC").replace(/\s/g,"")};
    var byName={}; sites.forEach(function(s){byName[norm(s.name)]=s});
    var add=0,upd=0,skip=0;
    $("csvIn").disabled=true; flash("csvMsg","取り込み中…");
    for(var r=1;r<rows.length;r++){
      var g=function(h){var i=ix[h];return i>=0?String(rows[r][i]==null?"":rows[r][i]).trim():""};
      var name=g("現場名"); if(!name){skip++;continue}
      var d={};
      if(g("地区"))d.area=g("地区"); if(g("住所"))d.address=g("住所"); if(g("担当班"))d.crew=g("担当班"); if(g("メモ"))d.note=g("メモ");
      if(g("天気を調べる場所")){d.loc=g("天気を調べる場所");d.locSrc="manual"}
      var th=parseInt(g("出動基準(cm)"),10); if(th>0)d.threshold=th;
      var sq=parseFloat(String(g("平米数")).normalize("NFKC").replace(/[,㎡m²\s]/g,"")); if(sq>0)d.sqm=Math.round(sq*100)/100;
      var hv=[]; String(g("引渡時間")).normalize("NFKC").split(/[\/,、;]+/).forEach(function(tok){var m=/^(.*?)(\d{1,2}):(\d{2})\s*$/.exec(tok.trim()); if(m&&+m[2]<24&&+m[3]<60)hv.push({label:m[1].trim(),time:("0"+m[2]).slice(-2)+":"+m[3]})});
      if(hv.length){d.handovers=hv.sort(function(x,y){return x.time.localeCompare(y.time)});d.handover=""}
      var ct=parseInt(g("契約回数"),10); if(ct>=0)d.contractCount=ct;
      var pr=parseInt(g("単価(円)"),10), un=g("単価の単位")==="時間"?"時間":(g("単価の単位")==="回"?"回":"");
      try{
        var ex=byName[norm(name)], sid;
        if(ex){
          sid=ex.id; var es=siteById(sid), lineSite=es&&Array.isArray(es.lines)&&es.lines.length, lineDone=false;
          if(lineSite&&(d.contractCount!=null||((pr>=0||un)&&canAdmin))){   // 行がある現場は、先頭の行に反映する
            var el=siteLines(es); if(d.contractCount!=null)el[0].count=d.contractCount; if(canAdmin){if(pr>=0)el[0].unitPrice=pr; if(un)el[0].unit=un}
            var sv=lineSave(el); d.lines=sv.site.lines; d.contractCount=sv.site.contractCount;
            if(canAdmin){if(sv.price)await db.doc("prices/"+sid).set(sv.price);else if(prices[sid])await db.doc("prices/"+sid).delete()}
            lineDone=true;
          }
          if(Object.keys(d).length)await db.doc("sites/"+sid).update(d); upd++;
        }
        else{
          var nd=Object.assign({name:name,area:"",address:"",loc:"",crew:"",note:"",threshold:settings.defaultTh||10,contractCount:0,createdAt:Date.now()+r},d);
          if(!nd.loc&&nd.address){var gg=geoFromAddress(nd.address);if(gg){nd.loc=gg.loc;nd.locSrc="city"}}
          var ref=await db.collection("sites").add(nd); sid=ref&&ref.id; add++;
          byName[norm(name)]={id:sid,name:name};
        }
        if(sid&&canAdmin&&(pr>=0||un)&&!(ex&&lineDone)){var old=prices[sid]||{unitPrice:0,unit:"回"};await db.doc("prices/"+sid).set({unitPrice:pr>=0?pr:old.unitPrice,unit:un||old.unit})}
      }catch(err){skip++}
    }
    $("csvIn").disabled=false;
    flash("csvMsg","取り込み完了:追加"+add+"件、更新"+upd+"件"+(skip?("、読み飛ばし"+skip+"件"):"")+"。");
  });

  /* ---------- 住所から位置 ---------- */
  /* 天気データは日本語の住所を場所として解決できないため、市町村の中心付近の座標(概算)を使う。 */
  var MUNI=[["盛岡市","39.7017,141.1363"],["滝沢市","39.7378,141.0757"],["矢巾町","39.5946,141.1349"],["紫波町","39.5518,141.1599"],["花巻市","39.3883,141.1167"],["北上市","39.2875,141.1131"],["八幡平市","39.9300,141.1000"],["奥州市","39.1436,141.1394"],["遠野市","39.3283,141.5333"],["一関市","38.9347,141.1264"],["雫石町","39.6900,140.9740"],["岩手町","39.9900,141.2300"],["葛巻町","40.0300,141.4400"],["金ケ崎町","39.1950,141.1280"],["平泉町","38.9890,141.1170"],["西和賀町","39.2800,140.7900"],["住田町","39.1350,141.5890"],["釜石市","39.2756,141.8856"],["大船渡市","39.0819,141.7089"],["陸前高田市","39.0153,141.6269"],["宮古市","39.6419,141.9570"],["久慈市","40.1903,141.7761"],["二戸市","40.2706,141.3046"],["一戸町","40.2060,141.3050"],["大槌町","39.3650,141.9060"],["山田町","39.4670,141.9470"],["岩泉町","39.8450,141.7960"],["青森市","40.8244,140.7400"],["八戸市","40.5123,141.4883"],["秋田市","39.7200,140.1000"],["仙台市","38.2682,140.8694"]];
  function geoFromAddress(addr){
    var a=String(addr||"").replace(/[\s　]/g,"").replace(/[ヶｹ]/g,"ケ"), best=null, pos=1e9;
    for(var i=0;i<MUNI.length;i++){
      var p=a.indexOf(MUNI[i][0]);
      if(p>=0&&p<pos){pos=p;best={name:MUNI[i][0],loc:MUNI[i][1]};}
    }
    return best;
  }
  function km(a,b){var p=a.split(",").map(Number),q=b.split(",").map(Number),r=Math.PI/180,x=(q[1]-p[1])*r*Math.cos((p[0]+q[0])/2*r),y=(q[0]-p[0])*r;return Math.sqrt(x*x+y*y)*6371}
  /* 国土地理院の住所検索で番地付近まで。失敗・不一致は市区町村中心(概算)に切り替える */
  async function geoLookup(addr){
    var city=geoFromAddress(addr), a=String(addr||"").replace(/[\s　]/g,"");
    try{
      var qs=[a]; if(!/^(北海道|東京都|大阪府|京都府|.{2,3}県)/.test(a))qs.push("岩手県"+a);
      for(var i=0;i<qs.length;i++){
        var ctl=new AbortController(), tm=setTimeout(function(){ctl.abort()},8000);
        var r=await fetch("https://msearch.gsi.go.jp/address-search/AddressSearch?q="+encodeURIComponent(qs[i]),{signal:ctl.signal}); clearTimeout(tm);
        if(!r.ok)continue; var j=await r.json();
        for(var k=0;k<Math.min(3,j.length);k++){
          var c=j[k]&&j[k].geometry&&j[k].geometry.coordinates; if(!c||c.length<2)continue;
          var loc=(+c[1]).toFixed(5)+","+(+c[0]).toFixed(5);
          if(city&&km(loc,city.loc)>20)continue;   /* 市区町村から大きく外れた候補は誤ヒットとして捨てる */
          return {loc:loc,src:"addr",name:(j[k].properties&&j[k].properties.title)||a};
        }
      }
    }catch(e){}
    return city?{loc:city.loc,src:"city",name:city.name}:null;
  }
  $("fGeo").addEventListener("click",async function(){
    var a=$("fAddr").value.trim();
    if(!a){$("fGeoMsg").textContent="先に住所を入力してください。";return}
    $("fGeoMsg").textContent="住所を調べています…";
    var g=await geoLookup(a);
    if(!g){$("fGeoMsg").textContent="住所から場所を判定できませんでした。「地図で確認」で場所を調べ、緯度・経度を入力してください。";return}
    $("fLoc").value=g.loc; geoLoc=g.loc; geoSrc=g.src;
    $("fGeoMsg").textContent=g.src==="addr"?"住所検索の結果「"+g.name+"」付近に設定しました。地図で位置を確認してください。":g.name+"の中心付近(概算)を設定しました。番地までは特定できませんでした。";
  });
  async function geoBulk(ids,msgId){
    if(!db||!ids.length)return;
    var ok=0,city=0,noAddr=0,noMatch=0,manual=0,n=0;
    for(var i=0;i<ids.length;i++){
      var s=siteById(ids[i]);
      if(!s)continue;
      if(!s.address){noAddr++;continue}
      if(s.locSrc==="manual"){manual++;continue}
      flash(msgId,"住所を調べています… "+(++n)+"/"+ids.length);
      var g=await geoLookup(s.address);
      if(!g){noMatch++;continue}
      try{await db.doc("sites/"+s.id).update({loc:g.loc,locSrc:g.src});if(g.src==="addr")ok++;else city++}catch(e){}
    }
    var t=ok+"件を住所から番地付近で設定しました。";
    if(city)t+=" "+city+"件は市区町村の中心(概算)です。";
    if(noAddr)t+=" 住所なし"+noAddr+"件。";
    if(noMatch)t+=" 判定できず"+noMatch+"件。";
    if(manual)t+=" 位置を直接指定済みの"+manual+"件は変更していません。";
    flash(msgId,t);
  }
  $("bGeo").addEventListener("click",async function(){
    $("bGeo").disabled=true; await geoBulk(selIds(),"bMsg"); $("bGeo").disabled=false;
  });
  window.__geoBulk=geoBulk;

  /* ---------- 起動 ---------- */
  async function resolveNames(){
    if(!user||!user.profiles)return;
    var need=[];
    reports.concat(notes,announcements).forEach(function(x){if(x.by&&!askedNames[x.by]){askedNames[x.by]=1;need.push(x.by)}});
    if(myId&&!askedNames[myId]){askedNames[myId]=1;need.push(myId)}
    if(!need.length)return;
    try{var p=await user.profiles(need);need.forEach(function(id){if(p&&p[id]&&p[id].name)nameMap[id]=p[id].name});render()}catch(e){}
  }
  $("today").textContent=new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"});
  initStats();
  doRender();

  (async function(){
    try{ if(window.claude&&claude.use){ user=await claude.use("user"); } }catch(e){}
    try{
      var w=user&&user.can?await user.can("data.write"):null;
      canStatus=(w!==false);
      canAdmin=!!(user&&user.canEdit&&await user.canEdit());
      myId=user&&user.id?await user.id():null;
      try{var mm=user&&user.me?await user.me():null;myName=mm&&mm.name||""}catch(e0){}
    }catch(e){}
    try{ db=await claude.use("db"); }catch(e){db=null}
    try{ mcp=await claude.use("mcp"); }catch(e){mcp=null}
    try{ assets=await claude.use("assets"); }catch(e){assets=null}
    try{ dl=await claude.use("downloads"); }catch(e){dl=null}
    try{ var pw=user&&user.can?await user.can("assets.write"):null; canPhoto=!!assets&&pw!==false; }catch(e){canPhoto=!!assets}
    mcpState=mcp?"ready":"none";
    if(!db){dbState="unavailable";render();}
    else{
      db.doc("masters/areas").onSnapshot(function(snap){
        var d=snap.exists?snap.data():{};
        masters.areas=Array.isArray(d.items)?d.items:[];
        fillLists(); render(); syncWx();
      },function(){});
      db.doc("masters/crews").onSnapshot(function(snap){
        var d=snap.exists?snap.data():{};
        masters.crews=Array.isArray(d.items)?d.items:[];
        fillLists(); render();
      },function(){});
      db.doc("masters/works").onSnapshot(function(snap){
        var d=snap.exists?snap.data():null;
        masters.works=d&&Array.isArray(d.items)?d.items.map(cleanWork).filter(function(w){return w.name}):DEFWORK.map(function(w){return Object.assign({},w)});
        fillLists(); render();
      },function(){});
      db.doc("masters/machines").onSnapshot(function(snap){
        var d=snap.exists?snap.data():null;
        masters.machines=d&&Array.isArray(d.items)?d.items:DEFMACH.slice();
        render();
      },function(){});
      db.collection("ops").onSnapshot(function(snap){
        ops={};
        snap.docs.forEach(function(d){ops[d.id]=d.data()});
        render();
      },function(){});
      db.collection("reports").orderBy("at","desc").limit(1000).onSnapshot(function(snap){
        reports=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        render(); resolveNames();
      },function(){});
      db.collection("notes").orderBy("at","desc").limit(300).onSnapshot(function(snap){
        notes=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        render(); resolveNames();
      },function(){});
      db.collection("sphotos").orderBy("at","desc").limit(1000).onSnapshot(function(snap){
        sphotos=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        render();
      },function(){});
      db.collection("announcements").orderBy("at","desc").limit(100).onSnapshot(function(snap){
        if(!annFirst&&snap.docChanges){snap.docChanges().forEach(function(c){var o=c.doc.data();if(c.type==="added"&&o.by!==myId)toast("新しいお知らせ:"+o.title)})}
        annFirst=false;
        announcements=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        render(); resolveNames();
      },function(){});
      if(myId)db.doc("data/users/"+myId+"/state").onSnapshot(function(snap){
        var v=snap.exists&&snap.data().read||{}, l={};try{l=JSON.parse(localStorage.getItem("josetsu.read")||"{}")}catch(e){}
        readMap=Object.assign({},l,v); render();
      },function(){});
      db.collection("access").onSnapshot(function(snap){
        access={};snap.docs.forEach(function(d){access[d.id]=d.data()});accessLoaded=true;checkGate();
      },function(){});
      if(canAdmin)db.collection("members").onSnapshot(function(snap){
        members=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        if(sub==="members")renderMembers();
      },function(){});
      if(canAdmin)db.collection("prices").onSnapshot(function(snap){
        prices={};
        snap.docs.forEach(function(d){prices[d.id]=d.data()});
        render();
      },function(){});
      db.doc("settings/main").onSnapshot(function(snap){
        settings=Object.assign({},DEF,snap.exists?snap.data():{});
        if(window.__applyBrand)window.__applyBrand(settings.brand||{},true);
        fillSettings(); schedule(); render(); checkGate();
      },function(){});
      var first=true;
      db.collection("sites").onSnapshot(function(snap){
        sites=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});
        dbState="ready"; fillLists();
        render();
        if(mcp){
          var need=sites.filter(function(s){return !wx[s.id]||wx[s.id].loc!==effLoc(s)});
          if(first||need.length){
            first=false;
            if(need.length===sites.length)refreshAll(false);
            else need.forEach(function(s){loadOne(s,false)});
          }
        }
      },function(){dbState="unavailable";render()});
    }
    render();
    schedule();
  })();
})();
</script>
