const AI=window.OrganoAI;
const BOT_STORE_KEY=AI?.ORGANOBOT_HISTORY_KEY||'oc-organobot-history-v1';

function botNow(){
  return new Date().toISOString();
}

function readBotStore(){
  try{
    const raw=JSON.parse(localStorage.getItem(BOT_STORE_KEY)||'{}');
    return{
      activeId:raw.activeId||'',
      sessions:Array.isArray(raw.sessions)?raw.sessions:[]
    };
  }catch{
    return{activeId:'',sessions:[]};
  }
}

let botState=readBotStore();

function saveBotStore(){
  localStorage.setItem(BOT_STORE_KEY,JSON.stringify(botState));
}

function createGreetingMessage(){
  return{
    role:'assistant',
    content:'ORGANOBOT is ready for chemistry. Ask about mechanisms, spectroscopy, aromaticity, synthesis logic, compound behavior, or study strategy.',
    createdAt:botNow()
  };
}

function createSession(title='New chemistry chat'){
  return{
    id:`session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    title,
    createdAt:botNow(),
    updatedAt:botNow(),
    messages:[createGreetingMessage()]
  };
}

function ensureActiveSession(){
  if(!botState.sessions.length){
    const session=createSession();
    botState.sessions=[session];
    botState.activeId=session.id;
    saveBotStore();
  }
  let active=botState.sessions.find(session=>session.id===botState.activeId);
  if(!active){
    active=botState.sessions[0];
    botState.activeId=active.id;
    saveBotStore();
  }
  return active;
}

function getActiveSession(){
  return ensureActiveSession();
}

function setBotStatus(message){
  document.getElementById('botStatus').textContent=message;
}

function prettyBotDate(value){
  return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

function escapeBot(value){
  return AI?.escapeHtml?AI.escapeHtml(value):String(value);
}

function renderSessions(){
  const activeId=getActiveSession().id;
  const box=document.getElementById('sessionList');
  box.innerHTML=botState.sessions
    .slice()
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))
    .map(session=>`<button class="session-item ${session.id===activeId?'active':''}" type="button" data-session-id="${session.id}"><strong>${escapeBot(session.title||'New chemistry chat')}</strong><span>${session.messages.length-1>0?session.messages.length-1:0} message${session.messages.length-1===1?'':'s'} - ${prettyBotDate(session.updatedAt)}</span></button>`)
    .join('');
  box.querySelectorAll('[data-session-id]').forEach(button=>{
    button.addEventListener('click',()=>{
      botState.activeId=button.dataset.sessionId;
      saveBotStore();
      renderOrganobot();
    });
  });
}

function renderMessages(){
  const session=getActiveSession();
  document.getElementById('sessionTitle').textContent=session.title||'New chemistry chat';
  const log=document.getElementById('chatLog');
  log.innerHTML=session.messages.map(message=>{
    const body=message.role==='assistant'?AI.formatAssistantHtml(message.content):`<p>${escapeBot(message.content)}</p>`;
    return`<article class="chat-bubble ${message.role}"><div class="chat-bubble-head"><span>${escapeBot(message.role==='assistant'?'ORGANOBOT':message.role==='user'?'You':'System')}</span><span>${prettyBotDate(message.createdAt)}</span></div>${body}</article>`;
  }).join('');
  log.scrollTop=log.scrollHeight;
}

function renderOrganobot(){
  renderSessions();
  renderMessages();
}

function populateBotSettings(){
  if(!AI)return;
  const settings=AI.readAISettings();
  document.getElementById('botApiKey').value=settings.apiKey;
  document.getElementById('botBaseUrl').value=settings.baseUrl;
  document.getElementById('botModel').value=settings.model;
}

function applyBotPreset(presetId){
  if(!AI)return;
  const presetSettings=AI.buildAISettingsFromPreset(presetId,{
    apiKey:document.getElementById('botApiKey').value.trim()
  });
  document.getElementById('botBaseUrl').value=presetSettings.baseUrl;
  document.getElementById('botModel').value=presetSettings.model;
  setBotStatus(`Loaded ${AI.getAIProviderPreset(presetId).label}. Save AI settings, or use the secure hosted proxy.`);
}

async function saveBotSettings(){
  if(!AI)return;
  AI.saveAISettings({
    apiKey:document.getElementById('botApiKey').value.trim(),
    baseUrl:document.getElementById('botBaseUrl').value.trim(),
    model:document.getElementById('botModel').value.trim()
  });
  await refreshBotActivationState();
}

async function refreshBotActivationState(){
  if(!AI){
    setBotStatus('The shared AI client is unavailable right now.');
    return;
  }
  const settings=AI.readAISettings();
  const proxy=await AI.readHostedProxyStatus();
  if(settings.apiKey){
    setBotStatus('ORGANOBOT is ready for chemistry questions.');
    return;
  }
  if(proxy.available&&proxy.configured){
    setBotStatus('Secure hosted AI is active. ORGANOBOT is ready for chemistry questions.');
    return;
  }
  if(proxy.available&&!proxy.configured){
    setBotStatus('Hosted AI proxy found, but OPENROUTER_API_KEY is not configured on the server yet.');
    return;
  }
  setBotStatus('Add your API key, or deploy the secure /api/chat proxy to activate ORGANOBOT.');
}

function addMessage(role,content,meta={}){
  const session=getActiveSession();
  session.messages.push({
    role,
    content,
    createdAt:botNow(),
    ...(meta.reasoningDetails?{reasoning_details:meta.reasoningDetails}:{})
  });
  session.updatedAt=botNow();
  const firstUser=session.messages.find(message=>message.role==='user');
  if(firstUser){
    session.title=firstUser.content.trim().slice(0,48)||(session.title||'New chemistry chat');
  }
  saveBotStore();
  renderOrganobot();
}

function isChemistryPrompt(text){
  const source=String(text||'').toLowerCase();
  if(!source.trim())return false;
  return /(chem|organic|inorganic|mechanism|reaction|spectro|nmr|ir|mass spec|molecule|compound|alkane|alkene|alkyne|aromatic|benzene|sn1|sn2|e1|e2|grignard|carbonyl|aldehyde|ketone|ester|amide|acid|amine|stereo|chir|huckel|pi electron|oxidation|reduction|equilibrium|pka|acid-base|functional group|synthesis)/i.test(source);
}

async function sendToOrganobot(prompt){
  const trimmed=prompt.trim();
  if(!trimmed)return;
  addMessage('user',trimmed);
  document.getElementById('chatInput').value='';

  if(!isChemistryPrompt(trimmed)){
    addMessage('assistant','I stay focused on chemistry. Ask me about mechanisms, spectroscopy, functional groups, aromaticity, synthesis strategy, compound behavior, or chemistry study planning.');
    setBotStatus('Redirected an off-topic prompt back to chemistry.');
    return;
  }

  setBotStatus('ORGANOBOT is thinking through your chemistry question...');
  const activeSession=getActiveSession();
  const recentMessages=activeSession.messages
    .filter(message=>message.role==='user'||message.role==='assistant')
    .slice(-12)
    .map(message=>({
      role:message.role,
      content:message.content,
      ...(message.reasoning_details?{reasoning_details:message.reasoning_details}:{})
    }));

  try{
    const result=await AI.createChatCompletion({
      messages:[
        {role:'system',content:AI.CHEMISTRY_CHAT_SYSTEM_PROMPT},
        ...recentMessages
      ],
      jsonMode:false,
      temperature:.5,
      reasoningEnabled:true
    });
    addMessage('assistant',result.content,{reasoningDetails:result.reasoningDetails});
    setBotStatus('ORGANOBOT answered. Ask a follow-up or start a new chemistry chat.');
  }catch(error){
    addMessage('assistant',`I could not reach the AI service just now. ${AI.normalizeAIError(error)}`);
    setBotStatus('The AI request failed. Check your settings or try again.');
  }
}

document.getElementById('botBestFreePresetBtn').addEventListener('click',()=>applyBotPreset('openRouterBestFree'));
document.getElementById('botFastFreePresetBtn').addEventListener('click',()=>applyBotPreset('openRouterAltFree'));
document.getElementById('saveBotSettingsBtn').addEventListener('click',saveBotSettings);
document.getElementById('newSessionBtn').addEventListener('click',()=>{
  const session=createSession();
  botState.sessions.unshift(session);
  botState.activeId=session.id;
  saveBotStore();
  renderOrganobot();
  setBotStatus('Started a fresh chemistry chat.');
});
document.getElementById('clearHistoryBtn').addEventListener('click',()=>{
  if(!confirm('Clear all ORGANOBOT chat history? This will remove every saved chemistry session on this browser.'))return;
  const session=createSession();
  botState={activeId:session.id,sessions:[session]};
  saveBotStore();
  renderOrganobot();
  setBotStatus('All ORGANOBOT history was cleared.');
});
document.getElementById('chatForm').addEventListener('submit',event=>{
  event.preventDefault();
  sendToOrganobot(document.getElementById('chatInput').value);
});
document.querySelectorAll('[data-prompt]').forEach(button=>{
  button.addEventListener('click',()=>sendToOrganobot(button.dataset.prompt||''));
});

populateBotSettings();
renderOrganobot();
refreshBotActivationState();
