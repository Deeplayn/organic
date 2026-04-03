const LABELS={'lab-noir':'Lab Noir','cyberpunk':'Cyberpunk','academic-ink':'Academic Ink','deep-space':'Deep Space','copper-reactor':'Copper Reactor','forest-glass':'Forest Glass','lab-white':'Lab White','neon-day':'Neon Day','ivory':'Ivory Academic','clean-slate':'Clean Slate','paper-spectrum':'Paper Spectrum','solar-lab':'Solar Lab'};
const STORE='oc-state-v2',THEME='oc-theme';
const baseState={topicStatus:{},savedReactions:[],quizHistory:[],studyPlans:[]};
const readState=()=>{try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');return{...baseState,...s,topicStatus:s.topicStatus||{},savedReactions:s.savedReactions||[],quizHistory:s.quizHistory||[],studyPlans:s.studyPlans||[]};}catch{return{...baseState};}};
let state=readState();
const saveState=()=>{
  localStorage.setItem(STORE,JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('organo:state-changed',{detail:{key:STORE}}));
};
const cv=p=>getComputedStyle(document.body).getPropertyValue(p).trim();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const prettyDate=v=>new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const today=()=>new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});
const AI=window.OrganoAI;
const canUseAccountFeature=message=>window.OrganoApp?.assertFeatureAccess(message)??true;
const PLANNER_TIMELINE_DEFAULTS={
  minDays:14,
  maxDays:112,
  stepDays:7,
  defaultDays:84
};

function togglePanel(){document.getElementById('themePanel').classList.toggle('open');}
function closePanel(){document.getElementById('themePanel').classList.remove('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.theme-switcher'))closePanel();});
function setTheme(theme,btn,options={}){
  document.body.setAttribute('data-theme',theme);
  document.getElementById('themeLabel').textContent=LABELS[theme];
  document.querySelectorAll('.t-opt').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  localStorage.setItem(THEME,theme);
  closePanel();
  window.dispatchEvent(new CustomEvent('organo:theme-changed',{detail:{theme,userInitiated:options.userInitiated!==false}}));
  setTimeout(()=>drawMol(currentMol,null),50);
}
const savedTheme=localStorage.getItem(THEME);
if(savedTheme&&LABELS[savedTheme])setTheme(savedTheme,document.querySelector(`.t-opt[onclick*="${savedTheme}"]`),{userInitiated:false});

const HERO_MOLECULE_SET_SIZE=4;
const HERO_MOLECULE_SET_KEY='oc-hero-molecule-set-v1';
let currentMol='ethanol',heroRotationTimer=null,heroRotationPausedUntil=0,heroMoleculeLineup=[];
const mols={
  ethanol:{name:'Ethanol',formula:'C2H5OH',info:'A compact primary alcohol used as a solvent and a foundational oxidation example in organic chemistry.',insight:'Hydroxyl groups raise polarity and hydrogen bonding.',prompt:'Compare ethanol oxidation to aldehydes and acids.',draw(s){const[a,a2,td,t,c,gd]=[cv('--accent'),cv('--accent2'),cv('--text-dim'),cv('--text'),cv('--card'),cv('--green-dim')];s.innerHTML=`<line x1="50" y1="100" x2="120" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="120" y1="100" x2="190" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="190" y1="100" x2="215" y2="78" stroke="${a2}" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="50" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="12">CH3</text><circle cx="155" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="155" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="12">CH2</text><circle cx="215" cy="73" r="16" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="215" y="73" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="11">OH</text><text x="130" y="132" text-anchor="middle" fill="${gd}" font-family="monospace" font-size="9">hydroxyl group</text>`;}},
  benzene:{name:'Benzene',formula:'C6H6',info:'A classic aromatic ring whose stability and substitution chemistry anchor much of organic reactivity.',insight:'Aromatic stabilization comes from a delocalized 6 pi system.',prompt:'Practice ortho/para versus meta directing effects.',draw(s){const[a3,td]=[cv('--accent3'),cv('--text-dim')],cx=130,cy=100,r=55,pts=[];for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}s.innerHTML=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a3}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="32" fill="none" stroke="${a3}" stroke-width="2" stroke-dasharray="6 4" opacity=".6"/>${pts.map((p,i)=>{const ang=Math.PI/3*i-Math.PI/6,hx=cx+(r+22)*Math.cos(ang),hy=cy+(r+22)*Math.sin(ang);return`<line x1="${p[0]}" y1="${p[1]}" x2="${hx}" y2="${hy}" stroke="${td}" stroke-width="1.5"/><text x="${hx}" y="${hy}" text-anchor="middle" dominant-baseline="central" fill="${td}" font-family="monospace" font-size="10">H</text>`;}).join('')}<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${a3}" font-family="monospace" font-size="9" opacity=".8">pi cloud</text>`;}},
  glucose:{name:'Glucose',formula:'C6H12O6',info:'A highly functionalized sugar that helps students connect stereochemistry, carbonyl chemistry, and cyclic forms.',insight:'Multiple alcohols make glucose highly polar and reactive.',prompt:'Contrast open-chain and cyclic forms.',draw(s){const[a,a2,a3,td,c]=[cv('--accent'),cv('--accent2'),cv('--accent3'),cv('--text-dim'),cv('--card')];s.innerHTML=`<line x1="50" y1="100" x2="210" y2="100" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="100" r="16" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="50" y="100" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="9">CHO</text>${[90,130,170].map(x=>`<circle cx="${x}" cy="80" r="13" fill="${c}" stroke="${a3}" stroke-width="1.5"/><text x="${x}" y="80" text-anchor="middle" dominant-baseline="central" fill="${a3}" font-family="monospace" font-size="8">OH</text><line x1="${x}" y1="100" x2="${x}" y2="80" stroke="${a3}" stroke-width="1.5"/>`).join('')}<circle cx="210" cy="100" r="16" fill="${c}" stroke="${a}" stroke-width="1.5"/><text x="210" y="100" text-anchor="middle" dominant-baseline="central" fill="${a}" font-family="monospace" font-size="8">CH2OH</text><text x="130" y="145" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">open-chain form</text>`;}},
  aspirin:{name:'Aspirin',formula:'C9H8O4',info:'A mixed-function aromatic drug scaffold that ties ester chemistry, acidity, and medicinal relevance together.',insight:'Aromatic, ester, and acid groups combine in one drug scaffold.',prompt:'Review how acetyl transfer changes reactivity.',draw(s){const[a,a2,a3,td,c]=[cv('--accent'),cv('--accent2'),cv('--accent3'),cv('--text-dim'),cv('--card')],cx=80,cy=100,r=45,pts=[];for(let i=0;i<6;i++){const ang=Math.PI/3*i-Math.PI/6;pts.push([cx+r*Math.cos(ang),cy+r*Math.sin(ang)]);}s.innerHTML=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a3}" stroke-width="2"/><line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[0][0]+45}" y2="${pts[0][1]-10}" stroke="${a2}" stroke-width="2"/><circle cx="${pts[0][0]+45}" cy="${pts[0][1]-10}" r="16" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="${pts[0][0]+45}" y="${pts[0][1]-10}" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="8">COOH</text><line x1="${pts[2][0]}" y1="${pts[2][1]}" x2="${pts[2][0]+30}" y2="${pts[2][1]+30}" stroke="${a}" stroke-width="2"/><circle cx="${pts[2][0]+30}" cy="${pts[2][1]+30}" r="18" fill="${c}" stroke="${a}" stroke-width="1.5"/><text x="${pts[2][0]+30}" y="${pts[2][1]+30}" text-anchor="middle" dominant-baseline="central" fill="${a}" font-family="monospace" font-size="8">OCOCH3</text><text x="80" y="165" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">acetylsalicylic acid</text>`;}},
  acetone:{name:'Acetone',formula:'C3H6O',info:'A compact ketone that makes carbonyl geometry and nucleophilic addition easier to visualize.',insight:'The carbonyl carbon is electrophilic and strongly shaped by the polarized C=O bond.',prompt:'Compare ketone reactivity with aldehydes in nucleophilic addition.',draw(s){const[a,a2,td,t,c]=[cv('--accent'),cv('--accent2'),cv('--text-dim'),cv('--text'),cv('--card')];s.innerHTML=`<circle cx="55" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="55" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="11">CH3</text><line x1="73" y1="100" x2="120" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="120" y1="100" x2="168" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="123" y1="94" x2="165" y2="72" stroke="${a2}" stroke-width="2.4" stroke-linecap="round"/><line x1="129" y1="100" x2="171" y2="78" stroke="${a2}" stroke-width="2.4" stroke-linecap="round"/><circle cx="205" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="205" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="11">CH3</text><circle cx="178" cy="75" r="15" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="178" y="75" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="11">O</text><text x="130" y="145" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">ketone carbonyl</text>`;}},
  aceticacid:{name:'Acetic Acid',formula:'CH3COOH',info:'A small carboxylic acid that connects acidity, resonance, and common acyl chemistry in one structure.',insight:'The carboxyl group balances acidity with resonance stabilization.',prompt:'Track why carboxylic acids are more acidic than alcohols.',draw(s){const[a,a2,td,t,c]=[cv('--accent'),cv('--accent2'),cv('--text-dim'),cv('--text'),cv('--card')];s.innerHTML=`<circle cx="58" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="58" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="11">CH3</text><line x1="76" y1="100" x2="124" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="127" y1="95" x2="168" y2="72" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><line x1="133" y1="101" x2="174" y2="78" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><line x1="130" y1="100" x2="182" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><circle cx="180" cy="75" r="14" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="180" y="75" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="10">O</text><circle cx="212" cy="100" r="16" fill="${c}" stroke="${a}" stroke-width="1.5"/><text x="212" y="100" text-anchor="middle" dominant-baseline="central" fill="${a}" font-family="monospace" font-size="10">OH</text><text x="134" y="145" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">carboxyl group</text>`;}},
  aniline:{name:'Aniline',formula:'C6H5NH2',info:'An aromatic amine that is perfect for discussing resonance donation and electrophilic substitution behavior.',insight:'The amine lone pair can donate into the ring and strongly change reactivity.',prompt:'Connect aniline to ortho/para directing effects in aromatic substitution.',draw(s){const[a,a2,td,c]=[cv('--accent3'),cv('--accent'),cv('--text-dim'),cv('--card')],cx=96,cy=100,r=42,pts=[];for(let i=0;i<6;i++){const ang=Math.PI/3*i-Math.PI/6;pts.push([cx+r*Math.cos(ang),cy+r*Math.sin(ang)]);}const attach=pts[0];s.innerHTML=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a}" stroke-width="2.3"/><line x1="${attach[0]}" y1="${attach[1]}" x2="${attach[0]+40}" y2="${attach[1]-6}" stroke="${a2}" stroke-width="2.4"/><circle cx="${attach[0]+64}" cy="${attach[1]-10}" r="18" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="${attach[0]+64}" y="${attach[1]-10}" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="10">NH2</text><text x="96" y="162" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">aromatic amine</text>`;}},
  cyclohexane:{name:'Cyclohexane',formula:'C6H12',info:'A flexible saturated ring that helps learners think about conformation instead of aromaticity.',insight:'Cyclohexane stability is mostly a story about chair conformations and strain minimization.',prompt:'Compare the chair form to the aromatic flatness of benzene.',draw(s){const[a,td]=[cv('--accent2'),cv('--text-dim')],pts=[[60,110],[105,80],[160,90],[200,120],[155,150],[95,145]];s.innerHTML=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a}" stroke-width="3" stroke-linejoin="round"/><text x="130" y="176" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">chair-like ring sketch</text>`;}},
  acetaldehyde:{name:'Acetaldehyde',formula:'CH3CHO',info:'A small aldehyde that makes carbonyl electrophilicity and oxidation patterns easy to compare.',insight:'Aldehydes are usually more reactive than ketones because steric and donating effects are lower.',prompt:'Compare aldehyde and ketone reactivity using nucleophilic addition examples.',draw(s){const[a,a2,td,t,c]=[cv('--accent'),cv('--accent2'),cv('--text-dim'),cv('--text'),cv('--card')];s.innerHTML=`<circle cx="62" cy="100" r="18" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="62" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="11">CH3</text><line x1="80" y1="100" x2="125" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="129" y1="95" x2="170" y2="72" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><line x1="135" y1="101" x2="176" y2="78" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><circle cx="182" cy="75" r="14" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="182" y="75" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="10">O</text><circle cx="198" cy="100" r="12" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="198" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="10">H</text><text x="132" y="145" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">aldehyde carbonyl</text>`;}},
  ethylacetate:{name:'Ethyl Acetate',formula:'C4H8O2',info:'A common ester that ties together carbonyl chemistry, resonance, and hydrolysis pathways.',insight:'Esters are resonance-stabilized yet still reactive enough for hydrolysis and transesterification.',prompt:'Review why esters react differently from acids, aldehydes, and ketones.',draw(s){const[a,a2,td,t,c]=[cv('--accent'),cv('--accent3'),cv('--text-dim'),cv('--text'),cv('--card')];s.innerHTML=`<circle cx="34" cy="100" r="16" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="34" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="9">CH3</text><line x1="50" y1="100" x2="88" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><line x1="92" y1="96" x2="126" y2="74" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><line x1="98" y1="102" x2="132" y2="80" stroke="${a2}" stroke-width="2.3" stroke-linecap="round"/><circle cx="144" cy="76" r="14" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="144" y="76" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="10">O</text><line x1="88" y1="100" x2="140" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><circle cx="160" cy="100" r="14" fill="${c}" stroke="${a}" stroke-width="1.5"/><text x="160" y="100" text-anchor="middle" dominant-baseline="central" fill="${a}" font-family="monospace" font-size="10">O</text><line x1="174" y1="100" x2="204" y2="100" stroke="${a}" stroke-width="3" stroke-linecap="round"/><circle cx="224" cy="100" r="16" fill="${c}" stroke="${td}" stroke-width="1.5"/><text x="224" y="100" text-anchor="middle" dominant-baseline="central" fill="${t}" font-family="monospace" font-size="9">CH2</text>`;}},
  toluene:{name:'Toluene',formula:'C7H8',info:'An aromatic ring with an alkyl substituent that is useful for discussing activation and directing effects.',insight:'An alkyl group donates weakly and pushes substitution toward ortho and para positions.',prompt:'Use toluene to compare activating and deactivating aromatic substituents.',draw(s){const[a,a2,td,c]=[cv('--accent3'),cv('--accent2'),cv('--text-dim'),cv('--card')],cx=98,cy=100,r=42,pts=[];for(let i=0;i<6;i++){const ang=Math.PI/3*i-Math.PI/6;pts.push([cx+r*Math.cos(ang),cy+r*Math.sin(ang)]);}const attach=pts[5];s.innerHTML=`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${a}" stroke-width="2.3"/><line x1="${attach[0]}" y1="${attach[1]}" x2="${attach[0]-38}" y2="${attach[1]+10}" stroke="${a2}" stroke-width="2.4"/><circle cx="${attach[0]-56}" cy="${attach[1]+14}" r="16" fill="${c}" stroke="${a2}" stroke-width="1.5"/><text x="${attach[0]-56}" y="${attach[1]+14}" text-anchor="middle" dominant-baseline="central" fill="${a2}" font-family="monospace" font-size="9">CH3</text><text x="98" y="162" text-anchor="middle" fill="${td}" font-family="monospace" font-size="9">alkyl-substituted arene</text>`;}}
};
function shuffleList(list){
  const copy=[...list];
  for(let index=copy.length-1;index>0;index-=1){
    const swapIndex=Math.floor(Math.random()*(index+1));
    [copy[index],copy[swapIndex]]=[copy[swapIndex],copy[index]];
  }
  return copy;
}
function pickRandomItems(list,count){
  return shuffleList(list).slice(0,Math.min(count,list.length));
}
function readPreviousHeroLineup(){
  try{
    const parsed=JSON.parse(localStorage.getItem(HERO_MOLECULE_SET_KEY)||'[]');
    return Array.isArray(parsed)?parsed.filter(name=>mols[name]):[];
  }catch{
    return[];
  }
}
function lineupOverlap(a,b){
  const set=new Set(b);
  return a.reduce((count,name)=>count+(set.has(name)?1:0),0);
}
function pickHeroMoleculeLineup(){
  const names=Object.keys(mols);
  if(names.length<=HERO_MOLECULE_SET_SIZE)return names;
  const previous=readPreviousHeroLineup();
  let bestLineup=pickRandomItems(names,HERO_MOLECULE_SET_SIZE);
  let bestOverlap=lineupOverlap(bestLineup,previous);
  for(let attempt=0;attempt<36&&bestOverlap>0;attempt+=1){
    const candidate=pickRandomItems(names,HERO_MOLECULE_SET_SIZE);
    const overlap=lineupOverlap(candidate,previous);
    if(overlap<bestOverlap){
      bestLineup=candidate;
      bestOverlap=overlap;
    }
  }
  localStorage.setItem(HERO_MOLECULE_SET_KEY,JSON.stringify(bestLineup));
  return bestLineup;
}
function renderHeroMoleculeButtons(){
  const row=document.getElementById('heroMoleculeButtons');
  if(!row)return;
  row.innerHTML=heroMoleculeLineup.map(name=>`<button class="rxn-btn ${name===currentMol?'active':''}" type="button" data-mol="${esc(name)}">${esc(mols[name].name)}</button>`).join('');
  row.querySelectorAll('[data-mol]').forEach(button=>button.addEventListener('click',()=>drawMol(button.dataset.mol||'',button,{manual:true})));
}
function pruneHeroMoleculeCaptions(svg){
  if(!svg)return;
  [...svg.querySelectorAll('text')].forEach(node=>{
    const y=Number(node.getAttribute('y'));
    if(Number.isFinite(y)&&y>=130){
      node.remove();
    }
  });
}
function drawMol(name,btn,options={}){
  const mol=mols[name];
  const wrap=document.getElementById('heroMol');
  if(!mol||!wrap)return;
  if(options.manual)heroRotationPausedUntil=Date.now()+20000;
  wrap.classList.remove('is-switching');
  void wrap.offsetWidth;
  wrap.classList.add('is-switching');
  currentMol=name;
  const svg=document.getElementById('molSvg');
  mol.draw(svg);
  pruneHeroMoleculeCaptions(svg);
  document.getElementById('molName').textContent=mol.name;
  document.getElementById('molFormula').textContent=mol.formula;
  document.getElementById('moleculeInfo').textContent=mol.info;
  document.getElementById('moleculeInsight').textContent=mol.insight;
  document.getElementById('moleculeStudyPrompt').textContent=mol.prompt;
  document.querySelectorAll('#heroMol .rxn-btn').forEach(b=>b.classList.remove('active'));
  const activeBtn=btn||document.querySelector(`#heroMol .rxn-btn[data-mol="${name}"]`);
  if(activeBtn)activeBtn.classList.add('active');
  clearTimeout(drawMol.fxTimer);
  drawMol.fxTimer=setTimeout(()=>wrap.classList.remove('is-switching'),520);
}

