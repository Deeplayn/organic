(function(){
  const AI_SETTINGS_KEY='oc-ai-settings-v1';
  const AI_PLANNER_KEY='oc-ai-planner-v1';
  const ORGANOBOT_HISTORY_KEY='oc-organobot-history-v1';
  const PUTER_SCRIPT_URL='https://js.puter.com/v2/';
  const AI_PROVIDER_PRESETS={
    grokRecommended:{
      id:'grokRecommended',
      label:'Grok 4.20 Beta',
      provider:'xAI via Puter',
      summary:'Recommended Grok preset for ORGANOBOT and the planner.',
      model:'x-ai/grok-4.20-beta'
    },
    grokFast:{
      id:'grokFast',
      label:'Grok 4.1 Fast',
      provider:'xAI via Puter',
      summary:'Faster Grok preset when you want lower latency.',
      model:'x-ai/grok-4-1-fast'
    }
  };
  const DEFAULT_AI_SETTINGS={
    apiKey:'',
    baseUrl:'',
    model:AI_PROVIDER_PRESETS.grokRecommended.model
  };

  const CHEMISTRY_CHAT_SYSTEM_PROMPT=[
    'You are ORGANOBOT, a chemistry-focused assistant with strong expertise in organic chemistry.',
    'Answer only chemistry-related questions and politely redirect unrelated questions back to chemistry.',
    'Treat shorthand, fragments, formulas, reaction arrows, spectra values, and messy spelling or grammar as valid chemistry input when context suggests chemistry.',
    'Use the current message plus recent conversation history to infer likely chemistry intent before asking for clarification.',
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

  function shouldUpgradeLegacySettings(saved){
    const baseUrl=String(saved?.baseUrl||'').trim().toLowerCase();
    const model=String(saved?.model||'').trim();
    if(!model)return true;
    if(String(saved?.apiKey||'').trim())return true;
    if(baseUrl)return true;
    return[
      'gpt-4o-mini',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b:free',
      'openai/gpt-oss-120b:free',
      'stepfun/step-3.5-flash:free'
    ].includes(model)||baseUrl.includes('openrouter.ai')||baseUrl.includes('api.openai.com')||baseUrl.includes('api.groq.com');
  }

  function getAIProviderPreset(id='grokRecommended'){
    const preset=AI_PROVIDER_PRESETS[id]||AI_PROVIDER_PRESETS.grokRecommended;
    return{...preset};
  }

  function buildAISettingsFromPreset(id,partial={}){
    const preset=getAIProviderPreset(id);
    return{
      ...readAISettings(),
      ...partial,
      baseUrl:'',
      model:preset.model
    };
  }

  function readAISettings(){
    const saved=readStorageJson(AI_SETTINGS_KEY,{});
    const useRecommendedDefaults=shouldUpgradeLegacySettings(saved);
    const normalizedSaved={
      ...saved,
      apiKey:'',
      baseUrl:'',
      model:useRecommendedDefaults?'':saved.model
    };
    return{
      ...DEFAULT_AI_SETTINGS,
      ...normalizedSaved,
      apiKey:'',
      baseUrl:'',
      model:String(normalizedSaved.model||DEFAULT_AI_SETTINGS.model).trim()
    };
  }

  function saveAISettings(partial){
    const next={
      ...readAISettings(),
      ...partial,
      apiKey:'',
      baseUrl:''
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

  function extractPuterMessageContent(response){
    if(typeof response==='string')return response;
    const message=response?.message;
    const content=normalizeContent(message?.content);
    if(content)return content;
    if(typeof response?.text==='string')return response.text;
    if(typeof response?.content==='string')return response.content;
    return '';
  }

  async function readHostedProxyStatus(force=false){
    const available=Boolean(window.puter?.ai?.chat);
    const signedIn=available&&typeof window.puter?.auth?.isSignedIn==='function'
      ?Boolean(window.puter.auth.isSignedIn())
      :false;
    return Promise.resolve({
      available,
      configured:available,
      url:PUTER_SCRIPT_URL,
      reason:available?'loaded':'missing-client',
      signedIn
    });
  }

  async function signInToPuter(){
    if(!window.puter?.auth?.signIn){
      throw new Error('Puter sign-in is unavailable right now.');
    }
    return window.puter.auth.signIn({attempt_temp_user_creation:true});
  }

  async function signOutOfPuter(){
    if(!window.puter?.auth?.signOut)return;
    await window.puter.auth.signOut();
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
    const clientStatus=await readHostedProxyStatus();
    if(!clientStatus.available){
      throw new Error('The Grok client did not load. Check your internet connection, disable any script blocker for js.puter.com, and reload the page.');
    }
    if(!settings.model)throw new Error('Choose a Grok model in the AI settings panel.');

    let response;
    try{
      response=await window.puter.ai.chat(normalizeRequestMessages(messages),{
        model:settings.model
      });
    }catch(error){
      throw new Error(normalizeAIError(error));
    }

    const content=extractPuterMessageContent(response);
    if(!content.trim())throw new Error('The AI service returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:null,
      payload:response,
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
    PUTER_SCRIPT_URL,
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
    signInToPuter,
    signOutOfPuter,
    createChatCompletion,
    requestPlannerRoadmap,
    formatAssistantHtml
  };
})();
