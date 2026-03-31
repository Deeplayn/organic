(function(){
  const MAIN_STATE_KEY='oc-state-v2';
  const THEME_KEY='oc-theme';
  const BOT_STATE_KEY='oc-organobot-history-v1';
  const THEME_LABELS={
    'lab-noir':'Lab Noir',
    'cyberpunk':'Cyberpunk',
    'academic-ink':'Academic Ink',
    'deep-space':'Deep Space',
    'copper-reactor':'Copper Reactor',
    'forest-glass':'Forest Glass',
    'lab-white':'Lab White',
    'neon-day':'Neon Day',
    'ivory':'Ivory Academic',
    'clean-slate':'Clean Slate',
    'paper-spectrum':'Paper Spectrum',
    'solar-lab':'Solar Lab'
  };
  const PANEL_MAP={
    dashboard:'dashboard',
    topics:'dashboard',
    reactions:'dashboard',
    quiz:'dashboard',
    reference:'dashboard',
    studio:'studio',
    bot:'bot',
    chatShell:'bot',
    auth:'auth'
  };
  const DEFAULT_MAIN_STATE={topicStatus:{},savedReactions:[],quizHistory:[],studyPlans:[]};
  const DEFAULT_BOT_STATE={activeId:'',sessions:[]};
  const IS_AUTH_PAGE=/\/auth\.html$/i.test(window.location.pathname)||/auth\.html$/i.test(window.location.pathname.split('/').pop()||'');
  const authState={status:'loading',user:null,syncing:false};

  let currentAuthMode='login';
  let syncTimer=0;

  function $(id){return document.getElementById(id);}
  function safeParse(raw,fallback){
    try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}
  }
  function currentRelativeUrl(){
    const file=window.location.pathname.split('/').pop()||'index.html';
    return `${file}${window.location.search||''}${window.location.hash||''}`;
  }
  function sanitizeReturnTarget(raw){
    if(!raw)return 'index.html#dashboard';
    try{
      const url=new URL(raw,window.location.href);
      if(url.origin!==window.location.origin)return 'index.html#dashboard';
      const file=url.pathname.split('/').pop()||'index.html';
      const hash=String(url.hash||'').replace(/^#/,'').trim();
      if(/auth\.html$/i.test(file)||hash==='auth')return 'index.html#dashboard';
      return `${file}${url.search}${url.hash}`;
    }catch{
      return 'index.html#dashboard';
    }
  }
  function buildAuthUrl({mode='login',message='',returnTo=''}={}){
    const url=new URL('auth.html',window.location.href);
    if(mode)url.searchParams.set('mode',mode==='signup'?'signup':'login');
    if(message)url.searchParams.set('message',message);
    if(returnTo)url.searchParams.set('returnTo',returnTo);
    return url.toString();
  }
  function resolveReturnTarget(){
    const raw=new URLSearchParams(window.location.search).get('returnTo');
    return sanitizeReturnTarget(raw);
  }
  function openAuthPage(options={}){
    const nextUrl=buildAuthUrl({
      returnTo:sanitizeReturnTarget(options.returnTo||currentRelativeUrl()),
      ...options
    });
    window.location.href=nextUrl;
  }
  function readMainState(){
    const parsed=safeParse(localStorage.getItem(MAIN_STATE_KEY),DEFAULT_MAIN_STATE);
    return{
      ...DEFAULT_MAIN_STATE,
      ...parsed,
      topicStatus:parsed?.topicStatus||{},
      savedReactions:Array.isArray(parsed?.savedReactions)?parsed.savedReactions:[],
      quizHistory:Array.isArray(parsed?.quizHistory)?parsed.quizHistory:[],
      studyPlans:Array.isArray(parsed?.studyPlans)?parsed.studyPlans:[]
    };
  }
  function readBotState(){
    const parsed=safeParse(localStorage.getItem(BOT_STATE_KEY),DEFAULT_BOT_STATE);
    return{
      activeId:parsed?.activeId||'',
      sessions:Array.isArray(parsed?.sessions)?parsed.sessions:[]
    };
  }
  function snapshotLocalState(){
    return{
      mainState:readMainState(),
      botState:readBotState(),
      theme:localStorage.getItem(THEME_KEY)||document.body.getAttribute('data-theme')||'lab-noir'
    };
  }
  function hasLocalData(snapshot=snapshotLocalState()){
    const main=snapshot.mainState||DEFAULT_MAIN_STATE;
    const bot=snapshot.botState||DEFAULT_BOT_STATE;
    const hasMain=Object.keys(main.topicStatus||{}).length>0||(main.savedReactions||[]).length>0||(main.quizHistory||[]).length>0||(main.studyPlans||[]).length>0;
    const hasBot=(bot.sessions||[]).some(session=>(session.messages||[]).some(message=>message.role==='user'));
    const hasTheme=Boolean(snapshot.theme&&snapshot.theme!=='lab-noir');
    return hasMain||hasBot||hasTheme;
  }
  function isAuthenticated(){
    return Boolean(authState.user);
  }
  function normalizeHash(hash){
    return String(hash||window.location.hash||'#dashboard').replace(/^#/,'').trim()||'dashboard';
  }
  function resolvePanel(hash){
    const anchor=normalizeHash(hash);
    return{
      anchor,
      panel:PANEL_MAP[anchor]||'dashboard'
    };
  }
  function setText(id,value){
    const node=$(id);
    if(node)node.textContent=value;
  }
  function setHtml(id,value){
    const node=$(id);
    if(node)node.innerHTML=value;
  }
  function applyStoredThemePreference(){
    const savedTheme=localStorage.getItem(THEME_KEY);
    if(!savedTheme)return;
    document.body.setAttribute('data-theme',savedTheme);
    const themeLabel=$('themeLabel');
    if(themeLabel)themeLabel.textContent=THEME_LABELS[savedTheme]||savedTheme;
  }
  function setActivePanel(hash,{replace=false}={}){
    const route=resolvePanel(hash);
    const panels=[...document.querySelectorAll('.app-panel')];
    const hasAuthPanel=panels.some(panel=>panel.dataset.panel==='auth');
    if(route.panel==='auth'&&!hasAuthPanel&&!IS_AUTH_PAGE){
      openAuthPage({mode:'login'});
      return;
    }
    if(!panels.length){
      const anchorTarget=document.getElementById(route.anchor);
      if(anchorTarget){
        requestAnimationFrame(()=>anchorTarget.scrollIntoView({block:'start'}));
      }
      return;
    }
    panels.forEach(panel=>panel.classList.toggle('is-active',panel.dataset.panel===route.panel));
    document.querySelectorAll('[data-panel-link]').forEach(link=>link.classList.toggle('is-active',link.dataset.panelLink===route.panel));
    window.dispatchEvent(new CustomEvent('organo:panel-changed',{detail:{panel:route.panel,anchor:route.anchor}}));
    if(replace){
      history.replaceState(null,'',`#${route.anchor}`);
    }
    const anchorTarget=document.getElementById(route.anchor);
    if(anchorTarget){
      requestAnimationFrame(()=>anchorTarget.scrollIntoView({block:'start'}));
    }
  }

  async function apiJson(url,options={}){
    const response=await fetch(url,{
      headers:{
        Accept:'application/json',
        ...(options.body?{'Content-Type':'application/json'}:{})
      },
      credentials:'same-origin',
      ...options
    });
    const text=await response.text();
    const data=safeParse(text,{});
    if(!response.ok){
      const message=data?.error?.message||data?.message||'Request failed.';
      throw new Error(message);
    }
    return data;
  }

  function showMessage(id,message,type='info'){
    const node=$(id);
    if(!node)return;
    if(!message){
      node.hidden=true;
      node.textContent='';
      node.classList.remove('is-error');
      return;
    }
    node.hidden=false;
    node.textContent=message;
    node.classList.toggle('is-error',type==='error');
  }

  function setAuthMode(mode){
    currentAuthMode=mode==='signup'?'signup':'login';
    document.querySelectorAll('[data-auth-mode]').forEach(button=>button.classList.toggle('active',button.dataset.authMode===currentAuthMode));
    const loginForm=$('loginForm');
    const signupForm=$('signupForm');
    if(loginForm)loginForm.hidden=currentAuthMode!=='login';
    if(signupForm)signupForm.hidden=currentAuthMode!=='signup';
    setText('websiteAccountLabel',currentAuthMode==='signup'?'Create your OrganoChem account':'Sign in to your OrganoChem account');
    setText('websiteAccountLead',currentAuthMode==='signup'?'Create a dedicated website account to sync your chemistry progress, saved reactions, and bot history.':'Use your OrganoChem account to restore your saved study state, planner history, and chat sessions.');
  }
  function buildOAuthStartUrl(provider){
    const url=new URL('/api/auth/oauth/start',window.location.origin);
    url.searchParams.set('provider',provider);
    url.searchParams.set('returnTo',resolveReturnTarget());
    return url.toString();
  }

  function applyThemeLocally(theme){
    if(typeof window.setTheme==='function'){
      const button=document.querySelector(`.t-opt[onclick*="${theme}"]`);
      window.setTheme(theme,button||null);
      return;
    }
    document.body.setAttribute('data-theme',theme);
    localStorage.setItem(THEME_KEY,theme);
    const themeLabel=$('themeLabel');
    if(themeLabel)themeLabel.textContent=THEME_LABELS[theme]||theme;
  }

  function hydrateFromRemote(payload){
    if(!payload)return;
    if(payload.mainState){
      localStorage.setItem(MAIN_STATE_KEY,JSON.stringify(payload.mainState));
      const latestPlan=Array.isArray(payload.mainState.studyPlans)&&payload.mainState.studyPlans.length?payload.mainState.studyPlans[0]:null;
      if(latestPlan&&window.OrganoAI?.savePlannerCache){
        window.OrganoAI.savePlannerCache(latestPlan);
      }
      window.dispatchEvent(new CustomEvent('organo:hydrate-main-state',{detail:payload.mainState}));
    }
    if(payload.botState){
      localStorage.setItem(BOT_STATE_KEY,JSON.stringify(payload.botState));
      window.dispatchEvent(new CustomEvent('organo:hydrate-bot-state',{detail:payload.botState}));
    }
    if(payload.theme){
      applyThemeLocally(payload.theme);
    }
  }

  function updateLockedUI(){
    const locked=!isAuthenticated();
    document.querySelectorAll('[data-auth-required]').forEach(node=>{
      node.classList.toggle('is-locked',locked);
      if(node.matches('textarea,input'))node.readOnly=locked;
    });
    document.querySelectorAll('[data-auth-banner]').forEach(node=>{
      node.style.display=locked?'flex':'none';
    });
  }

  function clearLocalAccountState(){
    localStorage.setItem(MAIN_STATE_KEY,JSON.stringify(DEFAULT_MAIN_STATE));
    localStorage.setItem(BOT_STATE_KEY,JSON.stringify(DEFAULT_BOT_STATE));
    window.OrganoAI?.clearPlannerCache?.();
    window.dispatchEvent(new CustomEvent('organo:hydrate-main-state',{detail:DEFAULT_MAIN_STATE}));
    window.dispatchEvent(new CustomEvent('organo:hydrate-bot-state',{detail:DEFAULT_BOT_STATE}));
  }

  function updateAuthUI(){
    const user=authState.user;
    setText('authChipLabel',user?'Signed In':'Preview Mode');
    setText('headerAuthButtonLabel',user?'Account':'Log In');
    $('headerAuthButton')?.setAttribute('aria-label',user?'Open account':'User Login Button');
    setText('heroSessionState',user?`Signed in as ${user.displayName||user.email}`:'Preview access');
    setText('heroSessionCopy',user?'Your progress, theme, roadmaps, and chat history now sync through your account.':'Browse every panel freely, then sign in to unlock saved study state, planner history, and ORGANOBOT conversations.');
    setText('authSessionSummary',user?`Signed in as ${user.displayName||'Learner'} (${user.email}). Theme: ${user.theme||localStorage.getItem(THEME_KEY)||'lab-noir'}.`:'You are not signed in. Choose a provider or use your OrganoChem account to start a session.');
    const logoutButton=$('logoutButton');
    if(logoutButton)logoutButton.style.display=user?'inline-flex':'none';
    const authFormCard=$('authFormCard');
    if(authFormCard)authFormCard.hidden=Boolean(user);
    const accountCard=$('accountCard');
    if(accountCard)accountCard.hidden=!user;
    if(user){
      setText('accountName',user.displayName||'OrganoChem Account');
      setHtml('accountMeta',`<div><strong>Email</strong><div>${user.email}</div></div><div><strong>User ID</strong><div>${user.id}</div></div><div><strong>Theme</strong><div>${user.theme||localStorage.getItem(THEME_KEY)||'lab-noir'}</div></div>`);
    }
    updateLockedUI();
    window.dispatchEvent(new CustomEvent('organo:auth-changed',{detail:{user}}));
  }

  function focusWebsiteAccount(mode=currentAuthMode){
    setAuthMode(mode);
    const target=$('websiteAccount')||$('authFormCard');
    target?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function requireAuth(message){
    const nextMessage=message||'Sign in to unlock this feature.';
    if(IS_AUTH_PAGE){
      showMessage('authGateMessage',nextMessage);
      focusWebsiteAccount('login');
      return false;
    }
    openAuthPage({
      mode:'login',
      message:nextMessage
    });
    return false;
  }

  function queueSync(reason='state'){
    if(!isAuthenticated())return;
    clearTimeout(syncTimer);
    syncTimer=window.setTimeout(()=>syncRemoteState(reason),450);
  }

  async function syncRemoteState(reason='state'){
    if(!isAuthenticated()||authState.syncing)return;
    authState.syncing=true;
    try{
      await apiJson('/api/user-state',{
        method:'PUT',
        body:JSON.stringify({
          ...snapshotLocalState(),
          reason
        })
      });
    }catch(error){
      showMessage('authStatusMessage',`Account sync failed: ${error.message}`,'error');
    }finally{
      authState.syncing=false;
    }
  }

  async function loadRemoteState({allowImport=true}={}){
    if(!isAuthenticated())return;
    const data=await apiJson('/api/user-state');
    if(!data.hasData&&allowImport&&hasLocalData()){
      await apiJson('/api/user-state',{
        method:'PUT',
        body:JSON.stringify({
          ...snapshotLocalState(),
          importedFromLocal:true
        })
      });
      showMessage('authStatusMessage','Imported your existing browser progress into this account.');
      return loadRemoteState({allowImport:false});
    }
    if(data.payload){
      hydrateFromRemote(data.payload);
      if(data.user){
        authState.user=data.user;
      }
    }
    updateAuthUI();
  }

  async function loadSession(){
    authState.status='loading';
    try{
      const data=await apiJson('/api/auth/session');
      authState.user=data.user||null;
      updateAuthUI();
      if(authState.user){
        await loadRemoteState();
      }else{
        showMessage('authStatusMessage','');
      }
    }catch{
      authState.user=null;
      updateAuthUI();
    }finally{
      authState.status='ready';
    }
  }

  function redirectAfterAuth(){
    window.location.href=resolveReturnTarget();
  }

  async function handleLogin(event){
    event.preventDefault();
    showMessage('authStatusMessage','');
    showMessage('authGateMessage','');
    try{
      const data=await apiJson('/api/auth/login',{
        method:'POST',
        body:JSON.stringify({
          email:$('loginEmail')?.value.trim()||'',
          password:$('loginPassword')?.value||''
        })
      });
      authState.user=data.user;
      updateAuthUI();
      await loadRemoteState();
      $('loginForm')?.reset();
      if(IS_AUTH_PAGE){
        redirectAfterAuth();
        return;
      }
      showMessage('authStatusMessage','Login successful. Your account data is ready.');
      setActivePanel('dashboard');
    }catch(error){
      showMessage('authStatusMessage',error.message,'error');
    }
  }

  async function handleSignup(event){
    event.preventDefault();
    showMessage('authStatusMessage','');
    showMessage('authGateMessage','');
    try{
      const data=await apiJson('/api/auth/signup',{
        method:'POST',
        body:JSON.stringify({
          displayName:$('signupDisplayName')?.value.trim()||'',
          email:$('signupEmail')?.value.trim()||'',
          password:$('signupPassword')?.value||''
        })
      });
      authState.user=data.user;
      updateAuthUI();
      await loadRemoteState();
      $('signupForm')?.reset();
      if(IS_AUTH_PAGE){
        redirectAfterAuth();
        return;
      }
      showMessage('authStatusMessage','Account created. Your browser progress has been linked to this new account.');
      setActivePanel('dashboard');
    }catch(error){
      showMessage('authStatusMessage',error.message,'error');
    }
  }

  async function handleLogout(){
    showMessage('authStatusMessage','');
    try{
      await apiJson('/api/auth/logout',{method:'POST'});
      authState.user=null;
      clearLocalAccountState();
      updateAuthUI();
      showMessage('authStatusMessage','You have been logged out.');
      if(IS_AUTH_PAGE){
        setAuthMode('login');
        focusWebsiteAccount('login');
      }else{
        openAuthPage({mode:'login',returnTo:'index.html#dashboard'});
      }
    }catch(error){
      showMessage('authStatusMessage',error.message,'error');
    }
  }

  function handleProviderChoice(event){
    const provider=event.currentTarget.dataset.provider||'provider';
    window.location.href=buildOAuthStartUrl(provider);
  }

  function interceptLockedInteractions(){
    document.addEventListener('click',event=>{
      const locked=event.target.closest('[data-auth-required]');
      if(!locked||isAuthenticated())return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requireAuth(locked.dataset.authMessage);
    },true);
    document.addEventListener('submit',event=>{
      if(event.target.id==='chatForm'&&!isAuthenticated()){
        event.preventDefault();
        event.stopImmediatePropagation();
        requireAuth('Sign in to send questions to ORGANOBOT.');
      }
    },true);
    document.addEventListener('focusin',event=>{
      const locked=event.target.closest('[data-auth-required]');
      if(!locked||isAuthenticated())return;
      locked.blur?.();
    });
  }

  function bindUI(){
    window.addEventListener('hashchange',()=>setActivePanel(window.location.hash,{replace:true}));
    $('headerAuthButton')?.addEventListener('click',()=>{
      if(IS_AUTH_PAGE){
        const target=isAuthenticated()?$('accountCard'):$('websiteAccount');
        target?.scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }
      openAuthPage();
    });
    $('logoutButton')?.addEventListener('click',handleLogout);
    $('accountLogoutButton')?.addEventListener('click',handleLogout);
    $('accountRefreshButton')?.addEventListener('click',()=>loadRemoteState({allowImport:false}));
    $('loginForm')?.addEventListener('submit',handleLogin);
    $('signupForm')?.addEventListener('submit',handleSignup);
    document.querySelectorAll('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.authMode)));
    document.querySelectorAll('[data-provider]').forEach(button=>button.addEventListener('click',handleProviderChoice));
    window.addEventListener('organo:state-changed',event=>queueSync(event.detail?.key||'state'));
    window.addEventListener('organo:theme-changed',()=>queueSync('theme'));
    window.addEventListener('beforeunload',()=>{ if(syncTimer){ syncRemoteState('beforeunload'); } });
    interceptLockedInteractions();
  }

  function applyAuthPageIntent(){
    if(!IS_AUTH_PAGE)return;
    const params=new URLSearchParams(window.location.search);
    setAuthMode(params.get('mode')||'login');
    const message=params.get('message');
    if(message)showMessage('authGateMessage',message);
  }

  window.OrganoApp={
    isAuthenticated,
    requireAuth,
    assertFeatureAccess(message){return isAuthenticated()?true:requireAuth(message);},
    notifyStateChanged(key){queueSync(key||'state');},
    refreshRemoteState(){return loadRemoteState({allowImport:false});},
    getUser(){return authState.user;},
    setActivePanel
  };

  applyStoredThemePreference();
  bindUI();
  updateAuthUI();
  setAuthMode('login');
  applyAuthPageIntent();
  setActivePanel(window.location.hash||'#dashboard',{replace:!window.location.hash&&!IS_AUTH_PAGE});
  loadSession();
})();