function startHeroRotation(){
  const names=heroMoleculeLineup.length?heroMoleculeLineup:[...Object.keys(mols)];
  if(names.length<2)return;
  clearInterval(heroRotationTimer);
  heroRotationTimer=setInterval(()=>{
    if(Date.now()<heroRotationPausedUntil)return;
    const currentIndex=Math.max(0,names.indexOf(currentMol));
    const nextName=names[(currentIndex+1)%names.length];
    drawMol(nextName,null,{manual:false});
  },6500);
}

const topics=[
  {id:'functional-groups',icon:'FG',className:'card-green',title:'Functional Groups',difficulty:'Beginner',description:'Identify the groups that control naming and reactivity.',tags:['Alcohols','Carbonyls','Amines'],overview:'Train fast group recognition, rough reactivity, and naming links.',goals:['Spot major groups in skeletal and condensed structures.','Connect groups to naming suffixes.','Predict broad polarity and reactivity.'],pitfalls:['Mixing aldehydes with ketones.','Treating phenols like ordinary alcohols.','Ignoring resonance in acyl derivatives.']},
  {id:'reaction-mechanisms',icon:'RXN',className:'card-amber',title:'Reaction Mechanisms',difficulty:'Intermediate',description:'Choose pathways using substrate, reagent, and solvent clues.',tags:['SN1/SN2','E1/E2','Arrows'],overview:'Compare substitution and elimination by sterics, solvent, and leaving groups.',goals:['Pick the dominant pathway from conditions.','Track bonds with correct arrow pushing.','Predict stereochemical outcomes.'],pitfalls:['Assuming strong nucleophile always means SN2.','Forgetting heat helps elimination.','Missing carbocation rearrangements.']},
  {id:'iupac-naming',icon:'IUPAC',className:'card-blue',title:'IUPAC Naming',difficulty:'Beginner',description:'Build correct names from parent chains and priority rules.',tags:['Parent chain','Locants','Priority'],overview:'Translate structures into systematic names without losing important details.',goals:['Choose the right parent chain.','Assign locants correctly.','Handle substituent order cleanly.'],pitfalls:['Choosing longest chain instead of highest-priority chain.','Dropping multiple-bond locants.','Alphabetizing prefixes incorrectly.']},
  {id:'stereochemistry',icon:'3D',className:'card-red',title:'Stereochemistry',difficulty:'Advanced',description:'Work in 3D with chirality and reaction outcomes.',tags:['R/S','Chirality','Enantiomers'],overview:'Use spatial reasoning to classify isomers and predict stereochemical change.',goals:['Assign R/S accurately.','Read wedge-dash and Fischer forms.','Predict inversion, retention, or scrambling.'],pitfalls:['Not pointing lowest priority away.','Confusing meso with enantiomers.','Treating conformers as distinct configurations.']},
  {id:'aromatic-chemistry',icon:'Ar',className:'card-purple',title:'Aromatic Chemistry',difficulty:'Intermediate',description:'Apply Huckel rule and directing effects on aromatic rings.',tags:['EAS','Directors','Huckel'],overview:'Protect aromaticity while predicting where substitution happens.',goals:['Test aromaticity correctly.','Predict ortho/para versus meta.','Explain substitution over addition.'],pitfalls:['Counting the wrong electrons.','Ignoring director effects.','Forgetting aromaticity must be restored.']},
  {id:'spectroscopy',icon:'NMR',className:'card-green2',title:'Spectroscopy',difficulty:'Advanced',description:'Use IR, NMR, and MS data to identify compounds.',tags:['1H NMR','IR','MS'],overview:'Combine several spectral clues into one structure argument.',goals:['Use IR as the quick filter.','Read NMR shift, splitting, and integration together.','Use fragments and patterns to narrow structures.'],pitfalls:['Over-trusting one peak.','Missing symmetry.','Ignoring exchangeable protons.']}
];

