'use strict';
(() => {
  const groups = window.PLAYBOOK_DATA;
  const allItems = groups.flatMap(group => group.items.map(item => ({...item, groupId:group.id, groupTitle:group.title})));
  const byId = new Map(allItems.map(item => [item.id, item]));
  const $ = id => document.getElementById(id);
  const STORAGE = 'magician-pocket-v1:';
  const formIds = ['qPackage','qDuration','qDate','qPlace','qTravel','qHotel','qLocal','qTime','qExtra','qDiscount','qNote','qTravelMode','qCap','qDeposit'];
  const packages = {
    harry:{name:'哈利波特主题套餐',price:180000,duration:'30 分钟'},
    close:{name:'精品近景魔术',price:100000,duration:'时长及场次待双方确认'},
    interactive:{name:'互动魔术',price:30000,duration:'10 分钟'}
  };
  const extraFields = [['qTravel','往返交通'],['qHotel','必要住宿'],['qLocal','当地接驳'],['qTime','路途占时补贴'],['qExtra','已协商加项']];
  let toastTimer, currentGroup, query = '', quoteText = '', offlineReady = false, storageWarned = false;
  function read(key,fallback){try{const raw=localStorage.getItem(STORAGE+key);return raw?JSON.parse(raw):fallback;}catch(error){return fallback;}}
  function save(key,value){try{localStorage.setItem(STORAGE+key,JSON.stringify(value));return true;}catch(error){if(!storageWarned){notify('本机存储不可用，收藏或草稿暂时无法保存。');storageWarned=true;}return false;}}
  const storedFavorites=read('favorites',[]);
  const favorites=new Set((Array.isArray(storedFavorites)?storedFavorites:[]).filter(id=>byId.has(id)));
  function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#i-'+name);svg.append(use);return svg;}
  function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
  function showDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();document.body.classList.add('modal-open');}
  function closeDialog(id){$(id).close();}
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');}));
  async function copy(text){
    if(!text)return;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);notify('已复制，发送前替换【括号】里的内容。');return;}}catch(error){}
    const area=node('textarea');area.value=text;area.readOnly=true;area.style.cssText='position:fixed;top:0;left:0;width:2px;height:2px;opacity:.01;font-size:16px';(document.querySelector('dialog[open]')||document.body).append(area);area.focus();area.select();area.setSelectionRange(0,text.length);let copied=false;try{copied=document.execCommand('copy');}catch(error){}area.remove();
    if(copied){notify('已复制，发送前请核对内容。');return;}
    showText(text,'长按复制正文','浏览器没有允许自动复制。请长按下方文字，选择“全选 → 复制”。');
  }
  function showText(text,title='报价正文',hint='发送前检查金额，并替换【括号】内的内容。'){$('textTitle').textContent=title;$('textHint').textContent=hint;$('textPreview').value=text;showDialog('textDialog');}
  function favoriteButton(item){const button=node('button','small-action favorite-action');button.dataset.favorite=item.id;updateFavoriteButton(button);button.addEventListener('click',()=>toggleFavorite(item.id));return button;}
  function updateFavoriteButton(button){const saved=favorites.has(button.dataset.favorite);button.classList.toggle('saved',saved);button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'取消收藏：':'收藏：')+byId.get(button.dataset.favorite).title);button.replaceChildren(icon('star'),document.createTextNode(saved?'已收藏':'收藏'));}
  function toggleFavorite(id){const next=new Set(favorites);if(next.has(id))next.delete(id);else next.add(id);if(!save('favorites',[...next]))return;favorites.clear();next.forEach(key=>favorites.add(key));document.querySelectorAll('[data-favorite]').forEach(updateFavoriteButton);renderFavorites();notify(favorites.has(id)?'已加入常用收藏':'已取消收藏');}
  function copyButton(item){const button=node('button','small-action copy-action');button.append(icon('copy'),document.createTextNode('复制话术'));button.setAttribute('aria-label','复制：'+item.title);button.addEventListener('click',()=>copy(item.text));return button;}
  function renderDirectory(){const area=$('directory');area.replaceChildren();groups.forEach((group,index)=>{const button=node('button','category-button');button.style.setProperty('--accent',group.color);button.style.setProperty('--tint',group.tint);button.append(node('span','category-number',String(index+1).padStart(2,'0')));const main=node('span','category-main');main.append(node('span','category-title',group.title),node('span','category-subtitle',group.preview.join(' · ')));button.append(main,node('span','category-count',group.items.length+' 条'),icon('next'));button.addEventListener('click',()=>openGroup(group.id));area.append(button);});$('libraryCount').textContent=groups.length+' 类 · '+allItems.length+' 条';}
  function resultCard(item){const card=node('article','result-card');const button=node('button','result-open');button.append(node('span','result-meta',item.groupTitle+' / '+item.tag),node('span','result-title',item.title),node('span','result-preview',item.text));button.addEventListener('click',()=>openGroup(item.groupId,item.id));const actions=node('div','result-actions');actions.append(favoriteButton(item),copyButton(item));card.append(button,actions);return card;}
  function empty(title,description,link){const area=node('div','empty');area.append(node('div','empty-symbol','✧'),node('strong','',title),node('p','',description));if(link){const a=node('a','','去话术库看看');a.href='#library';area.append(a);}return area;}
  function searchItems(text){const q=text.trim().toLowerCase();return allItems.filter(item=>[item.title,item.text,item.note,item.tag,item.groupTitle].join(' ').toLowerCase().includes(q));}
  function renderSearch(){query=$('searchInput').value.trim();$('libraryOverview').hidden=!!query;$('searchArea').hidden=!query;$('clearSearch').hidden=!query;if(!query)return;const results=searchItems(query);$('searchCount').textContent=results.length+' 条';const area=$('searchResults');area.replaceChildren(...results.map(resultCard));if(!results.length)area.append(empty('暂时没有找到','试试“外地”“便宜”“原创”或“预付款”。'));}
  function renderFavorites(){const items=[...favorites].reverse().map(id=>byId.get(id)).filter(Boolean);$('favoriteCount').textContent=items.length+' 条';const area=$('favoritesList');area.replaceChildren(...items.map(resultCard));if(!items.length)area.append(empty('把最常用的几句放在这里','在任意话术下点“收藏”，下次就能直接找到。',true));}
  function openGroup(groupId,itemId){const group=groups.find(group=>group.id===groupId);if(!group)return;currentGroup=groupId;$('sheetKicker').textContent=group.items.length+' 条话术 · 点击标题展开';$('sheetTitle').textContent=group.title;$('sheetDescription').textContent=group.description;const area=$('sheetScripts');area.replaceChildren();group.items.forEach((original,index)=>{const item=byId.get(original.id);const details=node('details','script-card');details.id='script-'+item.id;details.open=itemId?item.id===itemId:index===0;const summary=node('summary','',item.title);summary.append(node('small','',item.tag));const body=node('div','script-body');body.append(node('p','spoken',item.text));const coach=node('p','coach');coach.append(node('b','','接单提示 · '),document.createTextNode(item.note));body.append(coach);const actions=node('div','script-actions');actions.append(favoriteButton(item),copyButton(item));body.append(actions);details.append(summary,body);details.addEventListener('toggle',updateExpandLabel);area.append(details);});showDialog('scriptsDialog');updateExpandLabel();const scrollArea=$('scriptsDialog').querySelector('.sheet-body');scrollArea.scrollTop=0;if(itemId)requestAnimationFrame(()=>document.getElementById('script-'+itemId).scrollIntoView({block:'start'}));}
  function updateExpandLabel(){const cards=[...$('sheetScripts').querySelectorAll('details')];const expanded=cards.length&&cards.every(card=>card.open);$('expandAll').textContent=expanded?'全收起':'全展开';$('expandAll').setAttribute('aria-expanded',String(!!expanded));}
  function route(){let page=location.hash.slice(1);if(!['library','favorites','quote'].includes(page))page='library';document.querySelectorAll('.page').forEach(section=>section.hidden=section.id!==page+'Page');document.querySelectorAll('[data-tab]').forEach(tab=>{const active=tab.dataset.tab===page;tab.classList.toggle('active',active);if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');});document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());if(page==='favorites')renderFavorites();window.scrollTo(0,0);}
  function parseMoney(value){const s=String(value??'').trim();if(s==='')return 0;if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(s))return null;const [whole,fraction='']=s.split('.');return Number(whole)*100+Number((fraction+'00').slice(0,2));}
  function money(cents){return (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:2});}
  function calculate(values){
    const p=packages[values.qPackage]||packages.harry;
    const extras=extraFields.map(([id,label])=>({id,label,cents:parseMoney(values[id])}));
    const discount=parseMoney(values.qDiscount);
    const rateString=String(values.qDeposit??'').trim();
    const rate=rateString===''?0:Number(rateString);
    if(extras.some(item=>item.cents===null)||discount===null)return {error:'费用请填 0 以上的数字，最多保留两位小数。'};
    if(!/^\d{0,3}$/.test(rateString)||rate>100)return {error:'预付款比例请填 0–100 的整数。'};
    const total=p.price+extras.reduce((sum,item)=>sum+item.cents,0)-discount;
    if(total<0)return {error:'优惠不能超过套餐费与加项费用的合计。'};
    const travelTotal=extras.slice(0,3).reduce((sum,item)=>sum+item.cents,0);
    let travelTerms='差旅按本次确认的明细固定金额结算。';
    if(values.qTravelMode==='estimate'){
      const cap=parseMoney(values.qCap);
      if(!String(values.qCap||'').trim()||cap===null||cap<travelTotal)return {error:'请填写交通、住宿和接驳费用上限，且不低于这三项预估合计。'};
      travelTerms=`交通、住宿及接驳预估 ${money(travelTotal)} 元，按实际费用和凭证结算，上限 ${money(cap)} 元；超出上限先征得同意。路途占时补贴与其他加项按明细约定。`;
    }
    const prepay=Math.round(total*rate/100),balance=total-prepay;
    const duration=values.qPackage==='close'?(String(values.qDuration||'').trim()||p.duration):p.duration;
    const lines=[`演出费：${money(p.price)} 元`,...extras.filter(item=>item.cents>0).map(item=>`${item.label}：${money(item.cents)} 元`)];
    if(discount>0)lines.push(`协商优惠：−${money(discount)} 元`);
    const note=String(values.qNote||'').trim();
    const needNote=(extras.find(item=>item.id==='qExtra').cents>0||discount>0)&&!note;
    const text=`您好，给您确认本次魔术演出报价：\n\n日期 / 时段：${String(values.qDate||'').trim()||'【活动日期与时段】'}\n地点：${String(values.qPlace||'').trim()||'【城市与具体地址】'}\n套餐：${p.name}\n时长 / 场次：${duration}\n\n${lines.join('\n')}\n${values.qTravelMode==='estimate'?'预估':''}合计：${money(total)} 元\n${note?'备注：'+note+'\n':needNote?'加项 / 优惠说明：【请补充具体内容与条件】\n':''}\n预付款：${money(prepay)} 元（按${values.qTravelMode==='estimate'?'预估':'本次'}合计 ${rate}%）\n${values.qTravelMode==='estimate'?'预估':''}尾款：${money(balance)} 元，于【约定时间】支付。\n\n${travelTerms}${values.qTravelMode==='estimate'?'最终尾款按实际确认总额减去已付预付款结算。':''}\n如增加时长、场次或更改行程，费用另行确认。具体内容、现场条件及改期取消规则确认后，再按约定办理锁档。`;
    return {total,prepay,balance,text,base:p.price,extra:extras.reduce((sum,item)=>sum+item.cents,0),discount};
  }
  function quoteValues(){return Object.fromEntries(formIds.map(id=>[id,$(id).value]));}
  function updateQuote(persist=true){const values=quoteValues();$('durationField').hidden=values.qPackage!=='close';$('capField').hidden=values.qTravelMode!=='estimate';const result=calculate(values);$('quoteError').hidden=!result.error;$('quoteError').textContent=result.error||'';$('copyQuote').disabled=!!result.error;$('previewQuote').disabled=!!result.error;quoteText=result.text||'';if(result.error){$('quoteTotal').textContent='—';$('quotePrepay').textContent='—';$('quoteBalance').textContent='—';$('quoteBreakdown').textContent='先修正上面的费用输入';}else{$('quoteTotal').textContent='¥'+money(result.total);$('quotePrepay').textContent='¥'+money(result.prepay);$('quoteBalance').textContent='¥'+money(result.balance);$('quoteBreakdown').textContent=`套餐 ${money(result.base)} + 差旅及加项 ${money(result.extra)} − 优惠 ${money(result.discount)} 元`;}if(persist)save('quote',values);}
  function restoreQuote(){const draft=read('quote',{});if(draft&&typeof draft==='object'&&!Array.isArray(draft)){formIds.forEach(id=>{if(typeof draft[id]==='string'&&draft[id].length<=500){const element=$(id);if(element.tagName==='SELECT'&&![...element.options].some(option=>option.value===draft[id]))return;element.value=draft[id];}});}updateQuote(false);}
  function updateOfflineStatus(){const status=$('offlineStatus');status.className='status';if(offlineReady){status.textContent=navigator.onLine?'离线可用':'正在离线使用';}else{status.textContent=navigator.onLine?'首次联网准备':'请先联网缓存';status.classList.add('pending');}}
  async function setupOffline(){if(!('serviceWorker'in navigator)||!window.isSecureContext||location.protocol==='file:'){$('offlineStatus').textContent='本地预览';$('offlineStatus').className='status pending';return;}try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;offlineReady=true;updateOfflineStatus();}catch(error){$('offlineStatus').textContent='离线缓存未完成';$('offlineStatus').className='status warning';}}
  $('searchInput').addEventListener('input',renderSearch);$('clearSearch').addEventListener('click',()=>{$('searchInput').value='';renderSearch();$('searchInput').focus();});
  document.querySelectorAll('[data-search]').forEach(button=>button.addEventListener('click',()=>{$('searchInput').value=button.dataset.search;renderSearch();}));
  document.querySelectorAll('[data-item]').forEach(button=>button.addEventListener('click',()=>openGroup(byId.get(button.dataset.item).groupId,button.dataset.item)));
  $('closeScripts').addEventListener('click',()=>closeDialog('scriptsDialog'));$('expandAll').addEventListener('click',()=>{const cards=[...$('sheetScripts').querySelectorAll('details')];const expand=!cards.every(card=>card.open);cards.forEach(card=>card.open=expand);updateExpandLabel();});
  $('quoteForm').addEventListener('submit',event=>event.preventDefault());$('quoteForm').addEventListener('input',()=>updateQuote());$('quoteForm').addEventListener('change',()=>updateQuote());
  $('resetQuote').addEventListener('click',()=>{if(window.confirm('重置这份报价草稿？收藏和话术不会改变。')){$('quoteForm').reset();updateQuote();notify('报价草稿已重置');}});
  $('copyQuote').addEventListener('click',()=>copy(quoteText));$('previewQuote').addEventListener('click',()=>showText(quoteText));$('copyPreview').addEventListener('click',()=>copy($('textPreview').value));$('closeText').addEventListener('click',()=>closeDialog('textDialog'));
  $('installButton').addEventListener('click',()=>{const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;$('installState').textContent=standalone?'你已经在桌面 App 中使用了。':location.protocol==='file:'?'当前是本地文件预览，需要通过网页访问网址才能添加到 iPhone 主屏幕。':'添加后，从桌面图标联网打开一次，等待“离线可用”。';showDialog('infoDialog');});$('closeInfo').addEventListener('click',()=>closeDialog('infoDialog'));
  window.addEventListener('hashchange',route);window.addEventListener('online',updateOfflineStatus);window.addEventListener('offline',updateOfflineStatus);
  window.addEventListener('storage',event=>{if(event.key===STORAGE+'favorites'){const latest=read('favorites',[]);favorites.clear();if(Array.isArray(latest))latest.filter(id=>byId.has(id)).forEach(id=>favorites.add(id));document.querySelectorAll('[data-favorite]').forEach(updateFavoriteButton);renderFavorites();}});
  window.Playbook={calculate,parseMoney,searchItems,groups,allItems};
  renderDirectory();renderFavorites();restoreQuote();route();setupOffline();
})();
