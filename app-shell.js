(function(){
  const MAIN_STATE_KEY='oc-state-v2';
  const THEME_KEY='oc-theme';
  const BOT_STATE_KEY='oc-organobot-history-v1';
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

  const authState={status:'loading',user:null,syncing:false};
  let currentAuthMode='login';
  let syncTimer=0;

  function $(id){return document.getElementById(id);}
  function safeParse(raw,fallback){
    try{return raw?JSON.parse(raw):fallback;}catch{return fallback;}
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
  function setActivePanel(hash,{replace=false}={}){
    const route=resolvePanel(hash);
    document.querySelectorAll('.app-panel').forEach(panel=>panel.classList.toggle('is-active',panel.dataset.panel===route.panel));
    document.querySelectorAll('[data-panel-link]').forEach(link=>link.classList.toggle('is-active',link.dataset.panelLink===route.panel));
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
        'Accept':'application/json',
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
    $('loginForm').hidden=currentAuthMode!=='login';
    $('signupForm').hidden=currentAuthMode!=='signup';
  }

  function applyThemeLocally(theme){
    if(typeof window.setTheme==='function'){
      const button=document.querySelector(`.t-opt[onclick*="${theme}"]`);
      window.setTheme(theme,button||null);
      return;
    }
    document.body.setAttribute('data-theme',theme);
    localStorage.setItem(THEME_KEY,theme);
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
    $('authChipLabel').textContent=user?'Signed In':'Preview Mode';
    $('headerAuthButton').textContent=user?'Account':'Sign In';
    $('heroSessionState').textContent=user?`Signed in as ${user.displayName||user.email}`:'Preview access';
    $('heroSessionCopy').textContent=user?'Your progress, theme, roadmaps, and chat history now sync through your account.':'Browse every panel freely, then sign in to unlock saved study state, planner history, and ORGANOBOT conversations.';
    $('authSessionSummary').textContent=user?`Signed in as ${user.displayName||'Learner'} (${user.email}). Theme: ${user.theme||localStorage.getItem(THEME_KEY)||'lab-noir'}.`:'You are not signed in. Use the forms to create an account or start a session.';
    $('logoutButton').style.display=user?'inline-flex':'none';
    $('authFormCard').hidden=Boolean(user);
    $('accountCard').hidden=!user;
    if(user){
      $('accountName').textContent=user.displayName||'OrganoChem Account';
      $('accountMeta').innerHTML=`<div><strong>Email</strong><div>${user.email}</div></div><div><strong>User ID</strong><div>${user.id}</div></div><div><strong>Theme</strong><div>${user.theme||localStorage.getItem(THEME_KEY)||'lab-noir'}</div></div>`;
    }
    updateLockedUI();
    window.dispatchEvent(new CustomEvent('organo:auth-changed',{detail:{user}}));
  }

  function requireAuth(message){
    showMessage('authGateMessage',message||'Sign in to unlock this feature.');
    setActivePanel('auth');
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

  async function handleLogin(event){
    event.preventDefault();
    showMessage('authStatusMessage','');
    showMessage('authGateMessage','');
    try{
      const data=await apiJson('/api/auth/login',{
        method:'POST',
        body:JSON.stringify({
          email:$('loginEmail').value.trim(),
          password:$('loginPassword').value
        })
      });
      authState.user=data.user;
      updateAuthUI();
      await loadRemoteState();
      $('loginForm').reset();
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
          displayName:$('signupDisplayName').value.trim(),
          email:$('signupEmail').value.trim(),
          password:$('signupPassword').value
        })
      });
      authState.user=data.user;
      updateAuthUI();
      await loadRemoteState();
      $('signupForm').reset();
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
      setActivePanel('auth');
    }catch(error){
      showMessage('authStatusMessage',error.message,'error');
    }
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
    $('headerAuthButton').addEventListener('click',()=>setActivePanel('auth'));
    $('logoutButton').addEventListener('click',handleLogout);
    $('accountLogoutButton').addEventListener('click',handleLogout);
    $('accountRefreshButton').addEventListener('click',()=>loadRemoteState({allowImport:false}));
    $('loginForm').addEventListener('submit',handleLogin);
    $('signupForm').addEventListener('submit',handleSignup);
    document.querySelectorAll('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.authMode)));
    window.addEventListener('organo:state-changed',event=>queueSync(event.detail?.key||'state'));
    window.addEventListener('organo:theme-changed',()=>queueSync('theme'));
    window.addEventListener('beforeunload',()=>{ if(syncTimer){ syncRemoteState('beforeunload'); } });
    interceptLockedInteractions();
  }

  window.OrganoApp={
    isAuthenticated,
    requireAuth,
    assertFeatureAccess(message){return isAuthenticated() ? true : requireAuth(message);},
    notifyStateChanged(key){queueSync(key||'state');},
    refreshRemoteState(){return loadRemoteState({allowImport:false});},
    getUser(){return authState.user;},
    setActivePanel
  };

  bindUI();
  updateAuthUI();
  setAuthMode('login');
  setActivePanel(window.location.hash||'#dashboard',{replace:!window.location.hash});
  loadSession();
})();