const reactions={
  sn2:{name:'SN2',quick:'One-step substitution with inversion.',tags:['Primary','Polar aprotic','Strong nucleophile'],display:`<div class="rxn-compound"><div>R-X</div><div class="formula">alkyl halide</div><div class="name">electrophile</div></div><div>+</div><div class="rxn-compound"><div>Nu<sup>-</sup></div><div class="formula">nucleophile</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">concerted step</div></div><div class="rxn-compound"><div>R-Nu</div><div class="formula">product</div><div class="name">inversion</div></div><div>+</div><div class="rxn-compound"><div>X<sup>-</sup></div><div class="formula">leaving group</div></div>`,info:['Best with methyl or primary substrates.','Backside attack gives inversion.','Secondary systems may compete with E2.','Look for strong nucleophile plus low sterics.']},
  sn1:{name:'SN1',quick:'Two-step substitution through a carbocation.',tags:['Tertiary','Polar protic','Carbocation'],display:`<div class="rxn-compound"><div>R-X</div><div class="formula">substrate</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">ionization</div></div><div class="rxn-compound"><div>R<sup>+</sup></div><div class="formula">carbocation</div><div class="name">planar</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">attack</div></div><div class="rxn-compound"><div>R-Nu</div><div class="formula">product</div><div class="name">racemized tendency</div></div>`,info:['Tertiary or resonance-stabilized centers help.','Planar carbocation can scramble stereochemistry.','Rearrangements are possible.','Weak nucleophile plus protic solvent is a classic clue.']},
  aldol:{name:'Aldol',quick:'Enolate chemistry that builds C-C bonds.',tags:['Enolate','Carbonyls','C-C formation'],display:`<div class="rxn-compound"><div>2 R-CHO</div><div class="formula">carbonyl partners</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">base, H2O</div></div><div class="rxn-compound"><div>beta-hydroxy carbonyl</div><div class="formula">addition</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">heat</div></div><div class="rxn-compound"><div>alpha,beta-unsaturated carbonyl</div><div class="formula">condensation</div></div>`,info:['Needs an enolate donor.','Often ends with dehydration.','Great for forming a new C-C bond.','Check for alpha hydrogens first.']},
  diels:{name:'Diels-Alder',quick:'Concerted [4+2] cycloaddition.',tags:['Pericyclic','s-cis diene','Stereospecific'],display:`<div class="rxn-compound"><div>diene</div><div class="formula">s-cis</div></div><div>+</div><div class="rxn-compound"><div>dienophile</div><div class="formula">activated alkene</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">concerted [4+2]</div></div><div class="rxn-compound"><div>cyclohexene derivative</div><div class="formula">new ring</div><div class="name">endo often favored</div></div>`,info:['Forms a six-membered ring in one step.','The diene must access s-cis.','Relative stereochemistry is preserved.','Electron-poor dienophiles react best.']},
  grignard:{name:'Grignard',quick:'Organomagnesium behaves like a carbon nucleophile.',tags:['Anhydrous','Carbonyl addition','C-C formation'],display:`<div class="rxn-compound"><div>R-MgX</div><div class="formula">Grignard</div></div><div>+</div><div class="rxn-compound"><div>R&apos;CHO</div><div class="formula">carbonyl</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">1. ether 2. H3O<sup>+</sup></div></div><div class="rxn-compound"><div>R-C(OH)-R&apos;</div><div class="formula">alcohol</div></div>`,info:['Water destroys the reagent.','Use dry ether conditions.','Excellent for chain extension.','Product class depends on carbonyl type.']},
  eas:{name:'EAS',quick:'Aromatic substitution that restores aromaticity.',tags:['Aromaticity','Directing effects','Lewis acid'],display:`<div class="rxn-compound"><div>ArH</div><div class="formula">arene</div></div><div>+</div><div class="rxn-compound"><div>E<sup>+</sup></div><div class="formula">electrophile</div></div><div class="rxn-arrow">&rarr;<div class="rxn-condition">Lewis acid</div></div><div class="rxn-compound"><div>Ar-E</div><div class="formula">substituted arene</div><div class="name">aromaticity restored</div></div>`,info:['Use director effects before choosing the product.','Substitution wins because aromaticity matters.','Common cases: nitration, halogenation, Friedel-Crafts.','Meta directors withdraw strongly.']}
};
state.savedReactions=state.savedReactions.filter(id=>reactions[id]);

const refs=[
  ['Alcohol','Alcohols & Ethers','-ol','-OH','Hydrogen bonding, nucleophilic oxygen','Beginner'],
  ['Ether','Alcohols & Ethers','-oxy-','-O-','Relatively inert, weakly polar','Beginner'],
  ['Phenol','Alcohols & Ethers','phenol','Ar-OH','Acidic relative to alcohols','Intermediate'],
  ['Epoxide','Alcohols & Ethers','epoxy-','cyclic -O-','Ring strain boosts reactivity','Advanced'],
  ['Aldehyde','Carbonyls','-al','-CHO','Electrophilic and easily oxidized','Beginner'],
  ['Ketone','Carbonyls','-one','-CO-','Less reactive than aldehydes','Beginner'],
  ['Carboxylic Acid','Carbonyls','-oic acid','-COOH','Acidic and H-bonding','Intermediate'],
  ['Ester','Carbonyls','-oate','-COO-','Hydrolyzable and resonance stabilized','Intermediate'],
  ['Amide','Carbonyls','-amide','-CONH2','Strong resonance stabilization','Advanced'],
  ['Acid Chloride','Carbonyls','-oyl chloride','-COCl','Very reactive acyl transfer reagent','Advanced'],
  ['Primary Amine','Nitrogen Compounds','-amine','-NH2','Basic and nucleophilic','Beginner'],
  ['Secondary Amine','Nitrogen Compounds','-amine','-NH-','Basic, more hindered','Intermediate'],
  ['Nitro','Nitrogen Compounds','nitro-','-NO2','Strong electron-withdrawing group','Intermediate'],
  ['Nitrile','Nitrogen Compounds','-nitrile','-C≡N','Hydrolysis can give acids','Advanced'],
  ['Alkane','Hydrocarbons','-ane','C-C only','Saturated and low reactivity','Beginner'],
  ['Alkene','Hydrocarbons','-ene','C=C','Pi bond enables additions','Beginner'],
  ['Alkyne','Hydrocarbons','-yne','C≡C','Linear and terminal H can be acidic','Intermediate'],
  ['Benzene','Hydrocarbons','-benzene','aromatic ring','Delocalized aromatic stabilization','Intermediate']
];

const bank=[
  {q:'Which group defines an alcohol?',opts:['-COOH','-OH','-CHO','-NH2'],ans:1,exp:'Alcohols contain -OH.',cat:'Functional Groups',diff:'Beginner'},
  {q:'What suffix is used for ketones?',opts:['-ol','-al','-one','-yne'],ans:2,exp:'Ketones use -one.',cat:'IUPAC Naming',diff:'Beginner'},
  {q:'SN2 gives what stereochemical result?',opts:['Retention','Racemization','Inversion','No pattern'],ans:2,exp:'Backside attack gives inversion.',cat:'Reaction Mechanisms',diff:'Intermediate'},
  {q:'Which solvent best favors SN2?',opts:['Water','Ethanol','DMSO','Acetic acid'],ans:2,exp:'Polar aprotic solvents help SN2.',cat:'Reaction Mechanisms',diff:'Intermediate'},
  {q:'Benzene has how many pi electrons?',opts:['4','6','8','10'],ans:1,exp:'Benzene has 6 pi electrons.',cat:'Aromatic Chemistry',diff:'Beginner'},
  {q:'R configuration is assigned when the priority path appears:',opts:['Clockwise','Counterclockwise','Random','Planar'],ans:0,exp:'Clockwise with lowest priority away gives R.',cat:'Stereochemistry',diff:'Advanced'},
  {q:'Which reagent oxidizes a primary alcohol to an aldehyde without over-oxidation?',opts:['KMnO4','PCC','H2CrO4','O3/Zn'],ans:1,exp:'PCC stops at the aldehyde.',cat:'Reaction Mechanisms',diff:'Intermediate'},
  {q:'A Diels-Alder reaction forms what ring size?',opts:['4-membered','5-membered','6-membered','7-membered'],ans:2,exp:'A [4+2] cycloaddition gives a 6-membered ring.',cat:'Reaction Mechanisms',diff:'Intermediate'},
  {q:'Which condition most strongly pushes a secondary alkyl halide toward E2 instead of SN2?',opts:['Strong bulky base','Weak nucleophile in water','No leaving group','Cold dilute acid'],ans:0,exp:'Strong bulky bases favor elimination, especially on secondary substrates.',cat:'Reaction Mechanisms',diff:'Intermediate'},
  {q:'Which carbonyl is usually more reactive toward nucleophilic addition?',opts:['Ketone','Aldehyde','Amide','Ester'],ans:1,exp:'Aldehydes are usually more reactive.',cat:'Functional Groups',diff:'Intermediate'},
  {q:'The parent chain in IUPAC naming must contain the:',opts:['Most branches','Highest-priority functional group','Most halogens','Largest mass'],ans:1,exp:'Priority beats simple chain length.',cat:'IUPAC Naming',diff:'Intermediate'},
  {q:'Which group is meta-directing in EAS?',opts:['-OH','-CH3','-NO2','-NH2'],ans:2,exp:'Nitro is strongly meta-directing.',cat:'Aromatic Chemistry',diff:'Intermediate'},
  {q:'A strong IR absorption near 1700 cm^-1 usually indicates a:',opts:['Carbonyl','Alcohol','Alkene','Amine'],ans:0,exp:'That is the classic carbonyl region.',cat:'Spectroscopy',diff:'Beginner'},
  {q:'A meso compound must contain:',opts:['No stereocenters','An internal plane of symmetry','A carbocation','Only one stereocenter'],ans:1,exp:'Meso compounds are achiral due to symmetry.',cat:'Stereochemistry',diff:'Advanced'},
  {q:'Which group commonly hydrolyzes to an alcohol plus acid?',opts:['Ether','Ester','Alkane','Arene'],ans:1,exp:'Ester hydrolysis gives acid and alcohol.',cat:'Functional Groups',diff:'Intermediate'},
  {q:'Terminal alkynes are notable because they are relatively:',opts:['Acidic','Aromatic','Unreactive','Chiral'],ans:0,exp:'Terminal alkyne hydrogens are relatively acidic.',cat:'Functional Groups',diff:'Intermediate'},
  {q:'In 1H NMR, integration tells you the relative:',opts:['Molecular weight','Signal shape','Number of hydrogens','Coupling constant'],ans:2,exp:'Integration estimates relative proton count.',cat:'Spectroscopy',diff:'Intermediate'},
  {q:'Which functional group contains a carbonyl directly bonded to hydrogen?',opts:['Ketone','Aldehyde','Ester','Amide'],ans:1,exp:'Aldehydes have a carbonyl carbon bonded to at least one hydrogen.',cat:'Functional Groups',diff:'Beginner'},
  {q:'Which suffix is used for carboxylic acids?',opts:['-oic acid','-one','-ol','-ene'],ans:0,exp:'Carboxylic acids use the suffix -oic acid.',cat:'IUPAC Naming',diff:'Beginner'},
  {q:'What numbering rule comes first in IUPAC naming?',opts:['Give the lowest numbers to halogens','Give the lowest number to the highest-priority group','Start from the left every time','Use alphabetical order only'],ans:1,exp:'The highest-priority functional group controls numbering.',cat:'IUPAC Naming',diff:'Intermediate'},
  {q:'How are identical substituents indicated in IUPAC names?',opts:['mono-, bi-, tri-','di-, tri-, tetra-','sec-, tert-, neo-','R-, S-, E-'],ans:1,exp:'Repeated substituents use multiplicative prefixes such as di-, tri-, and tetra-.',cat:'IUPAC Naming',diff:'Beginner'},
  {q:'A chiral center usually has how many different substituents attached?',opts:['Two','Three','Four','Five'],ans:2,exp:'A tetrahedral stereocenter is chiral when four different substituents are attached.',cat:'Stereochemistry',diff:'Beginner'},
  {q:'If the lowest-priority group points toward you, the R/S result should be:',opts:['Kept as drawn','Ignored','Reversed','Averaged'],ans:2,exp:'When the lowest-priority group points toward you, the observed direction is reversed.',cat:'Stereochemistry',diff:'Intermediate'},
  {q:'An SN1 reaction at a stereocenter most often gives:',opts:['Complete inversion only','Complete retention only','A racemized mixture tendency','No substitution'],ans:2,exp:'SN1 passes through a planar carbocation, so stereochemistry is often scrambled.',cat:'Stereochemistry',diff:'Intermediate'},
  {q:'Which substituent is strongly ortho/para-directing in electrophilic aromatic substitution?',opts:['-NO2','-CF3','-OH','-CN'],ans:2,exp:'Electron-donating groups like -OH activate the ring and direct ortho/para.',cat:'Aromatic Chemistry',diff:'Intermediate'},
  {q:'Why does benzene prefer substitution over addition?',opts:['Addition is faster','Substitution preserves aromaticity','Addition needs a metal catalyst','Substitution removes all pi electrons'],ans:1,exp:'Aromatic substitution restores the aromatic system, while addition would break it.',cat:'Aromatic Chemistry',diff:'Intermediate'},
  {q:'A ring is aromatic when it is cyclic, planar, conjugated, and has:',opts:['4n pi electrons','2n pi electrons','4n + 2 pi electrons','Any even number of pi electrons'],ans:2,exp:'Huckel aromatic systems follow the 4n + 2 pi-electron rule.',cat:'Aromatic Chemistry',diff:'Beginner'},
  {q:'A broad IR absorption around 3200-3600 cm^-1 is often associated with:',opts:['C=O stretch','O-H stretch','C=C stretch','C-H bend'],ans:1,exp:'Alcohol and carboxylic acid O-H stretches often appear broad in this region.',cat:'Spectroscopy',diff:'Beginner'},
  {q:'In 1H NMR, a triplet usually suggests how many neighboring hydrogens?',opts:['0','1','2','3'],ans:2,exp:'The n+1 rule gives a triplet when a signal has two neighboring hydrogens.',cat:'Spectroscopy',diff:'Intermediate'},
  {q:'The molecular ion peak in mass spectrometry is especially useful for estimating:',opts:['Boiling point','Molecular mass','Solubility','Acidity'],ans:1,exp:'The molecular ion gives a direct clue about the compound molecular mass.',cat:'Spectroscopy',diff:'Advanced'}
];

