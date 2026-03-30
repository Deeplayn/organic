(function(){
  const AI_SETTINGS_KEY='oc-ai-settings-v1';
  const AI_PLANNER_KEY='oc-ai-planner-v1';
  const ORGANOBOT_HISTORY_KEY='oc-organobot-history-v1';
  const AI_PROXY_PATH='/api/chat';
  const LEGACY_OPENAI_DEFAULTS={
    baseUrl:'https://api.openai.com/v1/chat/completions',
    model:'gpt-4o-mini'
  };
  const LEGACY_GROQ_DEFAULTS={
    baseUrl:'https://api.groq.com/openai/v1/chat/completions',
    model:'openai/gpt-oss-120b'
  };
  const AI_PROVIDER_PRESETS={
    openRouterBestFree:{
      id:'openRouterBestFree',
      label:'OpenRouter Free: GPT OSS 20B',
      provider:'OpenRouter',
      summary:'Reasoning-enabled free preset for ORGANOBOT and the planner.',
      baseUrl:'https://openrouter.ai/api/v1/chat/completions',
      model:'openai/gpt-oss-20b:free'
    },
    openRouterAltFree:{
      id:'openRouterAltFree',
      label:'OpenRouter Free: GPT OSS 120B',
      provider:'OpenRouter',
      summary:'Alternate free preset with a larger GPT OSS model.',
      baseUrl:'https://openrouter.ai/api/v1/chat/completions',
      model:'openai/gpt-oss-120b:free'
    }
  };
  const DEFAULT_AI_SETTINGS={
    apiKey:'',
    baseUrl:AI_PROVIDER_PRESETS.openRouterBestFree.baseUrl,
    model:AI_PROVIDER_PRESETS.openRouterBestFree.model
  };

  const CHEMISTRY_CHAT_SYSTEM_PROMPT=[
    'You are ORGANOBOT, a chemistry-focused assistant with strong expertise in organic chemistry.',
    'Answer only chemistry-related questions and politely redirect unrelated questions back to chemistry.',
    'Be accurate, explain step-by-step when helpful, and admit uncertainty when appropriate.',
    'Prefer concise but useful teaching language and include organic chemistry examples when relevant.'
  ].join(' ');

  const PLANNER_SYSTEM_PROMPT=[
    'You are OrganoChem Planner, an expert organic chemistry study-planning assistant.',
    'Create a beginner-to-master roadmap and a next-session plan based on the learner profile and browser progress snapshot.',
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

  function isLegacyOpenAIDefault(saved){
    const apiKey=String(saved?.apiKey||'').trim();
    const baseUrl=String(saved?.baseUrl||'').trim();
    const model=String(saved?.model||'').trim();
    if(apiKey)return false;
    const legacyPairs=[
      LEGACY_OPENAI_DEFAULTS,
      LEGACY_GROQ_DEFAULTS
    ];
    return legacyPairs.some(pair=>{
      const looksLikeLegacyBaseUrl=!baseUrl||baseUrl===pair.baseUrl;
      const looksLikeLegacyModel=!model||model===pair.model;
      return looksLikeLegacyBaseUrl&&looksLikeLegacyModel;
    });
  }

  function getAIProviderPreset(id='openRouterBestFree'){
    const preset=AI_PROVIDER_PRESETS[id]||AI_PROVIDER_PRESETS.openRouterBestFree;
    return{...preset};
  }

  function buildAISettingsFromPreset(id,partial={}){
    const preset=getAIProviderPreset(id);
    return{
      ...readAISettings(),
      ...partial,
      baseUrl:preset.baseUrl,
      model:preset.model
    };
  }

  function readAISettings(){
    const saved=readStorageJson(AI_SETTINGS_KEY,{});
    const useRecommendedDefaults=isLegacyOpenAIDefault(saved);
    const normalizedSaved={
      ...saved,
      baseUrl:useRecommendedDefaults?'':saved.baseUrl,
      model:useRecommendedDefaults?'':saved.model
    };
    return{
      ...DEFAULT_AI_SETTINGS,
      ...normalizedSaved,
      apiKey:String(saved.apiKey||'').trim(),
      baseUrl:String(normalizedSaved.baseUrl||DEFAULT_AI_SETTINGS.baseUrl).trim(),
      model:String(normalizedSaved.model||DEFAULT_AI_SETTINGS.model).trim()
    };
  }

  function saveAISettings(partial){
    const next={
      ...readAISettings(),
      ...partial
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

  function normalizeAIError(error){
    if(!error)return'Unknown AI error.';
    if(typeof error==='string')return error;
    return error.message||'Unknown AI error.';
  }

  let proxyStatusPromise=null;

  function canProbeHostedProxy(){
    return typeof window!=='undefined'&&window.location?.protocol!=='file:';
  }

  async function readHostedProxyStatus(force=false){
    if(!canProbeHostedProxy())return{available:false,configured:false,url:AI_PROXY_PATH};
    if(proxyStatusPromise&&!force)return proxyStatusPromise;
    proxyStatusPromise=fetch(AI_PROXY_PATH,{
      method:'GET',
      headers:{Accept:'application/json'}
    }).then(async response=>{
      if(!response.ok)return{available:false,configured:false,url:AI_PROXY_PATH};
      let payload={};
      try{
        payload=await response.json();
      }catch{}
      return{
        available:true,
        configured:Boolean(payload?.configured),
        url:AI_PROXY_PATH
      };
    }).catch(()=>({available:false,configured:false,url:AI_PROXY_PATH}));
    return proxyStatusPromise;
  }

  function normalizeRequestMessages(messages){
    return(messages||[]).map(message=>{
      const normalized={
        role:message.role,
        content:message.content
      };
      if(message.reasoning_details)normalized.reasoning_details=message.reasoning_details;
      return normalized;
    });
  }

  async function createChatCompletion({messages,jsonMode=false,temperature=.4,reasoningEnabled=false}){
    const settings=readAISettings();
    const proxyStatus=await readHostedProxyStatus();
    const useHostedProxy=!settings.apiKey&&proxyStatus.available&&proxyStatus.configured;

    if(!useHostedProxy&&!settings.apiKey){
      throw new Error('Add your AI API key in the AI settings panel, or deploy the secure /api/chat proxy with OPENROUTER_API_KEY.');
    }
    if(!useHostedProxy&&!settings.baseUrl){
      throw new Error('Add a valid AI base URL in the AI settings panel.');
    }
    if(!settings.model)throw new Error('Add a model name in the AI settings panel.');

    const body={
      model:settings.model,
      messages:normalizeRequestMessages(messages),
      temperature
    };
    if(jsonMode)body.response_format={type:'json_object'};
    if(reasoningEnabled)body.reasoning={enabled:true};

    const response=await fetch(useHostedProxy?AI_PROXY_PATH:settings.baseUrl,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        ...(useHostedProxy?{}:{'Authorization':`Bearer ${settings.apiKey}`})
      },
      body:JSON.stringify(body)
    });

    const rawText=await response.text();
    let payload={};
    try{
      payload=rawText?JSON.parse(rawText):{};
    }catch{
      if(!response.ok)throw new Error(`AI request failed (${response.status}).`);
      throw new Error('The AI service returned a non-JSON response.');
    }

    if(!response.ok){
      throw new Error(payload?.error?.message||`AI request failed (${response.status}).`);
    }

    const message=payload?.choices?.[0]?.message||{};
    const content=normalizeContent(message.content);
    if(!content.trim())throw new Error('The AI service returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:message.reasoning_details,
      payload,
      settings
    };
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

  function formatAssistantHtml(text){
    const source=String(text||'').trim();
    if(!source)return'<p>No response.</p>';
    const blocks=source.split(/\n{2,}/).map(chunk=>chunk.trim()).filter(Boolean);
    return blocks.map(block=>{
      const lines=block.split('\n').map(line=>line.trim()).filter(Boolean);
      if(lines.length&&lines.every(line=>/^[-*]\s+/.test(line))){
        return `<ul>${lines.map(line=>`<li>${escapeHtml(line.replace(/^[-*]\s+/,''))}</li>`).join('')}</ul>`;
      }
      if(lines.length&&lines.every(line=>/^\d+\.\s+/.test(line))){
        return `<ol>${lines.map(line=>`<li>${escapeHtml(line.replace(/^\d+\.\s+/,''))}</li>`).join('')}</ol>`;
      }
      return `<p>${escapeHtml(lines.join(' ')).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code>$1</code>')}</p>`;
    }).join('');
  }

  window.OrganoAI={
    AI_SETTINGS_KEY,
    AI_PLANNER_KEY,
    ORGANOBOT_HISTORY_KEY,
    AI_PROXY_PATH,
    LEGACY_OPENAI_DEFAULTS,
    LEGACY_GROQ_DEFAULTS,
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
