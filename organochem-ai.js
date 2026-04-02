(function(){
  const AI_SETTINGS_KEY='oc-ai-settings-v1';
  const AI_PLANNER_KEY='oc-ai-planner-v1';
  const ORGANOBOT_HISTORY_KEY='oc-organobot-history-v1';
  const AI_PROXY_URL='/api/chat';
  const AI_SHARED_SCRIPT_URL='https://js.puter.com/v2/';
  const DEFAULT_AI_MODEL='x-ai/grok-4.20';
  const AI_PROVIDER_PRESETS={
    builtIn:{
      id:'builtIn',
      label:'Shared Grok AI',
      provider:'Puter + server fallback',
      summary:'Shared chemistry assistant and roadmap planner powered by Grok.',
      model:DEFAULT_AI_MODEL
    }
  };
  const DEFAULT_AI_SETTINGS={
    apiKey:'',
    baseUrl:'',
    model:DEFAULT_AI_MODEL
  };

  const CHEMISTRY_CHAT_SYSTEM_PROMPT=[
    'You are ORGANOBOT, a chemistry-focused assistant with strong expertise in organic chemistry.',
    'Answer only chemistry-related questions and politely redirect unrelated questions back to chemistry.',
    'Treat shorthand, fragments, formulas, reaction arrows, spectra values, and messy spelling or grammar as valid chemistry input when context suggests chemistry.',
    'Use the current message plus recent conversation history to infer likely chemistry intent before asking for clarification.',
    'Format answers for an in-browser chat so they are easy to scan: use short sections, bullets, and clean spacing.',
    'Avoid dense wall-of-text formatting, and when comparing topics prefer bullets or a compact markdown table with one row per point.',
    'Be accurate, explain step-by-step when helpful, and admit uncertainty when appropriate.',
    'Prefer concise but useful teaching language and include organic chemistry examples when relevant.'
  ].join(' ');

  const PLANNER_SYSTEM_PROMPT=[
    'You are OrganoChem Planner, an expert organic chemistry study-planning assistant.',
    'Create a beginner-to-master roadmap and a next-session plan based on the learner profile and browser progress snapshot.',
    'When a curriculum track is provided, align the roadmap, next session, and priority topics to that curriculum instead of giving a generic plan.',
    'Return valid JSON only with no markdown fences and no extra commentary.',
    'Keep the roadmap realistic, motivating, and specific to organic chemistry.',
    'The nextSession.blocks minutes must sum exactly to nextSession.totalMinutes.',
    'Use only the requested keys and keep every field populated.'
  ].join(' ');

  function escapeHtml(value){
    return String(value)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function readStorageJson(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw?{...fallback,...JSON.parse(raw)}:fallback;
    }catch{
      return fallback;
    }
  }

  function writeStorageJson(key,value){
    localStorage.setItem(key,JSON.stringify(value));
    return value;
  }

  function getAIProviderPreset(id='builtIn'){
    const preset=AI_PROVIDER_PRESETS[id]||AI_PROVIDER_PRESETS.builtIn;
    return{...preset};
  }

  function buildAISettingsFromPreset(id='builtIn',partial={}){
    return{
      ...readAISettings(),
      ...partial,
      apiKey:'',
      baseUrl:'',
      model:DEFAULT_AI_MODEL
    };
  }

  function readAISettings(){
    const saved=readStorageJson(AI_SETTINGS_KEY,{});
    return{
      ...DEFAULT_AI_SETTINGS,
      ...saved,
      apiKey:'',
      baseUrl:'',
      model:DEFAULT_AI_MODEL
    };
  }

  function saveAISettings(partial={}){
    const next={
      ...readAISettings(),
      ...partial,
      apiKey:'',
      baseUrl:'',
      model:DEFAULT_AI_MODEL
    };
    return writeStorageJson(AI_SETTINGS_KEY,next);
  }

  function readPlannerCache(){
    return readStorageJson(AI_PLANNER_KEY,{});
  }

  function savePlannerCache(plan){
    return writeStorageJson(AI_PLANNER_KEY,plan);
  }

  function clearPlannerCache(){
    localStorage.removeItem(AI_PLANNER_KEY);
  }

  function stripCodeFences(text){
    return String(text||'')
      .replace(/^```(?:json)?\s*/i,'')
      .replace(/\s*```$/,'')
      .trim();
  }

  function normalizeContent(content){
    if(typeof content==='string')return content;
    if(Array.isArray(content)){
      return content.map(part=>{
        if(typeof part==='string')return part;
        if(typeof part?.text==='string')return part.text;
        if(typeof part?.content==='string')return part.content;
        return '';
      }).join('');
    }
    return '';
  }

  function safeParseJson(text){
    try{
      return JSON.parse(text);
    }catch{
      return null;
    }
  }

  function normalizeAIError(error){
    if(!error)return'Unknown AI error.';
    const rawMessage=typeof error==='string'
      ?error
      :typeof error?.error?.message==='string'
        ?error.error.message
        :typeof error?.message==='string'
          ?error.message
          :'Unknown AI error.';
    const message=String(rawMessage).trim()||'Unknown AI error.';
    if(message.includes('XAI_API_KEY is not configured on the server')){
      return 'The AI server is not configured yet. Add your xAI key to XAI_API_KEY in .env or .env.local, then restart the server.';
    }
    if(message.includes('The xAI proxy could not reach the upstream service')){
      return 'The AI server reached its proxy route, but the upstream xAI service did not respond. Try again in a moment.';
    }
    if(message.includes('The shared Grok AI service could not be reached')){
      return 'The AI server could not be reached. Make sure your local dev server is running and try again.';
    }
    if(message.includes('The Puter SDK could not be loaded')){
      return 'The browser could not load the Puter AI fallback. The app will need the server route to be configured instead.';
    }
    return message;
  }

  function extractProxyMessageContent(response){
    const message=response?.choices?.[0]?.message;
    const content=normalizeContent(message?.content);
    if(content)return content;
    return '';
  }

  function normalizeRequestMessages(messages){
    return(messages||[]).map(message=>({
      role:message.role,
      content:normalizeContent(message.content)
    })).filter(message=>message.role&&message.content);
  }

  function resolveModelForTransport(model,transport){
    const raw=String(model||'').trim()||DEFAULT_AI_MODEL;
    if(transport==='puter'){
      if(raw==='grok-4')return DEFAULT_AI_MODEL;
      return raw;
    }
    if(raw.startsWith('x-ai/'))return'grok-4';
    return raw||'grok-4';
  }

  function extractPuterMessageContent(response){
    const content=normalizeContent(response?.message?.content);
    if(content)return content;
    if(typeof response?.message==='string')return response.message;
    if(typeof response?.text==='string')return response.text;
    if(typeof response==='string')return response;
    return '';
  }

  function hasPuterChat(){
    return Boolean(window.puter?.ai?.chat);
  }

  let puterLoadPromise=null;

  function loadPuterSdk(){
    if(hasPuterChat())return Promise.resolve(window.puter);
    if(typeof document==='undefined')return Promise.reject(new Error('Shared Grok AI can only load in the browser.'));
    if(puterLoadPromise)return puterLoadPromise;

    puterLoadPromise=new Promise((resolve,reject)=>{
      const finalize=()=>{
        if(hasPuterChat()){
          resolve(window.puter);
          return;
        }
        reject(new Error('The Puter SDK loaded, but Grok chat is unavailable.'));
      };

      const handleError=()=>reject(new Error('The Puter SDK could not be loaded.'));
      let script=document.querySelector('script[data-puter-sdk]');

      if(!script){
        script=document.createElement('script');
        script.src=AI_SHARED_SCRIPT_URL;
        script.async=true;
        script.dataset.puterSdk='true';
        document.head.appendChild(script);
      }

      script.addEventListener('load',finalize,{once:true});
      script.addEventListener('error',handleError,{once:true});

      window.setTimeout(()=>{
        if(hasPuterChat())finalize();
      },250);
    }).catch(error=>{
      puterLoadPromise=null;
      throw error;
    });

    return puterLoadPromise;
  }

  async function readServerProxyStatus(){
    try{
      const response=await fetch(AI_PROXY_URL,{
        method:'GET',
        headers:{Accept:'application/json'}
      });
      const payload=safeParseJson(await response.text())||{};
      return{
        available:response.ok,
        configured:Boolean(payload.configured),
        url:AI_PROXY_URL,
        reason:response.ok?(payload.configured?'configured':'missing-server-key'):'proxy-error',
        signedIn:true,
        provider:'server'
      };
    }catch{
      return{
        available:false,
        configured:false,
        url:AI_PROXY_URL,
        reason:'network-error',
        signedIn:false,
        provider:'server'
      };
    }
  }

  async function readHostedProxyStatus(force=false){
    try{
      await loadPuterSdk();
      if(hasPuterChat()){
        return{
          available:true,
          configured:true,
          url:AI_SHARED_SCRIPT_URL,
          reason:'puter-ready',
          signedIn:true,
          provider:'puter'
        };
      }
    }catch{}
    return readServerProxyStatus();
  }

  async function createPuterChatCompletion({messages,temperature=.4}){
    await loadPuterSdk();
    const settings=readAISettings();
    const response=await window.puter.ai.chat(normalizeRequestMessages(messages),false,{
      model:resolveModelForTransport(settings.model,'puter'),
      temperature
    });
    const content=extractPuterMessageContent(response);
    if(!content.trim())throw new Error('Shared Grok AI returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:null,
      payload:response,
      settings,
      provider:'puter'
    };
  }

  async function createProxyChatCompletion({messages,temperature=.4}){
    const settings=readAISettings();
    const payload={
      model:resolveModelForTransport(settings.model,'server'),
      messages:normalizeRequestMessages(messages),
      temperature
    };

    let response;
    try{
      response=await fetch(AI_PROXY_URL,{
        method:'POST',
        headers:{
          'Accept':'application/json',
          'Content-Type':'application/json'
        },
        body:JSON.stringify(payload)
      });
    }catch{
      throw new Error('The shared Grok AI service could not be reached. Check your server connection and try again.');
    }

    const rawText=await response.text();
    const parsed=safeParseJson(rawText);

    if(!response.ok){
      throw new Error(normalizeAIError(parsed||rawText||'The shared Grok AI request failed.'));
    }

    const content=extractProxyMessageContent(parsed);
    if(!content.trim())throw new Error('The shared Grok AI service returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:null,
      payload:parsed,
      settings,
      provider:'server'
    };
  }

  function shouldTryServerFallback(error){
    const message=normalizeAIError(error).toLowerCase();
    return !message.includes('user cancelled')&&!message.includes('canceled');
  }

  async function createChatCompletion({messages,jsonMode=false,temperature=.4,reasoningEnabled=false}){
    try{
      return await createPuterChatCompletion({messages,jsonMode,temperature,reasoningEnabled});
    }catch(puterError){
      if(!shouldTryServerFallback(puterError))throw puterError;
      try{
        return await createProxyChatCompletion({messages,jsonMode,temperature,reasoningEnabled});
      }catch(proxyError){
        throw new Error(`${normalizeAIError(puterError)} ${normalizeAIError(proxyError)}`.trim());
      }
    }
  }

  function buildPlannerMessages({input,progress}){
    return[
      {role:'system',content:PLANNER_SYSTEM_PROMPT},
      {role:'user',content:[
        'Build a personalized organic chemistry roadmap and next study session.',
        'Return valid JSON only.',
        '',
        'Planner contract:',
        JSON.stringify({
          summary:'string',
          learnerProfile:{startingLevel:'Beginner | Intermediate | Advanced',targetLevel:'Master',pace:'string'},
          roadmap:[{week:1,goal:'string',topics:['string'],quizzes:2,majorExam:false,notes:'string'}],
          nextSession:{title:'string',totalMinutes:45,blocks:[{label:'string',minutes:10,activity:'quiz | review | examples | exam-drill | reference'}]},
          quizStrategy:{recommendedPerWeek:2,reason:'string'},
          examMilestones:[{week:4,type:'major',focus:'string'}],
          priorityTopics:['string'],
          advice:['string']
        }),
        '',
        'User input:',
        JSON.stringify(input),
        '',
        'Progress snapshot:',
        JSON.stringify(progress)
      ].join('\n')}
    ];
  }

  async function requestPlannerRoadmap({input,progress}){
    const {content}=await createChatCompletion({
      messages:buildPlannerMessages({input,progress}),
      jsonMode:true,
      temperature:.45
    });
    try{
      return JSON.parse(content);
    }catch{
      throw new Error('The AI planner returned invalid JSON.');
    }
  }

  function formatInlineHtml(text){
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/`(.+?)`/g,'<code>$1</code>');
  }

  function splitMarkdownRow(line){
    return String(line||'')
      .trim()
      .replace(/^\|/,'')
      .replace(/\|$/,'')
      .split('|')
      .map(cell=>cell.trim());
  }

  function isMarkdownDividerRow(line){
    const cells=splitMarkdownRow(line);
    return cells.length>0&&cells.every(cell=>/^:?-{3,}:?$/.test(cell));
  }

  function isMarkdownTable(lines){
    if(lines.length<2)return false;
    const header=splitMarkdownRow(lines[0]);
    if(header.length<2)return false;
    if(!isMarkdownDividerRow(lines[1]))return false;
    return true;
  }

  function renderMarkdownTable(lines){
    const headers=splitMarkdownRow(lines[0]);
    const rows=lines
      .slice(2)
      .filter(Boolean)
      .map(line=>{
        const cells=splitMarkdownRow(line);
        return headers.map((_,index)=>cells[index]||'');
      });
    return `<div class="chat-table-wrap"><table class="chat-table"><thead><tr>${headers.map(cell=>`<th>${formatInlineHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${formatInlineHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function formatAssistantHtml(text){
    const source=String(text||'').trim();
    if(!source)return'<p>No response.</p>';
    const blocks=source.split(/\n{2,}/).map(chunk=>chunk.trim()).filter(Boolean);
    return blocks.map(block=>{
      const lines=block.split('\n').map(line=>line.trim()).filter(Boolean);
      if(!lines.length)return'';
      if(lines.length===1&&/^#{1,6}\s+/.test(lines[0])){
        const headingLevel=Math.min(6,Math.max(1,(lines[0].match(/^#+/)?.[0].length||1)+1));
        return `<h${headingLevel}>${formatInlineHtml(lines[0].replace(/^#{1,6}\s+/,''))}</h${headingLevel}>`;
      }
      if(isMarkdownTable(lines)){
        return renderMarkdownTable(lines);
      }
      if(lines.every(line=>/^[-*]\s+/.test(line))){
        return `<ul>${lines.map(line=>`<li>${formatInlineHtml(line.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;
      }
      if(lines.every(line=>/^\d+\.\s+/.test(line))){
        return `<ol>${lines.map(line=>`<li>${formatInlineHtml(line.replace(/^\d+\.\s+/,''))}</li>`).join('')}</ol>`;
      }
      return `<p>${lines.map(formatInlineHtml).join('<br>')}</p>`;
    }).join('');
  }

  window.OrganoAI={
    AI_SETTINGS_KEY,
    AI_PLANNER_KEY,
    ORGANOBOT_HISTORY_KEY,
    AI_PROXY_URL,
    AI_SHARED_SCRIPT_URL,
    DEFAULT_AI_MODEL,
    AI_PROVIDER_PRESETS,
    DEFAULT_AI_SETTINGS,
    CHEMISTRY_CHAT_SYSTEM_PROMPT,
    PLANNER_SYSTEM_PROMPT,
    escapeHtml,
    readStorageJson,
    writeStorageJson,
    getAIProviderPreset,
    buildAISettingsFromPreset,
    readAISettings,
    saveAISettings,
    readPlannerCache,
    savePlannerCache,
    clearPlannerCache,
    normalizeAIError,
    readHostedProxyStatus,
    createChatCompletion,
    requestPlannerRoadmap,
    formatAssistantHtml
  };
})();