let activeTopic=topics[0].id,currentReaction='sn2',quiz=[],qi=0,score=0,answered=false,quizMeta={category:'All categories',difficulty:'Mixed difficulty'},catResults={};
const topicStatus=id=>state.topicStatus[id]||'new';
const statusLabel=s=>s==='confident'?'Confident':s==='review'?'Needs review':'Unmarked';
const curriculumData=window.OrganoCurriculumData||{countries:[],entries:[]};
let activeCurriculumCountry=curriculumData.countries[0]||'';

const curriculumTopicTitle=topic=>typeof topic==='string'?topic:topic?.title||'';
const curriculumTopicLessonSlug=topic=>typeof topic==='string'?'':topic?.lessonSlug||'';
const curriculumLevelLabel=level=>level==='high-school'?'High School':'University';
const curriculumSourceTypeLabel=type=>String(type||'source').replaceAll('-',' ').replace(/\b\w/g,char=>char.toUpperCase());
const curriculumSourceNote=source=>source?.note||`${curriculumSourceTypeLabel(source?.type)} reference kept in the app for quick comparison.`;
const curriculumLevelStartingLevel=level=>level==='university'?'Intermediate':'Beginner';

function getSignedInProfile(){
  return window.OrganoApp?.getProfile?.()||{};
}

function getAssignedCurriculumEntry(){
  const track=getSignedInProfile().curriculumTrack;
  if(!track)return null;
  return curriculumData.entries.find(entry=>entry.title===track)||null;
}

function curriculumTopicToCategory(topic){
  const slug=curriculumTopicLessonSlug(topic);
  if(slug){
    return topics.find(item=>item.id===slug)?.title||'';
  }
  const text=curriculumTopicTitle(topic).toLowerCase();
  if(/stereo|isomer|conformation|chiral|configuration/.test(text))return'Stereochemistry';
  if(/aromatic|benzene|arene/.test(text))return'Aromatic Chemistry';
  if(/spectro|nmr|ir|mass|ms|chromatography|identification/.test(text))return'Spectroscopy';
  if(/mechanism|substitution|elimination|addition|synthesis|reaction/.test(text))return'Reaction Mechanisms';
  if(/naming|formula|locant/.test(text))return'IUPAC Naming';
  if(/functional group|alcohol|ether|aldehyde|ketone|acid|amine|amide|ester|carbonyl|hydrocarbon|alkane|alkene|alkyne|organic molecules|resonance|acid-base/.test(text))return'Functional Groups';
  return'';
}

function getCurriculumPriorityTopics(entry=getAssignedCurriculumEntry()){
  if(!entry)return[];
  return[...new Set((entry.topics||[]).map(curriculumTopicToCategory).filter(Boolean))];
}

function getCurriculumTopicLabels(entry=getAssignedCurriculumEntry()){
  return entry?(entry.topics||[]).map(curriculumTopicTitle).filter(Boolean):[];
}

function renderPlannerCurriculumSummary(){
  const node=document.getElementById('plannerCurriculumSummary');
  if(!node)return;
  if(!window.OrganoApp?.isAuthenticated?.()){
    node.textContent='Sign in and complete your profile to attach a curriculum track to the planner and ORGANOBOT.';
    return;
  }
  const profile=getSignedInProfile();
  if(!profile.curriculumTrack){
    node.textContent='No curriculum is attached to this account yet. Complete your profile to let the planner and ORGANOBOT adapt to your assigned track.';
    return;
  }
  const entry=getAssignedCurriculumEntry();
  if(!entry){
    node.textContent=`Curriculum "${profile.curriculumTrack}" is saved on your account, but it is not present in the loaded curriculum library.`;
    return;
  }
  node.textContent=`Planner and ORGANOBOT are using ${entry.title}${profile.academicYear?` for ${profile.academicYear}`:''}. ${entry.topics.length} curriculum topics will be used to bias roadmap priorities, study guidance, and explanations.`;
}

function openLessonTopic(slug){
  const topic=topics.find(item=>item.id===slug);
  if(!topic)return;
  activeTopic=topic.id;
  renderTopics();
  renderTopicDetail();
}

function renderStats(){
  const mastered=Object.values(state.topicStatus).filter(v=>v==='confident').length;
  const avg=state.quizHistory.length?Math.round(state.quizHistory.reduce((a,b)=>a+b.percent,0)/state.quizHistory.length):0;
  document.getElementById('masteredStat').textContent=mastered;
  document.getElementById('quizAverageStat').textContent=`${avg}%`;
  document.getElementById('studyPlanStat').textContent=state.studyPlans.length;
}

function weakCats(){
  const map={};
  state.quizHistory.forEach(s=>Object.entries(s.breakdown||{}).forEach(([k,v])=>{if(!map[k])map[k]={c:0,t:0};map[k].c+=v.correct;map[k].t+=v.total;}));
  return Object.entries(map).map(([k,v])=>({cat:k,p:v.t?Math.round(v.c/v.t*100):0})).sort((a,b)=>a.p-b.p);
}

function renderWeakAreas(){
  const box=document.getElementById('weakAreas');
  const quizWeak=weakCats().slice(0,3).map(x=>`<div class="weak-item"><strong>${esc(x.cat)}</strong>${x.p}% accuracy across saved quizzes.</div>`);
  const topicWeak=Object.entries(state.topicStatus).filter(([,v])=>v==='review').slice(0,2).map(([id])=>topics.find(t=>t.id===id)).filter(Boolean).map(t=>`<div class="weak-item"><strong>${esc(t.title)}</strong>Marked for review. Rebuild the main heuristics and examples.</div>`);
  box.innerHTML=(quizWeak.concat(topicWeak)).join('')||'<div class="weak-item"><strong>No weak areas yet</strong>Finish a quiz or mark topics for review to populate this panel.</div>';
}

function renderSavedReactions(){
  const box=document.getElementById('savedReactionList');
  if(!box)return;
  box.innerHTML=state.savedReactions.map(id=>`<button class="saved-item" type="button" onclick="showRxn('${id}')"><strong>${esc(reactions[id].name)}</strong>${esc(reactions[id].quick)}</button>`).join('')||'<div class="saved-item"><strong>No reactions saved</strong>Use the reaction explorer to build a quick review stack.</div>';
}

function renderMission(){
  const weak=weakCats()[0],reviewCount=Object.values(state.topicStatus).filter(v=>v==='review').length,confident=Object.values(state.topicStatus).filter(v=>v==='confident').length;
  let badge='Fresh start',text='Answer a short quiz and mark one topic to start building your study memory.';
  const tasks=['Build a 5-question quiz baseline.','Open one topic card and set its status.','Review one weak area using the topic breakdown.'];
  if(state.quizHistory.length||confident||reviewCount){badge='In progress';text='You already have enough saved state to target the next session intelligently.';}
  if(weak){badge=weak.p>=75?'Momentum':'Needs focus';text=`${weak.cat} is currently your lowest-performing category. Pair a quiz with a short review pass there.`;tasks[0]=`Run a ${weak.cat} quiz and beat ${weak.p}% accuracy.`;}
  if(reviewCount)tasks[1]=`Revisit ${reviewCount} topic${reviewCount>1?'s':''} marked as needing review.`;
  if(confident)tasks[2]=`Connect one confident topic to a new example so it stays active.`;
  document.getElementById('missionBadge').textContent=badge;
  document.getElementById('missionText').textContent=text;
  document.getElementById('missionChecklist').innerHTML=tasks.map(t=>`<div class="check-item"><strong>${today()}</strong>${esc(t)}</div>`).join('');
}

function allocatePlanMins(duration,weights){
  const mins=weights.map(item=>item.min);
  let remaining=Math.max(0,duration-mins.reduce((sum,val)=>sum+val,0));
  const totalWeight=weights.reduce((sum,item)=>sum+item.weight,0)||1;
  weights.forEach((item,index)=>{
    const extra=Math.floor(remaining*(item.weight/totalWeight));
    mins[index]+=extra;
  });
  let used=mins.reduce((sum,val)=>sum+val,0);
  for(let i=0;used<duration;i=(i+1)%mins.length,used+=1)mins[i]+=1;
  return mins;
}

function quizCategoryExists(category){
  return bank.some(q=>q.cat===category);
}

function buildPlanQuizPreset(category,length=5,difficulty='all'){
  return{
    category:quizCategoryExists(category)?category:'all',
    difficulty:['all','Beginner','Intermediate','Advanced'].includes(difficulty)?difficulty:'all',
    length:[5,8,10].includes(length)?length:5
  };
}

function getLatestStoredPlan(){
  const cached=AI?.readPlannerCache?.()||{};
  if(cached&&typeof cached==='object'&&(cached.roadmap||cached.tasks||cached.summary))return cached;
  return null;
}

function getAverageQuizScore(){
  return state.quizHistory.length?Math.round(state.quizHistory.reduce((sum,item)=>sum+item.percent,0)/state.quizHistory.length):0;
}

function setPlannerStatus(message){
  document.getElementById('plannerStatus').textContent=message;
}

function setPlannerError(message=''){
  const box=document.getElementById('plannerError');
  if(!message){
    box.style.display='none';
    box.textContent='';
    return;
  }
  box.style.display='block';
  box.textContent=message;
}

function clampCourseDays(days){
  const numeric=Number(days);
  const base=Number.isFinite(numeric)?numeric:PLANNER_TIMELINE_DEFAULTS.defaultDays;
  const clamped=Math.max(PLANNER_TIMELINE_DEFAULTS.minDays,Math.min(PLANNER_TIMELINE_DEFAULTS.maxDays,base));
  return Math.round(clamped/PLANNER_TIMELINE_DEFAULTS.stepDays)*PLANNER_TIMELINE_DEFAULTS.stepDays;
}

function derivePlannerTimeline(days){
  const courseDays=clampCourseDays(days);
  const courseWeeks=Math.max(2,Math.ceil(courseDays/7));
  let sessionMinutes=35;
  let recommendedQuizzesPerWeek=2;
  let plannedMajorExams=3;
  let mode='Stay on track';
  if(courseDays<=28){
    sessionMinutes=75;
    recommendedQuizzesPerWeek=4;
    plannedMajorExams=1;
    mode='Fast track';
  }else if(courseDays<=49){
    sessionMinutes=50;
    recommendedQuizzesPerWeek=3;
    plannedMajorExams=2;
    mode='Focused push';
  }else if(courseDays<=84){
    sessionMinutes=35;
    recommendedQuizzesPerWeek=2;
    plannedMajorExams=3;
    mode='Stay on track';
  }else{
    sessionMinutes=20;
    recommendedQuizzesPerWeek=1;
    plannedMajorExams=4;
    mode='Long runway';
  }
  return{
    courseDays,
    courseWeeks,
    sessionMinutes,
    recommendedQuizzesPerWeek,
    plannedQuizzes:courseWeeks*recommendedQuizzesPerWeek,
    plannedMajorExams,
    mode
  };
}

