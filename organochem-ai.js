(function(){
  const AI_SETTINGS_KEY='oc-ai-settings-v1';
  const AI_PLANNER_KEY='oc-ai-planner-v1';
  const ORGANOBOT_HISTORY_KEY='oc-organobot-history-v1';
  const AI_PROXY_URL='/api/chat';
  const DEFAULT_AI_MODEL='gemini-1.5-flash';
  const AI_PROVIDER_PRESETS={
    builtIn:{
      id:'builtIn',
      label:'Shared Gemini AI',
      provider:'Secure server route',
      summary:'Shared chemistry assistant and roadmap planner powered by Gemini.',
      model:DEFAULT_AI_MODEL
    }
  };
  const DEFAULT_AI_SETTINGS={
    model:DEFAULT_AI_MODEL
  };

  const CHEMISTRY_CHAT_SYSTEM_PROMPT=[
    'You are OrganoBot, a chemistry-focused assistant with strong expertise in organic chemistry.',
    'Answer only chemistry-related questions and politely redirect unrelated questions back to chemistry.',
    'Treat shorthand, fragments, formulas, reaction arrows, spectra values, and messy spelling or grammar as valid chemistry input when context suggests chemistry.',
    'Use the current message plus recent conversation history to infer likely chemistry intent before asking for clarification.',
    'When learner curriculum and academic year are provided, use them as the primary study reference for scope, sequencing, terminology, and difficulty.',
    'When a saved study plan is provided, use it to align quiz help, revision guidance, and generated question ideas.',
    'Format answers for an in-browser chat so they are easy to scan: use short sections, bullets, and clean spacing.',
    'Avoid dense wall-of-text formatting, and when comparing topics prefer bullets or a compact markdown table with one row per point.',
    'Be accurate, explain step-by-step when helpful, and admit uncertainty when appropriate.',
    'Prefer concise but useful teaching language and include organic chemistry examples when relevant.'
  ].join(' ');

  const PLANNER_SYSTEM_PROMPT=[
    'You are OrganoChem Planner, an expert organic chemistry study-planning assistant.',
    'Create a beginner-to-master roadmap and a next-session plan based on the learner profile and browser progress snapshot.',
    'When a curriculum track and academic year are provided, align the roadmap, next session, topic depth, and exam checkpoints to that curriculum reference instead of giving a generic plan.',
    'Treat input.courseDays, input.courseWeeks, input.sessionMinutes, input.plannedQuizzes, input.plannedMajorExams, and input.recommendedQuizzesPerWeek as the pacing anchors for the plan.',
    'Spread major exams across the roadmap with the final major exam near the end of the course.',
    'Return valid JSON only with no markdown fences and no extra commentary.',
    'Keep the roadmap realistic, motivating, and specific to organic chemistry.',
    'The nextSession.blocks minutes must sum exactly to nextSession.totalMinutes.',
    'Use only the requested keys and keep every field populated.'
  ].join(' ');

  const QUIZ_GENERATOR_SYSTEM_PROMPT=[
    'You are OrganoBot, the shared adaptive organic chemistry quiz generator inside this app.',
    'Generate multiple-choice questions that follow the learner study plan, current quiz mode, learner level, weak areas, and recent quiz performance.',
    'When a study plan is provided, prioritize its roadmap topics, next-session blocks, and priority areas instead of generating generic questions.',
    'Return valid JSON only with no markdown fences and no extra commentary.',
    'Every question must have exactly 4 answer choices, exactly 1 correct answer index from 0 to 3, and a short explanation.',
    'The explanation must briefly say why the correct choice is right and why the other choices do not fit.',
    'Keep distractors plausible, avoid duplicate options, avoid trick wording, and keep the chemistry accurate.',
    'Respect the requested question count and quiz mode, and vary difficulty progressively when the mode suggests a progression.',
    'Use only these categories when labeling questions: Functional Groups, Reaction Mechanisms, IUPAC Naming, Stereochemistry, Aromatic Chemistry, Spectroscopy.',
    'Use only these difficulty labels: Beginner, Intermediate, Advanced, Scholar.'
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

  function normalizeStoredModel(model){
    const raw=String(model||'').trim();
    if(!raw)return DEFAULT_AI_MODEL;
    if(raw==='gemini-1.5-flash')return DEFAULT_AI_MODEL;
    if(raw.startsWith('models/'))return normalizeStoredModel(raw.slice(7));
    if(raw.startsWith('x-ai/')||raw.toLowerCase().includes('grok'))return DEFAULT_AI_MODEL;
    if(!/^gemini-[a-z0-9.-]+$/i.test(raw))return DEFAULT_AI_MODEL;
    return raw;
  }

  function buildAISettingsFromPreset(id='builtIn',partial={}){
    const preset=getAIProviderPreset(id);
    return{
      ...readAISettings(),
      ...preset,
      ...partial,
      model:normalizeStoredModel(partial.model||preset.model||DEFAULT_AI_MODEL)
    };
  }

  function readAISettings(){
    const saved=readStorageJson(AI_SETTINGS_KEY,{});
    return{
      ...DEFAULT_AI_SETTINGS,
      ...saved,
      model:normalizeStoredModel(saved.model||DEFAULT_AI_MODEL)
    };
  }

  function saveAISettings(partial={}){
    const current=readAISettings();
    const next={
      ...current,
      ...partial,
      model:normalizeStoredModel(partial.model||current.model||DEFAULT_AI_MODEL)
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
    if(message.includes('GEMINI_API_KEY is not configured on the server')){
      return 'The AI server is not configured yet. Add your Gemini key to GEMINI_API_KEY in .env or .env.local, then restart the server.';
    }
    if(message.includes('RESOURCE_EXHAUSTED')||message.toLowerCase().includes('quota exceeded')){
      return 'The Gemini key is being read, but that Google project currently has no usable quota. Enable Gemini API access and billing or use a different Gemini key, then try again.';
    }
    if(message.includes('The Gemini proxy could not reach the upstream service')){
      return 'The AI server reached its proxy route, but the upstream Gemini service did not respond. Try again in a moment.';
    }
    if(message.includes('The shared Gemini AI service could not be reached')){
      return 'The AI server could not be reached. Make sure your local dev server is running and try again.';
    }
    if(message.includes('The shared Gemini AI service returned invalid JSON')){
      return 'The AI service responded, but the app could not parse the JSON it returned. Try again in a moment.';
    }
    return message;
  }

  function extractProxyMessageContent(response){
    const direct=normalizeContent(response?.text);
    if(direct)return direct;
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

  function resolveModelName(model){
    return normalizeStoredModel(model);
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
    return readServerProxyStatus();
  }

  async function createProxyChatCompletion({messages,jsonMode=false,temperature=.4}){
    const settings=readAISettings();
    const payload={
      model:resolveModelName(settings.model),
      messages:normalizeRequestMessages(messages),
      temperature,
      responseMimeType:jsonMode?'application/json':'text/plain'
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
      throw new Error('The shared Gemini AI service could not be reached. Check your server connection and try again.');
    }

    const rawText=await response.text();
    const parsed=safeParseJson(rawText);

    if(!response.ok){
      throw new Error(normalizeAIError(parsed||rawText||'The shared Gemini AI request failed.'));
    }

    const content=extractProxyMessageContent(parsed);
    if(!content.trim())throw new Error('The shared Gemini AI service returned an empty response.');
    return{
      content:stripCodeFences(content),
      reasoningDetails:null,
      payload:parsed,
      settings,
      provider:'server'
    };
  }

  async function createChatCompletion({messages,jsonMode=false,temperature=.4,reasoningEnabled=false}){
    return createProxyChatCompletion({
      messages,
      jsonMode,
      temperature,
      reasoningEnabled
    });
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

  function buildAdaptiveQuizMessages({input,progress}){
    return[
      {role:'system',content:QUIZ_GENERATOR_SYSTEM_PROMPT},
      {role:'user',content:[
        'Build an adaptive organic chemistry quiz.',
        'Return valid JSON only.',
        '',
        'Quiz contract:',
        JSON.stringify({
          title:'string',
          strategy:'string',
          questions:[{
            q:'string',
            opts:['string','string','string','string'],
            ans:1,
            exp:'string',
            cat:'Functional Groups',
            diff:'Intermediate'
          }],
          blockLabels:[{start:1,end:3,label:'string'}]
        }),
        '',
        'Quiz request:',
        JSON.stringify(input),
        '',
        'Learner progress and study context:',
        JSON.stringify(progress)
      ].join('\n')}
    ];
  }

  async function requestAdaptiveQuiz({input,progress}){
    const {content}=await createChatCompletion({
      messages:buildAdaptiveQuizMessages({input,progress}),
      jsonMode:true,
      temperature:.55
    });
    try{
      return JSON.parse(content);
    }catch{
      throw new Error('OrganoBot returned invalid quiz JSON.');
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
    QUIZ_GENERATOR_SYSTEM_PROMPT,
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
    requestAdaptiveQuiz,
    formatAssistantHtml
  };
})();
