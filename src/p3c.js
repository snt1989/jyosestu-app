
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
        await db.collection("reports").add(data);
        if($("rfDone").checked&&s){try{await db.doc("ops/"+sid).set({status:"done",statusAt:Date.now()})}catch(e2){}}
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
    $("lbImg").dataset.pid=p.id; $("lbImg").src=blobUrl(p.id);
    $("lbCap").textContent=(p.kind?(KIND[p.kind]||"写真"):(p.at?fmtDT(p.at):"案件の写真"))+"  "+(lb.i+1)+" / "+lb.list.length;
    $("lb").querySelector(".pv").hidden=lb.list.length<2; $("lb").querySelector(".nx").hidden=lb.list.length<2;
  }
  function openLb(group,i){
    var list=[];
    if(group==="form")list=rf?rf.photos:[];
    else if(group==="detail")list=detailPhotos;
    else if(group==="site")list=sitePh;
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
      await db.collection("notes").add({siteId:sid,siteName:s?s.name:"",text:text,by:myId||"",at:Date.now()});
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
      var o=by[k]||(by[k]={id:r.siteId,name:r.siteName||"",n:0,h:0,hai:0,noTime:0});
      var hr=hoursOf(r);
      o.n++; if(hr==null)o.noTime++; else o.h+=hr;
      if(r.haisetsu)o.hai++;
    });
    var tot={n:0,h:0,hai:0,amt:0,noPrice:0,noTime:0};
    Object.keys(by).forEach(function(k){
      var o=by[k], s=o.id?siteById(o.id):null;
      if(s)o.name=s.name;
      o.area=s?s.area||"":""; var pz=canAdmin&&s?priceOf(s.id):null; o.price=pz&&pz.unitPrice>0?+pz.unitPrice:0; o.unit=pz&&pz.unit==="時間"?"時間":"回"; o.contract=s?(+s.contractCount||0):0;
      o.amt=o.price?(o.unit==="時間"?o.price*o.h:o.price*o.n):null;
      if(o.amt==null&&canAdmin)tot.noPrice++; else tot.amt+=o.amt;
      if(o.price&&o.unit==="時間")tot.noTime+=o.noTime;
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