function syncPlannerTimelineUI(){
  const slider=document.getElementById('plannerCourseDays');
  const daysInput=document.getElementById('courseDays');
  const weeksInput=document.getElementById('courseWeeks');
  const minutesSelect=document.getElementById('sessionMinutes');
  if(!slider||!daysInput||!weeksInput||!minutesSelect)return;
  const timeline=derivePlannerTimeline(slider.value||daysInput.value||PLANNER_TIMELINE_DEFAULTS.defaultDays);
  slider.value=String(timeline.courseDays);
  slider.style.setProperty('--planner-progress',`${(timeline.courseDays-PLANNER_TIMELINE_DEFAULTS.minDays)/Math.max(1,PLANNER_TIMELINE_DEFAULTS.maxDays-PLANNER_TIMELINE_DEFAULTS.minDays)*100}%`);
  daysInput.value=String(timeline.courseDays);
  weeksInput.value=String(timeline.courseWeeks);
  minutesSelect.value=String(timeline.sessionMinutes);

  const daysLabel=document.getElementById('plannerCourseDaysValue');
  const daysMeta=document.getElementById('plannerCourseDaysMeta');
  const mode=document.getElementById('plannerModeValue');
  const derivedTimeline=document.getElementById('plannerDerivedTimeline');
  const derivedSession=document.getElementById('plannerDerivedSessionLength');
  const derivedQuizzes=document.getElementById('plannerDerivedQuizzes');
  const derivedExams=document.getElementById('plannerDerivedExams');

  if(daysLabel)daysLabel.textContent=`${timeline.courseDays} days`;
  if(daysMeta)daysMeta.textContent=`${timeline.courseWeeks} weeks / ${timeline.sessionMinutes} min sessions`;
  if(mode)mode.textContent=timeline.mode;
  if(derivedTimeline)derivedTimeline.value=`${timeline.courseDays} days / ${timeline.courseWeeks} weeks`;
  if(derivedSession)derivedSession.value=`${timeline.sessionMinutes} minutes`;
  if(derivedQuizzes)derivedQuizzes.value=`${timeline.plannedQuizzes} total / ${timeline.recommendedQuizzesPerWeek} per week`;
  if(derivedExams)derivedExams.value=`${timeline.plannedMajorExams} total`;
}

