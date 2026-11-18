<script>
(function(){
  "use strict";
  var XW = "Vaisala Xweather";
  var STALE = 300000;
  var $ = function(id){return document.getElementById(id)};
  var db=null, mcp=null, user=null, assets=null, dl=null;
  var DEF={defaultTh:10,iceTemp:0,mult:1,refreshMin:10,requireLogin:false};
  var access={}, accessLoaded=false, myName="";
  function blobUrl(id){return window.__blobUrl?window.__blobUrl(id):"/_blob/"+id}
  var DEFMACH=["手作業","自走式","軽トラ","ローダ"];
  var RAW={sites:[],ops:{},reports:[],notes:[],chat:[],sphotos:[],ann:[]};
  var sites=[], wx={}, ops={}, reports=[], notes=[], chat=[], sphotos=[], settings=Object.assign({},DEF), sel={};
  var view="home", filter="all", query="", areaF="", sub="sites", editingId=null;
  var canStatus=true, canAdmin=false, canPhoto=false, myId=null;
  var dbState="loading", busy={}, lastAt=0, mcpState="loading", lastAreaKey="";
  var DEFWORK=[{name:"除雪",kind:"joset",unit:"回"},{name:"排雪",kind:"hai",unit:"回"}];
  var masters={areas:[],crews:[],machines:DEFMACH.slice(),works:DEFWORK.map(function(w){return Object.assign({},w)})};
  var nameMap={}, askedNames={}, prices={};
  function priceOf(id){return prices[id]||null}
  // 契約・金額は「作業内容ごとの行」。sites.lines=[{work,kind,count}] と prices/{id}.lines=[{unitPrice,unit}] を同じ並びで持つ(単価は管理者のみ)。
  // 行がない現場は、従来の契約回数・単価(1組)をそのまま1行として扱う。
  var LKIND={all:"すべての日報",joset:"除雪(排雪なしの日報)",hai:"排雪(排雪ありの日報)",other:"その他(自動集計しない)"};
  var LSHORT={all:"全体",joset:"除雪",hai:"排雪",other:"その他"};
  function siteLines(s){
    if(!s)return [];
    var pz=canAdmin?priceOf(s.id):null;
    if(Array.isArray(s.lines)&&s.lines.length){
      return s.lines.map(function(l,i){
        var p=pz&&Array.isArray(pz.lines)?pz.lines[i]:null;
        return {work:l.work||"",kind:LKIND[l.kind]?l.kind:"all",count:+l.count||0,unitPrice:p&&+p.unitPrice>0?+p.unitPrice:0,unit:p&&p.unit==="時間"?"時間":"回"};
      });
    }
    var ct=+s.contractCount||0, up=pz&&pz.unitPrice>0?+pz.unitPrice:0;
    return (ct>0||up>0)?[{work:"",kind:"all",count:ct,unitPrice:up,unit:pz&&pz.unit==="時間"?"時間":"回"}]:[];
  }
  // 引渡時間(複数)。旧データ(handover 1件)も読めるようにする
  function siteHands(s){
    var a=Array.isArray(s.handovers)?s.handovers:(s.handover?[{label:"",time:s.handover}]:[]);
    return a.filter(function(h){return h&&/^\d{1,2}:\d{2}$/.test(h.time||"")}).map(function(h){return {label:String(h.label||""),time:("0"+h.time).slice(-5)}})
      .sort(function(x,y){return x.time.localeCompare(y.time)});
  }
  function sqmText(s){var v=+s.sqm;return v>0?v.toLocaleString("ja-JP",{maximumFractionDigits:2})+" ㎡":""}
  function handText(s,short){return siteHands(s).map(function(h){return (h.label&&!short?h.label+" ":"")+h.time}).join("　")}
  function lineLabel(l){return l.work||LSHORT[l.kind]||""}
  function lineMatch(kind,r){return kind==="all"?true:kind==="joset"?!r.haisetsu:kind==="hai"?!!r.haisetsu:false}
  // 行の一覧から、保存用のデータ(現場側・単価側)を作る
  function lineSave(ls){
    var site={lines:ls.map(function(l){return {work:l.work,kind:l.kind,count:l.count}}),contractCount:ls.reduce(function(a,l){return a+(l.count||0)},0)};
    var fp=ls.filter(function(l){return l.unitPrice>0})[0];
    var price=fp?{unitPrice:fp.unitPrice,unit:fp.unit,lines:ls.map(function(l){return {unitPrice:l.unitPrice>0?l.unitPrice:0,unit:l.unit==="時間"?"時間":"回"}})}:null;
    return {site:site,price:price};
  }
  var detailId=null, rf=null, lb={list:[],i:0}, repFilter={period:"7d",site:""}, ntF="all";
  var stS={mode:"month",y:0,m:0,sy:0};
  function stOf(s){var o=ops[s.id];return (o&&o.status)||"standby"}
  function stAt(s){var o=ops[s.id];return (o&&o.statusAt)||0}
  function areaLoc(name){var a=masters.areas.filter(function(x){return x.name===name})[0];return a&&a.loc?a.loc:""}
  function effLoc(s){return (s.loc&&String(s.loc).trim())||areaLoc(s.area)||""}
  /* 管理者以外は、自分の担当班の現場(とその日報・連絡・状況・写真)だけを扱う */
  function siteCrews(s){return String(s&&s.crew||"").split(/[、,，]/).map(function(x){return x.trim()}).filter(Boolean)}
  function myCrewName(){var m=access[myId];return m&&m.crew?String(m.crew).trim():""}
  function myCrews(){return String(myCrewName()).split(/[、,，]/).map(function(x){return x.trim()}).filter(Boolean)}
  function chatVisible(m){return !m.room||m.room==="all"||canAdmin||myCrews().indexOf(m.room)>=0}
  function applyScope(){
    var c=myCrewName(), vs={};
    sites=RAW.sites.filter(function(s){var v=canAdmin||(c&&siteCrews(s).indexOf(c)>=0);if(v)vs[s.id]=1;return v});
    ops={};Object.keys(RAW.ops).forEach(function(k){if(canAdmin||vs[k])ops[k]=RAW.ops[k]});
    reports=RAW.reports.filter(function(r){return canAdmin||vs[r.siteId]});
    notes=RAW.notes.filter(function(n){return canAdmin||!n.siteId||vs[n.siteId]});
    chat=RAW.chat.filter(function(m){return chatVisible(m)});
    sphotos=RAW.sphotos.filter(function(x){return canAdmin||vs[x.siteId]});
    announcements=RAW.ann.filter(annVisible);
  }
  function annVisible(x){var c=x&&x.crews;return canAdmin||!Array.isArray(c)||!c.length||c.indexOf(myCrewName())>=0}
  function siteById(id){return sites.filter(function(x){return x.id===id})[0]}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function num(v){return typeof v==="number"&&isFinite(v)?v:null}
  function fmt(v,d){return v==null?"–":(Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d)}
  function ms(kph){return kph==null?null:kph/3.6}

  /* ---------- 天候表示 ---------- */
  function cat(w){
    w=String(w||"").toLowerCase();
    if(/thunder|storm/.test(w))return "storm";
    if(/snow|flurr/.test(w))return "snow";
    if(/sleet|wintry|freezing|ice/.test(w))return "sleet";
    if(/rain|shower|drizzle/.test(w))return "rain";
    if(/fog|mist|haze|smoke/.test(w))return "fog";
    if(/partly|mostly sunny|mostly clear|fair/.test(w))return "partly";
    if(/cloud|overcast/.test(w))return "cloud";
    if(/sunny|clear/.test(w))return "sun";
    return "cloud";
  }
  function jp(w){
    var s=String(w||"").toLowerCase();
    if(!s)return "–";
    if(/thunder/.test(s))return "雷雨";
    if(/snow|flurr/.test(s))return /shower/.test(s)?"雪(にわか)":"雪";
    if(/sleet|wintry|freezing/.test(s))return "みぞれ・凍雨";
    if(/rain|shower|drizzle/.test(s))return "雨";
    if(/fog|mist|haze/.test(s))return "霧";
    if(/partly cloudy|partly sunny/.test(s))return "晴れ時々くもり";
    if(/mostly cloudy/.test(s))return "おおむねくもり";
    if(/mostly sunny|mostly clear/.test(s))return "おおむね晴れ";
    if(/cloud|overcast/.test(s))return "くもり";
    if(/sunny|clear|fair/.test(s))return "晴れ";
    return "その他";
  }
  function jpAlert(x){
    var raw=String((x&&((x.details&&x.details.name)||x.title||x.name||x.type))||"");
    if(/[^\x00-\x7F]/.test(raw))return raw;
    var t=raw.toLowerCase();
    var kind=/fire weather|red flag/.test(t)?"乾燥・火災気象":/blizzard|winter storm|snow/.test(t)?"大雪":/ice|freez|frost|wintry|sleet/.test(t)?"凍結・着氷":/wind|gale/.test(t)?"強風":/flood|rain/.test(t)?"大雨・洪水":/thunder|lightning/.test(t)?"雷":/fog|visibility/.test(t)?"濃霧":/heat/.test(t)?"高温":/cold|chill/.test(t)?"低温":/avalanche/.test(t)?"雪崩":"";
    var lv=/warning/.test(t)?"警報":/watch|advisory|statement|alert/.test(t)?"注意報":"";
    if(!kind&&!lv)return "気象警報・注意報";
    return (kind||"気象")+(lv?" "+lv:"");
  }
  var CLD="M7.5 19a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 18 11.2 4 4 0 0 1 17.5 19z";
  var CLU="M7.5 15.5a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 18 7.7 4 4 0 0 1 17.5 15.5z";
  function sunRays(cx,cy,r1,r2,n,w){
    var o="";
    for(var i=0;i<n;i++){var t=i*Math.PI*2/n,c=Math.cos(t),s=Math.sin(t);o+='M'+(cx+c*r1).toFixed(1)+' '+(cy+s*r1).toFixed(1)+'L'+(cx+c*r2).toFixed(1)+' '+(cy+s*r2).toFixed(1)}
    return '<path d="'+o+'" stroke="#F2A900" stroke-width="'+w+'" stroke-linecap="round"/>';
  }
  function icon(w){
    var c=cat(w), p="";
    var S='<svg viewBox="0 0 24 24" aria-hidden="true">';
    var cloud=function(d,col){return '<path d="'+d+'" fill="'+col+'"/>'};
    var drops=function(xs,y){return xs.map(function(x){return '<path d="M'+x+' '+y+'l-1.2 3.2" stroke="#2F7FD1" stroke-width="2" stroke-linecap="round"/>'}).join("")};
    var flake=function(x,y){return '<path d="M'+x+' '+(y-1.6)+'v3.2M'+(x-1.6)+' '+y+'h3.2M'+(x-1.1)+' '+(y-1.1)+'l2.2 2.2M'+(x+1.1)+' '+(y-1.1)+'l-2.2 2.2" stroke="#3E97E8" stroke-width="1.1" stroke-linecap="round"/>'};
    if(c==="sun")p='<circle cx="12" cy="12" r="4.6" fill="#F2A900"/>'+sunRays(12,12,7.4,10.2,8,2);
    else if(c==="partly")p='<circle cx="9" cy="9" r="3.6" fill="#F2A900"/>'+sunRays(9,9,6,8.2,8,1.6)+cloud("M9.5 20.5a3.8 3.8 0 0 1-.7-7.5A5.2 5.2 0 0 1 18.8 14 3.3 3.3 0 0 1 18.4 20.5z","#9DB0C4");
    else if(c==="rain")p=cloud(CLU,"#8FA3B8")+drops([8,12.5,17],17.6);
    else if(c==="snow")p=cloud(CLU,"#B4C4D6")+'<rect x="0" y="0" width="0" height="0"/>'+flake(8,19.2)+flake(12.5,21)+flake(17,19.2);
    else if(c==="sleet")p=cloud(CLU,"#9DB0C4")+drops([8,17],17.6)+flake(12.5,19.6);
    else if(c==="fog")p='<path d="M4 8h16M3 12h18M5 16h14M8 20h8" stroke="#9DB0C4" stroke-width="2.2" stroke-linecap="round"/>';
    else if(c==="storm")p=cloud(CLU,"#6C7B8E")+'<path d="M12.8 14.5l-3 4.6h2.6l-1.4 3.9 4.2-5.4h-2.6z" fill="#F2A900"/>';
    else p=cloud(CLD,"#9DB0C4");
    return S+p+'</svg>';
  }
  function jpS(w){return jp(w).replace("晴れ時々くもり","晴れ時々曇り").replace("おおむね","").replace("くもり","曇り").replace("みぞれ・凍雨","みぞれ").replace("雪(にわか)","にわか雪")}

  /* ---------- 判定 ---------- */
  function snowEst(f){
    var p=num(f.precipMM), mn=num(f.minTempC);
    if(p==null||p<=0||mn==null||mn>2)return 0;
    var r=mn<=-2?1.5:(mn<=1?1:0.5);
    var k=+settings.mult>0?+settings.mult:1;
    return p*r*k;
  }
  function snowLabel(v){return v<=0?"なし":(v<1?"1cm未満":"約"+Math.round(v)+"cm")}
  function assess(s){
    var w=wx[s.id];
    if(!w||w.state!=="ok")return {lv:0,label:w&&w.state==="err"?"取得失敗":w&&w.state==="noloc"?"場所未設定":"取得中",snow2:0,ice:false,snowing:false};
    var cur=w.cur||{}, fc=w.fc||[], al=w.alerts||[];
    var snow2=0, ice=false;
    for(var i=0;i<fc.length&&i<2;i++){snow2+=snowEst(fc[i]); var m=num(fc[i].minTempC); var it=num(+settings.iceTemp); if(m!=null&&m<=(it==null?0:it))ice=true;}
    var snowing=(num(cur.snowCM)||0)>0||cat(cur.weather)==="snow"||cat(cur.weather)==="sleet";
    var th=num(s.threshold)||10, lv=1;
    if(snow2>=th||(al.length>0&&snow2>0))lv=3;
    else if(snowing||snow2>0||al.length>0||ice)lv=2;
    return {lv:lv,label:lv===3?"出動目安":lv===2?"警戒":"平常",snow2:snow2,ice:ice,snowing:snowing,th:th,depth:depthOf(s,cur)};
  }
  /* 積雪(いま積もっている量): 3日以内の日報の実測を優先し、なければ観測値 */
  function depthOf(s,cur){
    var lim=new Date(Date.now()-3*864e5), ds=lim.getFullYear()+"-"+("0"+(lim.getMonth()+1)).slice(-2)+"-"+("0"+lim.getDate()).slice(-2), best=null;
    reports.forEach(function(r){
      if(r.siteId!==s.id||r.date<ds)return;
      var v=parseFloat(r.snowCm); if(!isFinite(v))return;
      if(!best||String(r.date+(r.start||""))>String(best.k))best={k:r.date+(r.start||""),v:v,date:r.date};
    });
    if(best)return {v:best.v,src:"日報 "+(+best.date.slice(5,7))+"/"+(+best.date.slice(8,10))+" の実測"};
    var o=num(cur&&cur.snowDepthCM);
    if(o!=null&&o>=0)return {v:o,src:"気象観測"};
    return null;
  }

  /* ---------- 天気取得 ---------- */
  function sleep(t){return new Promise(function(r){setTimeout(r,t)})}
  function errText(e){
    var c=e&&e.code;
    if(c==="not_in_manifest"||c==="consent_required")return "この画面での天気データの利用が許可されていません。ページの権限設定で気象コネクタを許可してください。";
    if(c==="server_not_connected"||c==="server_not_found")return "気象コネクタが接続されていません。claude.aiの設定 → コネクタで追加してください。";
    if(c==="needs_reauth")return "気象コネクタの認証が切れています。claude.aiの設定 → コネクタで再接続してください。";
    if(c==="approval_required")return "天気の取得に承認が必要です。「天気を更新」を押して許可してください。";
    if(c==="blocked_by_policy")return "組織の設定により気象コネクタは利用できません。";
    if(c==="tool_error")return "場所を特定できないか、天気データを返せませんでした。「天気を調べる場所」を確認してください。";
    return "天気を取得できませんでした。しばらくしてからもう一度お試しください。";
  }
  async function call(tool,input,force,retry){
    var opt={cache:force?{staleTime:STALE,refresh:true}:{staleTime:STALE}};
    try{return await mcp.callTool(XW,tool,input,opt);}
    catch(e){
      if(!retry&&e&&e.retryable){await sleep(Math.min(e.retryAfterMs||1500,5000)+Math.random()*500);return call(tool,input,force,true);}
      throw e;
    }
  }
  function pl(r){var p=r&&r.payload; if(typeof p==="string"){try{p=JSON.parse(p)}catch(e){p=null}} return p||{}}
  async function loadOne(s,force){
    if(!mcp)return;
    var key=s.id, loc=effLoc(s);
    if(!loc){wx[key]={state:"noloc",loc:""};render();return}
    wx[key]=Object.assign({},wx[key],{state:(wx[key]&&wx[key].state==="ok")?"ok":"loading",loc:loc});
    render();
    try{
      var res=await Promise.all([
        call("xweather_get_current_weather",{location:loc},force),
        call("xweather_get_forecast_weather",{location:loc,forecast_filter:"day",limit:4,fields:["datetime_local","max_temp_c","min_temp_c","precip_mm","precip_probability_percent","max_wind_speed_kph","weather_primary"]},force)
      ]);
      var c=pl(res[0]), f=pl(res[1]);
      var at=(res[0].cache&&res[0].cache.storedAt)||Date.now();
      wx[key]={state:"ok",loc:loc,cur:c.weather||{},alerts:Array.isArray(c.alerts)?c.alerts:[],fc:Array.isArray(f.forecasts)?f.forecasts:[],at:at};
      if(at>lastAt)lastAt=at;
      try{urgentCheck(s)}catch(e9){}
    }catch(e){
      wx[key]={state:"err",loc:loc,err:errText(e),code:e&&e.code};
      if(e&&(e.code==="not_in_manifest"||e.code==="server_not_connected"||e.code==="needs_reauth"))mcpState=e.code;
    }
    render();
  }
  var running=false;
  async function refreshAll(force){
    if(!mcp||running)return;
    running=true; $("btnRefresh").disabled=true;
    try{
      var list=sites.slice();
      if(list.length){
        await loadOne(list[0],force);
        var i=1;
        var worker=async function(){while(i<list.length){var s=list[i++];await loadOne(s,force);}};
        await Promise.all([worker(),worker(),worker()]);
      }
    }finally{running=false;$("btnRefresh").disabled=false;render();}
  }
