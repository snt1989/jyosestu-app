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
  var sites=[], wx={}, ops={}, reports=[], notes=[], sphotos=[], settings=Object.assign({},DEF), sel={};
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
  function handText(s,short){return siteHands(s).map(function(h){return (h.label&&!short?h.label+" ":"")+h.time}).join(" ・ ")}
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
  var CLOUD="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.2 4.4 4.4 0 0 1 17.4 18H7z";
  function icon(w){
    var c=cat(w), p="";
    var S='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    if(c==="sun")p='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    else if(c==="partly")p='<circle cx="8" cy="8" r="3"/><path d="M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7"/><path d="M9 20a3.5 3.5 0 0 1-.4-6.98A5 5 0 0 1 18 13.3 3.4 3.4 0 0 1 18 20H9z"/>';
    else if(c==="rain")p='<path d="'+CLOUD.replace("18","15").replace("17.4 18","17.4 15")+'"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>';
    else if(c==="snow")p='<path d="M7 15a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 6.2 4.4 4.4 0 0 1 17.4 15H7z"/><path d="M8 18v3M6.5 19.5h3M12 18v3M10.5 19.5h3M16 18v3M14.5 19.5h3"/>';
    else if(c==="sleet")p='<path d="M7 15a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 6.2 4.4 4.4 0 0 1 17.4 15H7z"/><path d="M8 18l-1 3M12 18v3M16 18l-1 3"/>';
    else if(c==="fog")p='<path d="M4 9h16M3 13h18M5 17h14"/>';
    else if(c==="storm")p='<path d="M7 15a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 6.2 4.4 4.4 0 0 1 17.4 15H7z"/><path d="M12 14l-2 4h3l-2 4"/>';
    else p='<path d="'+CLOUD+'"/>';
    return S+p+'</svg>';
  }

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
    return {lv:lv,label:lv===3?"出動目安":lv===2?"警戒":"平常",snow2:snow2,ice:ice,snowing:snowing,th:th};
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