function syncPlannerFocusUI(){
  const select=document.getElementById('studyFocus');
  if(!select)return;
  document.querySelectorAll('.planner-theme-chip').forEach(button=>{
    const active=button.dataset.focus===select.value;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

function syncPlannerSetupUI(){
  syncPlannerTimelineUI();
  syncPlannerFocusUI();
}

function bindPlannerSetupUI(){
  const slider=document.getElementById('plannerCourseDays');
  if(slider&&!slider.dataset.bound){
    slider.addEventListener('input',syncPlannerTimelineUI);
    slider.addEventListener('change',syncPlannerTimelineUI);
    slider.dataset.bound='true';
  }
  const focusSelect=document.getElementById('studyFocus');
  if(focusSelect&&!focusSelect.dataset.bound){
    document.querySelectorAll('.planner-theme-chip').forEach(button=>{
      button.addEventListener('click',()=>{
        focusSelect.value=button.dataset.focus||'all';
        syncPlannerFocusUI();
      });
    });
    focusSelect.addEventListener('change',syncPlannerFocusUI);
    focusSelect.dataset.bound='true';
  }
  syncPlannerSetupUI();
}

function syncPlannerAISettingsUI(){
  return;
}

async function refreshPlannerActivationState(){
  if(!AI){
    setPlannerStatus('Shared Grok AI is unavailable right now. You can still use the offline quick plan.');
    return;
  }
  const client=await AI.readHostedProxyStatus();
  if(client.available&&client.configured){
    setPlannerStatus(`Shared Grok AI is ready through ${client.provider==='puter'?'Puter':'the server route'}. Generate a roadmap whenever you are ready.`);
    return;
  }
  if(client.available&&!client.configured){
    setPlannerStatus('Shared Grok AI is not configured on the server. You can still use the offline quick plan.');
    return;
  }
  setPlannerStatus('Shared Grok AI is unavailable right now. Check Puter or the server connection, or use the offline quick plan.');
}

function readPlannerInputs(){
  const curriculumEntry=getAssignedCurriculumEntry();
  const timeline=derivePlannerTimeline(document.getElementById('courseDays')?.value);
  return{
    focusArea:document.getElementById('studyFocus').value,
    courseDays:timeline.courseDays,
    sessionMinutes:timeline.sessionMinutes,
    courseWeeks:timeline.courseWeeks,
    recommendedQuizzesPerWeek:timeline.recommendedQuizzesPerWeek,
    plannedQuizzes:timeline.plannedQuizzes,
    plannedMajorExams:timeline.plannedMajorExams,
    pacingMode:timeline.mode,
    completedQuizzes:Math.max(0,Number(document.getElementById('completedQuizzes').value)||0),
    completedMajorExams:Math.max(0,Number(document.getElementById('completedMajorExams').value)||0),
    startingLevel:document.getElementById('startingLevel').value,
    curriculum:curriculumEntry?{
      track:curriculumEntry.title,
      academicYear:getSignedInProfile().academicYear||'',
      country:curriculumEntry.country,
      level:curriculumLevelLabel(curriculumEntry.level),
      topics:getCurriculumTopicLabels(curriculumEntry),
      priorityTopics:getCurriculumPriorityTopics(curriculumEntry)
    }:null
  };
}

function hydratePlannerInputs(){
  const curriculumEntry=getAssignedCurriculumEntry();
  const cachedInputs=getLatestStoredPlan()?.inputs;
  if(cachedInputs?.focusArea)document.getElementById('studyFocus').value=cachedInputs.focusArea;
  const cachedDays=cachedInputs?.courseDays||(cachedInputs?.courseWeeks?Number(cachedInputs.courseWeeks)*7:PLANNER_TIMELINE_DEFAULTS.defaultDays);
  document.getElementById('plannerCourseDays').value=String(clampCourseDays(cachedDays));
  if(cachedInputs?.completedQuizzes!==undefined)document.getElementById('completedQuizzes').value=String(cachedInputs.completedQuizzes);
  else document.getElementById('completedQuizzes').value=String(state.quizHistory.length);
  if(cachedInputs?.completedMajorExams!==undefined)document.getElementById('completedMajorExams').value=String(cachedInputs.completedMajorExams);
  if(cachedInputs?.startingLevel)document.getElementById('startingLevel').value=cachedInputs.startingLevel;
  else if(curriculumEntry)document.getElementById('startingLevel').value=curriculumLevelStartingLevel(curriculumEntry.level);
  syncPlannerSetupUI();
  renderPlannerCurriculumSummary();
}

function savePlanHistory(plan,input){
  state.studyPlans.unshift({
    createdAt:new Date().toISOString(),
    source:plan.source||'offline',
    focus:input.focusArea,
    duration:input.sessionMinutes,
    courseDays:input.courseDays,
    courseWeeks:input.courseWeeks
  });
  state.studyPlans=state.studyPlans.slice(0,8);
  saveState();
}

function chemistryCategories(){
  return topics.map(topic=>topic.title);
}

function categoryFromText(text,fallback='all'){
  const source=String(text||'').toLowerCase();
  const match=chemistryCategories().find(category=>source.includes(category.toLowerCase()));
  return match||fallback;
}

function startPlanQuiz(category='all',length=5,difficulty='all'){
  const preset=buildPlanQuizPreset(category,length,difficulty);
  document.getElementById('quizCategory').value=preset.category;
  document.getElementById('quizDifficulty').value=preset.difficulty;
  document.getElementById('quizLength').value=String(preset.length);
  setupQuiz();
  document.getElementById('quiz').scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>document.querySelector('#qOptions .quiz-opt')?.focus(),120);
}

function buildProgressSnapshot(input){
  const weak=weakCats();
  const reviewTopics=Object.entries(state.topicStatus)
    .filter(([,value])=>value==='review')
    .map(([id])=>topics.find(topic=>topic.id===id)?.title)
    .filter(Boolean);
  const confidentTopics=Object.entries(state.topicStatus)
    .filter(([,value])=>value==='confident')
    .map(([id])=>topics.find(topic=>topic.id===id)?.title)
    .filter(Boolean);
  return{
    savedProgress:{
      averageQuizScore:getAverageQuizScore(),
      quizHistoryCount:state.quizHistory.length,
      confidentTopicCount:confidentTopics.length,
      reviewTopicCount:reviewTopics.length,
      savedReactionCount:state.savedReactions.length
    },
    weakAreas:weak.slice(0,3),
    reviewTopics,
    confidentTopics,
    savedReactions:state.savedReactions.map(id=>reactions[id]?.name).filter(Boolean),
    recentQuizzes:state.quizHistory.slice(0,5).map(entry=>({
      percent:entry.percent,
      category:entry.category,
      difficulty:entry.difficulty,
      createdAt:entry.createdAt
    })),
    requestedFocus:input.focusArea,
    requestedTimeline:{
      courseDays:input.courseDays,
      courseWeeks:input.courseWeeks,
      sessionMinutes:input.sessionMinutes,
      plannedQuizzes:input.plannedQuizzes,
      plannedMajorExams:input.plannedMajorExams,
      recommendedQuizzesPerWeek:input.recommendedQuizzesPerWeek,
      pacingMode:input.pacingMode
    },
    curriculum:input.curriculum?{
      track:input.curriculum.track,
      academicYear:input.curriculum.academicYear,
      level:input.curriculum.level,
      priorityTopics:input.curriculum.priorityTopics,
      topics:input.curriculum.topics.slice(0,10)
    }:null
  };
}

function normalizeText(value,fallback){
  return typeof value==='string'&&value.trim()?value.trim():fallback;
}

function normalizeStringArray(values,fallback=[]){
  const list=Array.isArray(values)?values:[];
  const cleaned=list.map(value=>normalizeText(value,'')).filter(Boolean);
  return cleaned.length?cleaned:fallback;
}

function buildDefaultExamMilestones(input,priorityTopics,focusLabel){
  const total=Math.max(1,Math.min(6,Number(input.plannedMajorExams)||1));
  const topics=priorityTopics.length?priorityTopics:[focusLabel];
  return Array.from({length:total},(_,index)=>({
    week:Math.max(1,Math.min(input.courseWeeks,Math.round(((index+1)/total)*input.courseWeeks))),
    type:index===total-1?'final major':'major',
    focus:topics[index%topics.length]||focusLabel
  }));
}

function normalizeRoadmapEntries(roadmap,input){
  const topicsPool=chemistryCategories();
  const source=Array.isArray(roadmap)?roadmap:[];
  const weeksToShow=Math.max(2,input.courseWeeks);
  const normalized=source.slice(0,weeksToShow).map((entry,index)=>({
    week:index+1,
    goal:normalizeText(entry?.goal,`Build week ${index+1} around ${input.focusArea==='all'?'core organic chemistry patterns':input.focusArea}.`),
    topics:normalizeStringArray(entry?.topics,[topicsPool[index%topicsPool.length]]).slice(0,4),
    quizzes:Math.max(1,Math.min(5,Number(entry?.quizzes)||input.recommendedQuizzesPerWeek||2)),
    majorExam:Boolean(entry?.majorExam),
    notes:normalizeText(entry?.notes,'Use retrieval plus worked examples to keep the week active.')
  }));
  while(normalized.length<weeksToShow){
    const index=normalized.length;
    normalized.push({
      week:index+1,
      goal:`Strengthen ${input.focusArea==='all'?'organic chemistry foundations':input.focusArea} with a steady week-${index+1} push.`,
      topics:[topicsPool[index%topicsPool.length]],
      quizzes:Math.max(1,Math.min(5,input.recommendedQuizzesPerWeek||2)),
      majorExam:false,
      notes:'Keep one quiz, one review block, and one worked-example block each week.'
    });
  }
  return normalized.map((entry,index)=>({
    ...entry,
    week:index+1,
    topics:normalizeStringArray(entry.topics,[topicsPool[index%topicsPool.length]]).slice(0,4)
  }));
}

function normalizeSessionBlocks(blocks,totalMinutes,fallbackCategory){
  const allowedActivities=['quiz','review','examples','exam-drill','reference'];
  let cleaned=(Array.isArray(blocks)?blocks:[]).map((block,index)=>({
    label:normalizeText(block?.label,`Study block ${index+1}`),
    minutes:Math.max(1,Math.round(Number(block?.minutes)||0)),
    activity:allowedActivities.includes(block?.activity)?block.activity:'review'
  })).filter(block=>block.minutes>0);
  if(!cleaned.length){
    const [quizMin,reviewMin,examplesMin,referenceMin]=allocatePlanMins(totalMinutes,[
      {min:5,weight:.24},
      {min:6,weight:.36},
      {min:4,weight:.24},
      {min:5,weight:.16}
    ]);
    cleaned=[
      {label:`Warm-up quiz on ${fallbackCategory==='all'?'mixed topics':fallbackCategory}`,minutes:quizMin,activity:'quiz'},
      {label:'Concept rebuild and note compression',minutes:reviewMin,activity:'review'},
      {label:'Worked examples without peeking',minutes:examplesMin,activity:'examples'},
      {label:'Reference sweep and error check',minutes:referenceMin,activity:'reference'}
    ];
  }
  let sum=cleaned.reduce((total,block)=>total+block.minutes,0);
  let diff=totalMinutes-sum;
  while(diff!==0&&cleaned.length){
    for(let index=0;index<cleaned.length&&diff!==0;index+=1){
      if(diff>0){
        cleaned[index].minutes+=1;
        diff-=1;
      }else if(cleaned[index].minutes>1){
        cleaned[index].minutes-=1;
        diff+=1;
      }
    }
    const allAtMin=cleaned.every(block=>block.minutes===1);
    if(diff<0&&allAtMin)break;
  }
  return cleaned;
}

function normalizePlanObject(raw,input,source='ai'){
  const focusLabel=input.focusArea==='all'?'Balanced review':input.focusArea;
  const curriculumPriority=Array.isArray(input.curriculum?.priorityTopics)?input.curriculum.priorityTopics:[];
  const priorityTopics=normalizeStringArray(raw?.priorityTopics,[...curriculumPriority,focusLabel,input.startingLevel==='Beginner'?'Functional Groups':'Reaction Mechanisms']).slice(0,5);
  const roadmap=normalizeRoadmapEntries(raw?.roadmap,input);
  const sessionTitle=normalizeText(raw?.nextSession?.title,`${focusLabel} next-session plan`);
  const blocks=normalizeSessionBlocks(raw?.nextSession?.blocks,input.sessionMinutes,input.focusArea);
  const milestoneSeed=Array.isArray(raw?.examMilestones)?raw.examMilestones:[];
  const fallbackMilestones=buildDefaultExamMilestones(input,priorityTopics,focusLabel);
  const examMilestones=milestoneSeed.slice(0,Math.max(1,input.plannedMajorExams||1)).map((item,index)=>({
    week:Math.max(1,Math.min(input.courseWeeks,Math.round(Number(item?.week)||Math.max(1,(index+1)*Math.round(input.courseWeeks/Math.max(1,milestoneSeed.length||2)))))),
    type:normalizeText(item?.type,index===milestoneSeed.length-1?'final major':'major'),
    focus:normalizeText(item?.focus,priorityTopics[index%priorityTopics.length]||focusLabel)
  }));
  const normalizedMilestones=fallbackMilestones.map((fallback,index)=>examMilestones[index]||fallback);
  const majorExamWeeks=new Set(normalizedMilestones.map(item=>item.week));
  return{
    source,
    createdAt:new Date().toISOString(),
    inputs:{...input},
    focusArea:input.focusArea,
    summary:normalizeText(raw?.summary,`Build from ${input.startingLevel.toLowerCase()} toward mastery by spacing quizzes, topic rebuilds, and major exams across ${input.courseDays} days (${input.courseWeeks} weeks)${input.curriculum?.track?` while staying aligned with ${input.curriculum.track}${input.curriculum?.academicYear?` for ${input.curriculum.academicYear}`:''}.`:'.'}`),
    learnerProfile:{
      startingLevel:normalizeText(raw?.learnerProfile?.startingLevel,input.startingLevel),
      targetLevel:'Master',
      pace:normalizeText(raw?.learnerProfile?.pace,`${input.sessionMinutes}-minute sessions across ${input.courseDays} days (${input.courseWeeks} weeks)`)
    },
    curriculum:input.curriculum?{...input.curriculum}:null,
    roadmap:roadmap.map(entry=>({...entry,majorExam:majorExamWeeks.has(entry.week)||entry.majorExam})),
    nextSession:{
      title:sessionTitle,
      totalMinutes:input.sessionMinutes,
      blocks
    },
    quizStrategy:{
      recommendedPerWeek:Math.max(1,Math.min(5,Math.round(Number(raw?.quizStrategy?.recommendedPerWeek)||input.recommendedQuizzesPerWeek||2))),
      reason:normalizeText(raw?.quizStrategy?.reason,'Frequent retrieval keeps weak patterns visible before they harden into gaps.')
    },
    examMilestones:normalizedMilestones,
    priorityTopics,
    advice:normalizeStringArray(raw?.advice,['Keep a short error log after each quiz.','Use the roadmap as a rhythm, not as a rigid script.']).slice(0,5)
  };
}

function buildOfflineStudyPlanObject(input){
  const weak=weakCats();
  const weakTopics=weak.slice(0,2).map(item=>item.cat);
  const reviewTopics=Object.entries(state.topicStatus)
    .filter(([,value])=>value==='review')
    .map(([id])=>topics.find(topic=>topic.id===id)?.title)
    .filter(Boolean);
  const curriculumPriority=Array.isArray(input.curriculum?.priorityTopics)?input.curriculum.priorityTopics:[];
  const emphasis=[...curriculumPriority,input.focusArea==='all'?weakTopics[0]||curriculumPriority[0]||'Functional Groups':input.focusArea,...reviewTopics,...weakTopics].filter(Boolean);
  const priorityTopics=[...new Set(emphasis.concat(chemistryCategories()))].slice(0,5);
  const recommendedPerWeek=Math.max(1,Math.min(5,input.recommendedQuizzesPerWeek+(input.startingLevel==='Advanced'&&input.courseDays<=49?1:0)));
  const examMilestones=buildDefaultExamMilestones({...input,plannedMajorExams:input.plannedMajorExams},priorityTopics,input.focusArea==='all'?'Balanced review':input.focusArea);
  const roadmap=normalizeRoadmapEntries(Array.from({length:Math.max(2,input.courseWeeks)},(_,index)=>({
    week:index+1,
    goal:index===0?`Establish a stable base in ${priorityTopics[0]||'organic chemistry fundamentals'}.`:index===Math.max(2,input.courseWeeks)-1?'Consolidate toward a mastery checkpoint.':`Extend the plan into ${priorityTopics[(index+1)%priorityTopics.length]||'applied examples'}.`,
    topics:priorityTopics.slice(index,index+2).length?priorityTopics.slice(index,index+2):[priorityTopics[index%priorityTopics.length]||'Functional Groups'],
    quizzes:recommendedPerWeek,
    majorExam:examMilestones.some(item=>item.week===index+1),
    notes:index===0?'Start with recognition, naming, and pattern recall before pushing speed.':'Mix one retrieval block with one worked-example block each week.'
  })),input);
  return normalizePlanObject({
    summary:`This offline roadmap uses your ${input.startingLevel.toLowerCase()} starting level, ${input.courseDays}-day course timeline, saved weak areas,${input.curriculum?.track?` and ${input.curriculum.track}${input.curriculum?.academicYear?` (${input.curriculum.academicYear})`:''}`:' and your current topic data'} to keep progress moving toward mastery.`,
    learnerProfile:{startingLevel:input.startingLevel,targetLevel:'Master',pace:`${input.sessionMinutes}-minute sessions with ${recommendedPerWeek} quizzes per week across ${input.courseDays} days`},
    roadmap,
    nextSession:{
      title:`Offline focus session: ${input.focusArea==='all'?'balanced review':input.focusArea}`,
      totalMinutes:input.sessionMinutes,
      blocks:[]
    },
    quizStrategy:{
      recommendedPerWeek,
      reason:`Your current history suggests ${recommendedPerWeek} quizzes per week is enough to reinforce weak spots without crowding out concept review.`
    },
    examMilestones,
    priorityTopics,
    advice:[
      input.curriculum?.track?`Keep ${input.curriculum.track}${input.curriculum?.academicYear?` for ${input.curriculum.academicYear}`:''} in view by revisiting ${curriculumPriority.slice(0,2).join(' and ')||'its core topics'} every week.`:'',
      weakTopics.length?`Front-load ${weakTopics.join(' and ')} because they are currently your weakest quiz categories.`:'Front-load recognition-heavy topics before switching into mechanism drills.',
      input.completedQuizzes>=8?'Use completed quizzes as revision checkpoints, not just score reports.':'Build quiz volume steadily so recall becomes routine.',
      input.completedMajorExams?`You have already taken ${input.completedMajorExams} major exam${input.completedMajorExams>1?'s':''}, so shift more time toward error correction and synthesis.`:`This ${input.courseDays}-day plan includes ${input.plannedMajorExams} major exam${input.plannedMajorExams>1?'s':''}, so use them as full-course synthesis checkpoints.`
    ]
  },input,'offline');
}

function renderLegacyPlan(plan){
  const box=document.getElementById('studyPlan');
  box.innerHTML=plan?.tasks?.length?plan.tasks.map((task,index)=>`<div class="plan-item"><strong>${esc(task.title)} - ${task.min} min</strong><div>${esc(task.copy)}</div>${task.meta?`<div class="plan-meta">${esc(task.meta)}</div>`:''}${task.quizPreset?`<div class="plan-actions"><button class="btn btn-secondary plan-action" type="button" onclick="startPlanQuiz('${esc(task.quizPreset.category)}',${task.quizPreset.length},'${esc(task.quizPreset.difficulty)}')">${esc(task.actionLabel||'Start planned quiz')}</button></div>`:''}</div>`).join(''):'<div class="plan-empty">No plan generated yet. Generate an AI roadmap or use the offline quick plan.</div>';
}

function renderStudyPlan(plan=getLatestStoredPlan()){
  const box=document.getElementById('studyPlan');
  if(!plan){
    box.innerHTML='<div class="plan-empty"><strong>No roadmap generated yet.</strong><div>Generate a multi-week roadmap and next session with the built-in AI, or use the offline quick plan.</div></div>';
    return;
  }
  if(plan.tasks)return renderLegacyPlan(plan);
  const summaryChips=[
    `<span class="inline-chip">${esc((plan.source||'offline').toUpperCase())} Planner</span>`,
    `<span class="inline-chip">${esc(plan.learnerProfile?.startingLevel||'Beginner')} to ${esc(plan.learnerProfile?.targetLevel||'Master')}</span>`,
    `${plan.curriculum?.track?`<span class="inline-chip">${esc(plan.curriculum.track)}</span>`:''}`,
    `${plan.inputs?.courseDays?`<span class="inline-chip">${esc(plan.inputs.courseDays)}-day course</span>`:''}`,
    `<span class="inline-chip">${esc(plan.nextSession?.totalMinutes||0)} min session</span>`
  ].join('');
  const weakList=weakCats().slice(0,3).map(item=>`<li>${esc(item.cat)} - ${item.p}% accuracy</li>`).join('')||'<li>No weak quiz categories yet. Finish a quiz to surface one here.</li>';
  const sessionBlocks=(plan.nextSession?.blocks||[]).map(block=>{
    const derivedCategory=categoryFromText(`${block.label} ${plan.focusArea==='all'?'':plan.focusArea}`,plan.focusArea);
    const quizAction=(block.activity==='quiz'||block.activity==='exam-drill')?`<div class="planner-side-actions"><button class="btn btn-secondary" type="button" onclick="startPlanQuiz('${esc(derivedCategory)}',5,'${block.activity==='exam-drill'?'Intermediate':'all'}')">Start quiz from this block</button></div>`:'';
    return`<div class="session-block"><div class="session-block-top"><strong>${esc(block.label)}</strong><span class="session-min">${block.minutes} min</span></div><div class="activity-badge">${esc(block.activity)}</div>${quizAction}</div>`;
  }).join('');
  box.innerHTML=`<div class="plan-shell">
    <div class="plan-summary">
      <div class="plan-source">${summaryChips}</div>
      <h4>${esc(plan.nextSession?.title||'Organic chemistry roadmap')}</h4>
      <div class="plan-note">${esc(plan.summary||'')}</div>
      <div class="plan-note">Pace: ${esc(plan.learnerProfile?.pace||'Custom pacing')}</div>
    </div>
    <div class="plan-columns">
      <div class="plan-panel">
        <h4>Roadmap</h4>
        <div class="roadmap-grid">${(plan.roadmap||[]).map(week=>`<article class="roadmap-card"><div class="roadmap-week">Week ${week.week}${week.majorExam?' - Major exam':''}</div><strong>${esc(week.goal)}</strong><div class="roadmap-topics">${(week.topics||[]).map(topic=>`<span class="roadmap-topic">${esc(topic)}</span>`).join('')}</div><div class="plan-note">${esc(week.notes)}</div><div class="activity-badge">${week.quizzes} quiz${week.quizzes===1?'':'zes'} planned</div></article>`).join('')}</div>
      </div>
      <div class="plan-panel">
        <h4>Next Session</h4>
        <div class="session-blocks">${sessionBlocks}</div>
      </div>
    </div>
    <div class="plan-columns">
      <div class="plan-panel">
        <h4>Quiz and Exam Strategy</h4>
        <ul class="plan-list">
          <li><strong>${plan.inputs?.plannedQuizzes||0} quizzes planned</strong>${esc(plan.quizStrategy?.reason||'')} ${esc(`${plan.quizStrategy?.recommendedPerWeek||2} per week across ${plan.inputs?.courseWeeks||0} weeks.`)}</li>
          ${(plan.examMilestones||[]).map(item=>`<li><strong>Week ${item.week} - ${esc(item.type)}</strong>${esc(item.focus)}</li>`).join('')}
        </ul>
      </div>
      <div class="plan-panel">
        <h4>Priority Topics</h4>
        <ul class="priority-list">${(plan.priorityTopics||[]).map(topic=>`<li>${esc(topic)}</li>`).join('')}</ul>
        <h4>Weak-Area Emphasis</h4>
        <ul class="priority-list">${weakList}</ul>
        <h4>Advice</h4>
        <ul class="advice-list">${(plan.advice||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>
      </div>
    </div>
  </div>`;
}

function buildOfflineStudyPlan(){
  if(!canUseAccountFeature('Sign in to save offline study plans and planner history.'))return;
  const input=readPlannerInputs();
  const plan=buildOfflineStudyPlanObject(input);
  AI?.savePlannerCache?.(plan);
  savePlanHistory(plan,input);
  document.getElementById('completedQuizzes').value=String(Math.max(input.completedQuizzes,state.quizHistory.length));
  setPlannerError('');
  setPlannerStatus('Offline quick plan ready. Use the built-in AI whenever you want a richer roadmap or ORGANOBOT chat.');
  renderStats();
  renderStudyPlan(plan);
  renderMission();
  window.OrganoApp?.notify?.({
    title:'Offline roadmap ready',
    body:`Your ${input.courseDays}-day roadmap is ready with a ${input.sessionMinutes}-minute ${input.focusArea==='all'?'balanced review':input.focusArea} session.`,
    kind:'success',
    actionHref:'#dashboard',
    actionLabel:'Review roadmap'
  });
}

async function buildStudyPlan(){
  if(!canUseAccountFeature('Sign in to save AI roadmaps and planner history.'))return;
  const input=readPlannerInputs();
  if(!AI){
    setPlannerError('The built-in AI module did not load, so the AI roadmap is unavailable.');
    setPlannerStatus('Use the offline quick plan while the built-in AI is unavailable.');
    return;
  }
  setPlannerError('');
  setPlannerStatus('Generating your AI roadmap...');
  window.OrganoApp?.showLoader?.('Generating your AI roadmap...');
  try{
    const rawPlan=await AI.requestPlannerRoadmap({
      input,
      progress:buildProgressSnapshot(input)
    });
    const plan=normalizePlanObject(rawPlan,input,'ai');
    AI.savePlannerCache(plan);
    savePlanHistory(plan,input);
    setPlannerStatus('AI roadmap ready. Your latest roadmap is saved in this browser.');
    renderStats();
    renderStudyPlan(plan);
    renderMission();
    window.OrganoApp?.notify?.({
      title:'AI roadmap generated',
      body:`Your ${input.courseDays}-day ${input.focusArea==='all'?'balanced review':input.focusArea} roadmap is ready.`,
      kind:'success',
      actionHref:'#dashboard',
      actionLabel:'Open planner'
    });
  }catch(error){
    setPlannerStatus('The AI roadmap could not be generated.');
    setPlannerError(`${AI.normalizeAIError(error)} You can still use the offline quick plan below.`);
  }finally{
    window.OrganoApp?.hideLoader?.();
  }
}

function resetPlannerData(){
  if(!canUseAccountFeature('Sign in to manage planner history and stored progress.'))return;
  if(!confirm('Reset planner data? This clears study plans, cached roadmap data, and quiz history, but keeps your theme, topic marks, saved reactions, material studio state, and ORGANOBOT chats.'))return;
  state.quizHistory=[];
  state.studyPlans=[];
  saveState();
  AI?.clearPlannerCache?.();
  document.getElementById('completedQuizzes').value='0';
  setPlannerError('');
  setPlannerStatus('Planner data cleared. Your theme, topic status, saved reactions, material studio state, and ORGANOBOT chats were preserved.');
  renderStats();
  renderStudyPlan();
  renderWeakAreas();
  renderMission();
  renderQuizHistory();
  setupQuiz();
  window.OrganoApp?.notify?.({
    title:'Planner data cleared',
    body:'Quiz history, saved roadmaps, and cached planner data were reset for a clean restart.',
    kind:'warning',
    actionHref:'#dashboard',
    actionLabel:'Start fresh',
    dedupeKey:'planner-reset'
  });
}

function renderTopics(){
  const q=document.getElementById('topicSearch').value.trim().toLowerCase(),diff=document.getElementById('topicDifficulty').value,status=document.getElementById('topicStatus').value;
  const filtered=topics.filter(t=>{
    const matchQ=!q||[t.title,t.description,t.overview,...t.tags].join(' ').toLowerCase().includes(q);
    const matchD=diff==='all'||t.difficulty===diff;
    const matchS=status==='all'||topicStatus(t.id)===status;
    return matchQ&&matchD&&matchS;
  });
  const grid=document.getElementById('topicsGrid');
  grid.innerHTML=filtered.length?filtered.map(t=>`<article class="topic-card ${t.className} ${t.id===activeTopic?'active':''}" data-id="${t.id}"><div class="topic-top"><div class="topic-icon">${esc(t.icon)}</div><span class="topic-state">${statusLabel(topicStatus(t.id))}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="topic-tags"><span class="topic-tag">${esc(t.difficulty)}</span>${t.tags.map(tag=>`<span class="topic-tag">${esc(tag)}</span>`).join('')}</div></article>`).join(''):'<div class="topic-card"><h3>No matching topics</h3><p>Try a broader search or reset the filters.</p></div>';
  grid.querySelectorAll('[data-id]').forEach(card=>card.addEventListener('click',()=>{activeTopic=card.dataset.id;renderTopics();renderTopicDetail();}));
}

function setTopicState(id,val){
  if(!canUseAccountFeature('Sign in to save topic status and progress tracking.'))return;
  if(val==='new')delete state.topicStatus[id];else state.topicStatus[id]=val;
  saveState();
  renderTopics();renderTopicDetail();renderStats();renderWeakAreas();renderMission();
  const topic=topics.find(item=>item.id===id);
  if(topic){
    const body=val==='confident'?'Marked as confident so it stays in your strong-topic set.':val==='review'?'Marked for another pass so it surfaces in weak-area guidance.':'The saved status was cleared and the topic is back to unmarked.';
    window.OrganoApp?.notify?.({
      title:val==='new'?`${topic.title} reset`:`${topic.title} updated`,
      body,
      kind:val==='review'?'warning':'success',
      actionHref:'#topics',
      actionLabel:'Open topics',
      dedupeKey:`topic-${id}`
    });
  }
}

function renderTopicDetail(){
  const t=topics.find(x=>x.id===activeTopic),panel=document.getElementById('topicDetail');
  if(!t){panel.innerHTML='<div class="detail-empty">Select a topic to inspect it in more depth.</div>';return;}
  const status=topicStatus(t.id);
  const locked=!window.OrganoApp?.isAuthenticated?.();
  panel.innerHTML=`<div class="panel-header"><div><div class="panel-eyebrow">Topic detail</div><h3>${esc(t.title)}</h3></div><span class="status-pill">${esc(t.difficulty)}</span></div><p class="panel-copy">${esc(t.overview)}</p><div class="topic-meta"><div class="goal-item"><strong>Current status</strong>${esc(statusLabel(status))}</div><div class="goal-item"><strong>Suggested next move</strong>${status==='review'?'Rebuild it with examples before moving on.':status==='confident'?'Maintain it with a short recall drill.':'Start with recognition, naming, and one application example.'}</div></div>${locked?'<div class="note-item">Sign in to save topic status and progress tracking.</div>':''}<div class="pill-row" style="justify-content:flex-start;"><button class="btn btn-primary" type="button" onclick="setTopicState('${t.id}','confident')" ${locked?'data-auth-required data-auth-message="Sign in to save topic status and progress tracking."':''}>Mark Confident</button><button class="btn btn-secondary" type="button" onclick="setTopicState('${t.id}','review')" ${locked?'data-auth-required data-auth-message="Sign in to save topic status and progress tracking."':''}>Needs Review</button><button class="btn btn-secondary" type="button" onclick="setTopicState('${t.id}','new')" ${locked?'data-auth-required data-auth-message="Sign in to save topic status and progress tracking."':''}>Clear Status</button></div><div class="topic-goals">${t.goals.map(g=>`<div class="goal-item"><strong>Goal</strong>${esc(g)}</div>`).join('')}</div><div class="topic-pitfalls">${t.pitfalls.map(p=>`<div class="pitfall-item"><strong>Watch for</strong>${esc(p)}</div>`).join('')}</div>`;
}

function renderCurriculum(){
  const countriesNode=document.getElementById('curriculumCountries');
  const summaryNode=document.getElementById('curriculumSummary');
  const grid=document.getElementById('curriculumGrid');
  if(!countriesNode||!summaryNode||!grid)return;
  const countries=Array.isArray(curriculumData.countries)?curriculumData.countries:[];
  const entries=Array.isArray(curriculumData.entries)?curriculumData.entries:[];
  if(!countries.length||!entries.length){
    countriesNode.innerHTML='';
    summaryNode.textContent='Curriculum data is unavailable right now.';
    grid.innerHTML='<article class="dashboard-panel curriculum-card"><h3>No curriculum entries</h3><p class="panel-copy">Add local curriculum data to populate this section.</p></article>';
    return;
  }
  if(!countries.includes(activeCurriculumCountry))activeCurriculumCountry=countries[0];
  countriesNode.innerHTML=countries.map(country=>`<button class="btn ${country===activeCurriculumCountry?'btn-primary':'btn-secondary'}" type="button" data-curriculum-country="${esc(country)}">${esc(country)}</button>`).join('');
  countriesNode.querySelectorAll('[data-curriculum-country]').forEach(button=>button.addEventListener('click',()=>{activeCurriculumCountry=button.dataset.curriculumCountry||countries[0];renderCurriculum();}));
  const visibleEntries=entries
    .filter(entry=>entry.country===activeCurriculumCountry)
    .sort((a,b)=>(a.level==='high-school'?0:1)-(b.level==='high-school'?0:1));
  const linkedCount=visibleEntries.reduce((count,entry)=>count+entry.topics.filter(topic=>curriculumTopicLessonSlug(topic)).length,0);
  summaryNode.textContent=`Showing ${activeCurriculumCountry} with ${visibleEntries.length} track${visibleEntries.length===1?'':'s'} and ${linkedCount} topic${linkedCount===1?'':'s'} linked to existing lesson cards.`;
  grid.innerHTML=visibleEntries.map(entry=>`<article class="dashboard-panel curriculum-card"><div class="panel-header"><div><div class="panel-eyebrow">${esc(entry.country)}</div><h3>${esc(curriculumLevelLabel(entry.level))}</h3></div><span class="status-pill">${entry.topics.length} topics</span></div><p class="panel-copy">${esc(entry.title)}</p><div class="curriculum-meta"><span class="topic-tag">${esc(curriculumLevelLabel(entry.level))}</span><span class="topic-tag">${entry.sources.length} source${entry.sources.length===1?'':'s'}</span></div><div><div class="panel-eyebrow">Topics</div><div class="curriculum-topic-list">${entry.topics.map(topic=>{const title=curriculumTopicTitle(topic),slug=curriculumTopicLessonSlug(topic);return slug?`<a class="curriculum-topic-link" href="#topics" data-curriculum-lesson="${esc(slug)}">${esc(title)}</a>`:`<span class="curriculum-topic-plain">${esc(title)}</span>`;}).join('')}</div></div><div><div class="panel-eyebrow">Sources</div><div class="curriculum-source-list">${entry.sources.map(source=>`<div class="curriculum-source"><strong>${esc(source.label)}</strong><span class="curriculum-source-meta">${esc(curriculumSourceTypeLabel(source.type))}</span><span class="panel-copy">${esc(curriculumSourceNote(source))}</span></div>`).join('')}</div></div></article>`).join('');
  grid.querySelectorAll('[data-curriculum-lesson]').forEach(link=>link.addEventListener('click',()=>openLessonTopic(link.dataset.curriculumLesson||'')));
}

function renderReactionControls(){
  document.getElementById('rxnControls').innerHTML=Object.entries(reactions).map(([id,r])=>`<button class="rxn-btn ${id===currentReaction?'active':''}" type="button" onclick="showRxn('${id}')">${esc(r.name)}</button>`).join('');
}

function showRxn(id){
  currentReaction=id;
  const r=reactions[id];
  renderReactionControls();
  document.getElementById('rxnDisplay').innerHTML=r.display;
  document.getElementById('rxnInfo').innerHTML=`<div class="panel-eyebrow">Mechanism notes</div><h3>${esc(r.name)}</h3><div class="decision-notes">${r.info.map(x=>`<div class="note-item">${esc(x)}</div>`).join('')}</div>`;
  document.getElementById('rxnCardTitle').textContent=r.name;
  document.getElementById('rxnQuickTake').textContent=r.quick;
  document.getElementById('rxnTags').innerHTML=r.tags.map(tag=>`<span class="chip">${esc(tag)}</span>`).join('');
  document.getElementById('saveReactionBtn').textContent=state.savedReactions.includes(id)?'Remove from saved reactions':'Save reaction for review';
}

function toggleSavedReaction(){
  if(!canUseAccountFeature('Sign in to save reaction review stacks.'))return;
  const wasSaved=state.savedReactions.includes(currentReaction);
  if(wasSaved)state.savedReactions=state.savedReactions.filter(id=>id!==currentReaction);else state.savedReactions=[currentReaction,...state.savedReactions.filter(id=>id!==currentReaction)].slice(0,6);
  saveState();
  renderSavedReactions();renderStats();renderMission();showRxn(currentReaction);
  const reactionName=reactions[currentReaction]?.name||'Reaction';
  window.OrganoApp?.notify?.({
    title:wasSaved?`${reactionName} removed`:`${reactionName} saved`,
    body:wasSaved?'The reaction was removed from your quick review stack.':'The reaction was added to your quick review stack for later review.',
    kind:wasSaved?'info':'success',
    actionHref:'#reactions',
    actionLabel:'Open reactions',
    dedupeKey:`reaction-${currentReaction}`
  });
}

function setupQuiz(){
  const cat=document.getElementById('quizCategory').value,diff=document.getElementById('quizDifficulty').value,len=Number(document.getElementById('quizLength').value);
  const pool=bank.filter(q=>(cat==='all'||q.cat===cat)&&(diff==='all'||q.diff===diff));
  quiz=[...(pool.length?pool:bank)].sort(()=>Math.random()-.5).slice(0,Math.min(len,(pool.length?pool:bank).length));
  qi=0;score=0;answered=false;catResults={};
  quizMeta={category:cat==='all'?'All categories':cat,difficulty:diff==='all'?'Mixed difficulty':diff};
  document.getElementById('quizMeta').textContent=`${quizMeta.category} - ${quizMeta.difficulty}`;
  loadQ();
}

function loadQ(){
  const q=quiz[qi],opts=document.getElementById('qOptions'),fb=document.getElementById('qFeedback');
  if(!q){document.getElementById('qText').textContent='Build a quiz to begin.';document.getElementById('qNum').textContent='0/0';opts.innerHTML='';fb.className='quiz-feedback';document.getElementById('nextBtn').style.display='none';document.getElementById('restartBtn').style.display='none';document.getElementById('scoreDisplay').style.display='none';return;}
  document.getElementById('qText').textContent=q.q;
  document.getElementById('qNum').textContent=`${qi+1}/${quiz.length}`;
  opts.innerHTML='';
  q.opts.forEach((opt,i)=>{const b=document.createElement('button');b.className='quiz-opt';b.textContent=opt;b.onclick=()=>checkA(i);opts.appendChild(b);});
  fb.className='quiz-feedback';fb.textContent='';document.getElementById('nextBtn').style.display='none';document.getElementById('restartBtn').style.display='none';document.getElementById('scoreDisplay').style.display='none';answered=false;
}

function checkA(choice){
  if(answered)return;answered=true;
  const q=quiz[qi],opts=document.querySelectorAll('.quiz-opt'),fb=document.getElementById('qFeedback');
  opts.forEach(b=>b.classList.add('disabled'));
  if(!catResults[q.cat])catResults[q.cat]={correct:0,total:0};
  catResults[q.cat].total+=1;
  if(choice===q.ans){score+=1;catResults[q.cat].correct+=1;opts[choice].classList.add('correct');fb.className='quiz-feedback correct-fb show';fb.textContent=`Correct. ${q.exp}`;}
  else{opts[choice].classList.add('wrong');opts[q.ans].classList.add('correct');fb.className='quiz-feedback wrong-fb show';fb.textContent=`Not quite. ${q.exp}`;}
  if(qi<quiz.length-1)document.getElementById('nextBtn').style.display='inline-block';else showScore();
}

function nextQ(){qi+=1;loadQ();}

function restartQuiz(){
  if(!quiz.length){setupQuiz();return;}
  quiz=[...quiz].sort(()=>Math.random()-.5);qi=0;score=0;answered=false;catResults={};loadQ();
}

function showScore(){
  const pct=Math.round(score/quiz.length*100);
  const msg=[[0,50,'Build back up from the topic explorer and try again.'],[50,75,'Good base. Tighten the weaker categories next.'],[75,90,'Strong understanding. One more focused pass could push this higher.'],[90,101,'Excellent work. The patterns are sticking.']].find(([a,b])=>pct>=a&&pct<b)?.[2]||'';
  document.getElementById('scoreDisplay').style.display='grid';
  document.getElementById('scoreText').textContent=`${score}/${quiz.length} - ${pct}%`;
  document.getElementById('scoreMsg').textContent=msg;
  document.getElementById('scoreBreakdown').innerHTML=Object.entries(catResults).map(([k,v])=>`<div class="score-chip"><strong>${esc(k)}</strong>${v.correct}/${v.total} correct - ${Math.round(v.correct/v.total*100)}%</div>`).join('');
  document.getElementById('restartBtn').style.display='inline-block';
  document.getElementById('nextBtn').style.display='none';
  if(!window.OrganoApp?.isAuthenticated?.()){
    document.getElementById('scoreMsg').textContent=`${msg} Sign in to save quiz history to your account.`;
    renderQuizHistory();
    renderStats();
    renderWeakAreas();
    renderMission();
    window.OrganoApp?.notify?.({
      title:`Quiz complete: ${pct}%`,
      body:`Preview mode finished a ${quizMeta.category} quiz. Sign in to keep quiz history and progress.`,
      kind:pct>=75?'success':'info',
      actionHref:'auth.html',
      actionLabel:'Sign in to save'
    });
    return;
  }
  state.quizHistory.unshift({createdAt:new Date().toISOString(),score,total:quiz.length,percent:pct,category:quizMeta.category,difficulty:quizMeta.difficulty,breakdown:catResults});
  state.quizHistory=state.quizHistory.slice(0,8);
  saveState();
  const completedQuizzesInput=document.getElementById('completedQuizzes');
  if(completedQuizzesInput)completedQuizzesInput.value=String(state.quizHistory.length);
  renderQuizHistory();renderStats();renderWeakAreas();renderMission();
  window.OrganoApp?.notify?.({
    title:`Quiz saved: ${pct}%`,
    body:`${quizMeta.category} at ${quizMeta.difficulty} is now part of your saved quiz history.`,
    kind:pct>=75?'success':'info',
    actionHref:'#quiz',
    actionLabel:'Review quiz history'
  });
}

function renderQuizHistory(){
  const locked=!window.OrganoApp?.isAuthenticated?.();
  document.getElementById('quizHistory').innerHTML=state.quizHistory.map(s=>`<div class="history-item"><strong>${s.percent}% - ${esc(s.category)}</strong>${esc(s.difficulty)} - ${s.score}/${s.total} correct - ${prettyDate(s.createdAt)}</div>`).join('')||(locked?'<div class="history-item"><strong>Sign in to save quiz sessions</strong>Your completed quizzes still work in preview mode, but history is only stored for signed-in users.</div>':'<div class="history-item"><strong>No saved sessions yet</strong>Your completed quizzes will appear here.</div>');
}

function renderReference(){
  const q=document.getElementById('referenceSearch').value.trim().toLowerCase(),family=document.getElementById('referenceFamily').value,diff=document.getElementById('referenceDifficulty').value;
  const rows=refs.filter(([n,f,s,g,p,d])=>(!q||[n,f,s,g,p].join(' ').toLowerCase().includes(q))&&(family==='all'||f===family)&&(diff==='all'||d===diff));
  document.getElementById('referenceSummary').textContent=`${rows.length} result${rows.length===1?'':'s'} shown across the reference explorer.`;
  document.getElementById('referenceBody').innerHTML=rows.map(([n,f,s,g,p,d])=>`<tr><td>${esc(n)}</td><td>${esc(f)}</td><td class="mono">${esc(s)}</td><td class="mono">${esc(g)}</td><td>${esc(p)}</td><td><span class="tag-pill">${esc(d)}</span></td></tr>`).join('');
}

document.getElementById('topicSearch').addEventListener('input',renderTopics);
document.getElementById('topicDifficulty').addEventListener('change',renderTopics);
document.getElementById('topicStatus').addEventListener('change',renderTopics);
document.getElementById('referenceSearch').addEventListener('input',renderReference);
document.getElementById('referenceFamily').addEventListener('change',renderReference);
document.getElementById('referenceDifficulty').addEventListener('change',renderReference);
window.addEventListener('organo:hydrate-main-state',()=>{
  state=readState();
  hydratePlannerInputs();
  renderStats();
  renderStudyPlan();
  renderTopics();
  renderTopicDetail();
  renderCurriculum();
  renderWeakAreas();
  renderSavedReactions();
  showRxn(currentReaction);
  renderMission();
  renderQuizHistory();
  renderReference();
});
window.addEventListener('organo:auth-changed',()=>{
  state=readState();
  hydratePlannerInputs();
  renderStats();
  renderStudyPlan();
  renderWeakAreas();
  renderMission();
  renderSavedReactions();
  showRxn(currentReaction);
  renderQuizHistory();
  renderTopicDetail();
  renderCurriculum();
});
bindPlannerSetupUI();
hydratePlannerInputs();
syncPlannerAISettingsUI();
setPlannerError('');
refreshPlannerActivationState();
renderStats();
renderStudyPlan();
renderTopics();
renderTopicDetail();
renderCurriculum();
renderWeakAreas();
renderSavedReactions();
showRxn(currentReaction);
renderMission();
renderQuizHistory();
renderReference();
heroMoleculeLineup=pickHeroMoleculeLineup();
currentMol=heroMoleculeLineup[0]||Object.keys(mols)[0];
renderHeroMoleculeButtons();
const initialMol=heroMoleculeLineup[Math.floor(Math.random()*heroMoleculeLineup.length)]||currentMol;
drawMol(initialMol,document.querySelector(`#heroMol .rxn-btn[data-mol="${initialMol}"]`));
startHeroRotation();
setupQuiz();
