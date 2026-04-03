(function(){
const AI=window.OrganoAI;
const BOT_STORE_KEY=AI?.ORGANOBOT_HISTORY_KEY||'oc-organobot-history-v1';
const canUseBotFeature=message=>window.OrganoApp?.assertFeatureAccess(message)??true;
const BOT_DISPLAY_NAME='OrganoQuizo Bot';

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
  window.dispatchEvent(new CustomEvent('organo:state-changed',{detail:{key:BOT_STORE_KEY}}));
}

function createGreetingMessage(){
  return{
    role:'assistant',
    content:'OrganoQuizo Bot is ready for chemistry and adaptive quiz help. Ask about mechanisms, spectroscopy, aromaticity, synthesis logic, compound behavior, or ask for a study-plan-based quiz.',
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
function summarizeBotText(value,limit=120){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  if(text.length<=limit)return text;
  return `${text.slice(0,limit-1).trim()}...`;
}

function buildBotProfileContext(){
  const profile=window.OrganoApp?.getProfile?.()||{};
  if(!profile.curriculumTrack)return'';
  const entry=(window.OrganoCurriculumData?.entries||[]).find(item=>item.title===profile.curriculumTrack);
  const topicList=entry?(entry.topics||[]).map(topic=>typeof topic==='string'?topic:topic?.title||'').filter(Boolean).slice(0,10):[];
  return[
    `The signed-in learner is assigned to the ${profile.curriculumTrack} curriculum.`,
    profile.academicYear?`Academic year: ${profile.academicYear}.`:'',
    profile.learnerType?`Learner type: ${profile.learnerType}.`:'',
    profile.country?`Profile country: ${profile.country}.`:'',
    topicList.length?`Use these curriculum topics as the reference scope unless the learner asks to go outside them: ${topicList.join(', ')}.`:'',
    'Keep answers chemistry-only. When the learner asks for a study plan, revision help, examples, or exam prep, treat the curriculum track and academic year as the default reference for depth, sequence, and priorities.'
  ].filter(Boolean).join(' ');
}

function buildBotStudyContext(){
  const plan=AI?.readPlannerCache?.();
  if(!plan||typeof plan!=='object'||(!plan.summary&&!plan.roadmap&&!plan.nextSession))return'';
  const roadmapTopics=(Array.isArray(plan.roadmap)?plan.roadmap:[]).flatMap(entry=>Array.isArray(entry?.topics)?entry.topics:[]).filter(Boolean).slice(0,8);
  const nextSessionBlocks=(Array.isArray(plan.nextSession?.blocks)?plan.nextSession.blocks:[]).slice(0,5).map(block=>`${block.label} (${block.minutes} min, ${block.activity})`);
  return[
    `The latest saved study plan summary is: ${plan.summary||'No summary available.'}`,
    roadmapTopics.length?`Priority roadmap topics: ${roadmapTopics.join(', ')}.`:'',
    nextSessionBlocks.length?`Next session blocks: ${nextSessionBlocks.join('; ')}.`:'',
    'When the learner asks for a quiz, revision questions, or checkpoints, align them to this saved study plan first.'
  ].filter(Boolean).join(' ');
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
    return`<article class="chat-bubble ${message.role}"><div class="chat-bubble-head"><span>${escapeBot(message.role==='assistant'?BOT_DISPLAY_NAME:message.role==='user'?'You':'System')}</span><span>${prettyBotDate(message.createdAt)}</span></div>${body}</article>`;
  }).join('');
  log.scrollTop=log.scrollHeight;
}

function renderOrganobot(){
  renderSessions();
  renderMessages();
}

async function refreshBotActivationState(){
  if(!AI){
    setBotStatus('Shared Grok AI is unavailable right now.');
    return;
  }
  const client=await AI.readHostedProxyStatus();
  if(client.available&&client.configured){
    setBotStatus(`Shared Grok AI is ready through ${client.provider==='puter'?'Puter':'the server route'}. ${BOT_DISPLAY_NAME} can answer chemistry questions and build adaptive quizzes.`);
    return;
  }
  if(client.available&&!client.configured){
    setBotStatus('Shared Grok AI is not configured on the server yet.');
    return;
  }
  setBotStatus('Shared Grok AI is unavailable right now. Check Puter or the server connection and try again.');
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

function normalizeUserPrompt(prompt){
  return String(prompt||'')
    .replace(/\r\n?/g,'\n')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

async function sendToOrganobot(prompt){
  if(!canUseBotFeature(`Sign in to send questions to ${BOT_DISPLAY_NAME}.`))return;
  const trimmed=normalizeUserPrompt(prompt);
  if(!trimmed)return;
  addMessage('user',trimmed);
  document.getElementById('chatInput').value='';

  setBotStatus(`${BOT_DISPLAY_NAME} is thinking through your prompt...`);
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
    const profileContext=buildBotProfileContext();
    const studyContext=buildBotStudyContext();
    const result=await AI.createChatCompletion({
      messages:[
        {role:'system',content:AI.CHEMISTRY_CHAT_SYSTEM_PROMPT},
        ...(profileContext?[{role:'system',content:profileContext}]:[]),
        ...(studyContext?[{role:'system',content:studyContext}]:[]),
        ...recentMessages
      ],
      jsonMode:false,
      temperature:.5,
      reasoningEnabled:true
    });
    addMessage('assistant',result.content,{reasoningDetails:result.reasoningDetails});
    setBotStatus(`${BOT_DISPLAY_NAME} answered. Ask a follow-up or start a new chemistry chat.`);
    window.OrganoApp?.notify?.({
      title:`${BOT_DISPLAY_NAME} replied`,
      body:summarizeBotText(result.content),
      kind:'info',
      actionHref:'#bot',
      actionLabel:'Read answer',
      dedupeKey:`organobot-response-${activeSession.id}`
    });
  }catch(error){
    const normalizedError=AI.normalizeAIError(error);
    addMessage('assistant',`I could not reach the AI service just now. ${normalizedError}`);
    setBotStatus(normalizedError);
    window.OrganoApp?.notify?.({
      title:`${BOT_DISPLAY_NAME} could not respond`,
      body:normalizedError,
      kind:'warning',
      actionHref:'#bot',
      actionLabel:'Try again',
      dedupeKey:'organobot-error'
    });
  }
}

document.getElementById('newSessionBtn').addEventListener('click',()=>{
  if(!canUseBotFeature(`Sign in to create and save ${BOT_DISPLAY_NAME} chat sessions.`))return;
  const session=createSession();
  botState.sessions.unshift(session);
  botState.activeId=session.id;
  saveBotStore();
  renderOrganobot();
  setBotStatus('Started a fresh chemistry chat.');
  window.OrganoApp?.notify?.({
    title:`New ${BOT_DISPLAY_NAME} chat`,
    body:'A fresh chemistry conversation is ready for your next question.',
    kind:'success',
    actionHref:'#bot',
    actionLabel:'Open chat',
    dedupeKey:'organobot-new-session'
  });
});
document.getElementById('clearHistoryBtn').addEventListener('click',()=>{
  if(!canUseBotFeature(`Sign in to manage ${BOT_DISPLAY_NAME} chat history.`))return;
  if(!confirm(`Clear all ${BOT_DISPLAY_NAME} chat history? This will remove every saved chemistry session on this browser.`))return;
  const session=createSession();
  botState={activeId:session.id,sessions:[session]};
  saveBotStore();
  renderOrganobot();
  setBotStatus(`All ${BOT_DISPLAY_NAME} history was cleared.`);
  window.OrganoApp?.notify?.({
    title:`${BOT_DISPLAY_NAME} history cleared`,
    body:'All saved chat sessions were removed and a fresh conversation was created.',
    kind:'warning',
    actionHref:'#bot',
    actionLabel:'Start again',
    dedupeKey:'organobot-cleared'
  });
});
document.getElementById('chatForm').addEventListener('submit',event=>{
  event.preventDefault();
  sendToOrganobot(document.getElementById('chatInput').value);
});
document.querySelectorAll('[data-prompt]').forEach(button=>{
  button.addEventListener('click',()=>sendToOrganobot(button.dataset.prompt||''));
});

window.addEventListener('organo:hydrate-bot-state',()=>{
  botState=readBotStore();
  renderOrganobot();
});
window.addEventListener('organo:auth-changed',()=>{
  botState=readBotStore();
  renderOrganobot();
});

renderOrganobot();
refreshBotActivationState();
})();
