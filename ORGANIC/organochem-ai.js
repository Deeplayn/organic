(function(){
  const AI_SETTINGS_KEY='oc-ai-settings-v1';
  const AI_PLANNER_KEY='oc-ai-planner-v1';
  const ORGANOBOT_HISTORY_KEY='oc-organobot-history-v1';
  const AI_PROXY_URL='/api/chat';
  const DEFAULT_AI_MODEL='grok-4';
  const AI_PROVIDER_PRESETS={
    builtIn:{
      id:'builtIn',
      label:'Built-in AI',
      provider:'Server proxy',
      summary:'Built-in chemistry assistant and roadmap planner.',
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
    if(typeof error==='string')return error;
    if(typeof error?.error?.message==='string')return error.error.message;
    if(typeof error?.message==='string')return error.message;
    return'Unknown AI error.';
  }

  function extractProxyMessageContent(response){
    const message=response?.choices?.[0]?.message;
    const content=normalizeContent(message?.content);
    if(content)return content;
    return '';
  }

  async function readHostedProxyStatus(force=false){
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
        signedIn:true
      };
    }catch{
      return{
        available:false,
        configured:false,
        url:AI_PROXY_URL,
        reason:'network-error',
        signedIn:false
      };
    }
  }

  function normalizeRequestMessages(messages){
    return(messages||[]).map(message=>({
      role:message.role,
      content:normalizeContent(message.content)
    })).filter(message=>message.role&&message.content);
  }

  async function createChatCompletion({messages,jsonMode=false,temperature=.4,reasoningEnabled=false}){
    const settings=readAISettings();
    const payload={
      model:settings.model||DEFAULT_AI_MODEL,
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
      throw new Error('The built-in AI service could not be reached. Check your server connection and try again.');
    }

    const rawText=await response.text();
    const parsed=safeParseJson(rawText);

    if(!response.ok){
      throw new Error(normalizeAIError(parsed||rawText||'The built-in AI request failed.'));
    }

    const content=extractProxyMessageContent(parsed);
    if(!content.trim())throw new Error('The AI service returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:null,
      payload:parsed,
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
