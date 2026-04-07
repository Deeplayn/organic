const LABELS=window.OrganoThemeLabels||{};
const STORE='oc-state-v2',THEME='oc-theme';
const QuizJourney=window.OrganoQuizJourney||null;
const baseState=QuizJourney?.normalizeMainState?.({})||{topicStatus:{},savedReactions:[],quizHistory:[],studyPlans:[],quizAssessment:null,quizJourney:null,achievements:[]};
const normalizeMainState=value=>QuizJourney?.normalizeMainState?.(value)||{...baseState,...value,topicStatus:value?.topicStatus||{},savedReactions:value?.savedReactions||[],quizHistory:value?.quizHistory||[],studyPlans:value?.studyPlans||[]};
const readState=()=>{try{return normalizeMainState(JSON.parse(localStorage.getItem(STORE)||'{}'));}catch{return normalizeMainState({});}};
let state=readState();
const saveState=()=>{
  state=normalizeMainState(state);
  localStorage.setItem(STORE,JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('organo:state-changed',{detail:{key:STORE}}));
};
const cv=p=>getComputedStyle(document.body).getPropertyValue(p).trim();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const prettyDate=v=>new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const today=()=>new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'});
const AI=window.OrganoAI;
const canUseAccountFeature=message=>window.OrganoApp?.assertFeatureAccess(message)??true;
const ORGANOQUIZO_BOT_NAME='OrganoBot';
const QUIZ_LOCK_MESSAGE='OrganoBot chat is unavailable during quizzes to preserve quiz integrity.';
const PLANNER_TIMELINE_DEFAULTS={
  minDays:7,
  maxDays:28,
  stepDays:1,
  defaultDays:28
};

function setPlannerSliderProgress(slider,courseDays){
  if(!slider)return;
  const progress=((courseDays-PLANNER_TIMELINE_DEFAULTS.minDays)/Math.max(1,PLANNER_TIMELINE_DEFAULTS.maxDays-PLANNER_TIMELINE_DEFAULTS.minDays))*100;
  const boundedProgress=Math.max(0,Math.min(100,progress));
  slider.style.setProperty('--planner-progress',`${boundedProgress}%`);
  slider.setAttribute('aria-valuenow',String(courseDays));
  slider.setAttribute('aria-valuetext',`${courseDays} days`);
}

function readPlannerCourseDays(value){
  return clampCourseDays(value);
}

function togglePanel(){document.getElementById('themePanel')?.classList.toggle('open');}
function closePanel(){document.getElementById('themePanel')?.classList.remove('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.theme-switcher'))closePanel();});
function setTheme(theme,btn,options={}){
  document.body.setAttribute('data-theme',theme);
  const themeLabel=document.getElementById('themeLabel');
  if(themeLabel)themeLabel.textContent=LABELS[theme]||theme;
  document.querySelectorAll('.t-opt').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  localStorage.setItem(THEME,theme);
  closePanel();
  window.dispatchEvent(new CustomEvent('organo:theme-changed',{detail:{theme,userInitiated:options.userInitiated!==false}}));
  setTimeout(()=>drawMol(currentMol),50);
}
const savedTheme=localStorage.getItem(THEME);
if(savedTheme)setTheme(savedTheme,document.querySelector(`.t-opt[data-theme-choice="${savedTheme}"]`),{userInitiated:false});

const todaysCompounds=[
  {
    id:'ethanol',
    cid:702,
    name:'Ethanol',
    wikiUrl:'https://en.wikipedia.org/wiki/Ethanol',
    formula:'C2H6O',
    info:'A light alcohol used across solvents, sanitizers, fuels, and chemical processing.',
    benefit:'Its value comes from serving several markets at once, from industrial solvents to disinfectant products and fuel blending.',
    industry:'PubChem lists ethanol as a major compound entry, and it remains commercially important in manufacturing, lab work, and energy-related formulations.',
    draw(svg){drawEthanolSketch(svg);}
  },
  {
    id:'acetone',
    cid:180,
    name:'Acetone',
    wikiUrl:'https://en.wikipedia.org/wiki/Acetone',
    formula:'C3H6O',
    info:'A fast-evaporating ketone widely used as both a solvent and a chemical intermediate.',
    benefit:'PubChem notes acetone is used to make plastics, fibers, drugs, and other chemicals, which makes it economically useful far beyond simple cleaning applications.',
    industry:'Its ability to dissolve many materials quickly keeps it important in coatings, laboratories, and large-scale chemical production.',
    draw(svg){drawAcetoneSketch(svg);}
  },
  {
    id:'acetic-acid',
    cid:176,
    name:'Acetic Acid',
    wikiUrl:'https://en.wikipedia.org/wiki/Acetic_acid',
    formula:'C2H4O2',
    info:'A simple carboxylic acid that sits at the center of many industrial and food-related processes.',
    benefit:'PubChem notes acetic acid is used to make other chemicals, support petroleum production, and function as a food additive, so one compound supports several value chains.',
    industry:'It matters commercially as a feedstock for synthesis and as a practical ingredient in preservation and process chemistry.',
    draw(svg){drawAceticAcidSketch(svg);}
  },
  {
    id:'toluene',
    cid:1140,
    name:'Toluene',
    wikiUrl:'https://en.wikipedia.org/wiki/Toluene',
    formula:'C7H8',
    info:'An aromatic solvent widely used in paints, adhesives, fuels, and chemical manufacturing.',
    benefit:'Its commercial value comes from strong solvent performance plus its role in coatings, thinners, rubber, and fuel blending workflows.',
    industry:'PubChem identifies it as an important compound entry, and industry uses it wherever fast evaporation and solvency are useful.',
    draw(svg){drawTolueneSketch(svg);}
  },
  {
    id:'d-glucose',
    cid:5793,
    name:'D-Glucose',
    wikiUrl:'https://en.wikipedia.org/wiki/Glucose',
    formula:'C6H12O6',
    info:'A foundational sugar used in food systems, biology, fermentation, and chemical manufacturing.',
    benefit:'PubChem connects glucose to confectionery, infant foods, brewing, medicine, fuel ethanol, and sorbitol production, which gives it broad economic reach.',
    industry:'It is valuable because the same molecule supports nutrition products, fermentation processes, and downstream industrial chemistry.',
    draw(svg){drawGlucoseSketch(svg);}
  }
];
let currentMol=todaysCompounds[0]?.id||'ethanol';

function dayOfYear(date=new Date()){
  const start=new Date(date.getFullYear(),0,0);
  const diff=date-start;
  const oneDay=1000*60*60*24;
  return Math.floor(diff/oneDay);
}

function pickTodaysCompound(date=new Date()){
  if(!todaysCompounds.length)return null;
  const index=(Math.max(1,dayOfYear(date))-1)%todaysCompounds.length;
  return todaysCompounds[index];
}

function moleculeSketchPalette(){
  return{
    bond:cv('--accent'),
    bondSoft:cv('--text-dim'),
    atom:cv('--card'),
    atomStroke:cv('--border'),
    oxygen:cv('--accent2'),
    accent:cv('--accent3'),
    hydrogen:cv('--green-dim'),
    text:cv('--text'),
    orbit:colorMix('var(--accent3)','transparent',12)
  };
}

function colorMix(a,b,amount){
  return `color-mix(in srgb,${a} ${amount}%,${b})`;
}

function drawNode({x,y,r=16,label,fill,stroke,textColor,fontSize=10}){
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="monospace" font-size="${fontSize}">${label}</text>`;
}

function baseSketch(svg,inner){
  if(!svg)return;
  const palette=moleculeSketchPalette();
  svg.innerHTML=`<circle cx="194" cy="56" r="58" fill="none" stroke="${palette.orbit}" stroke-width="1.2" opacity=".7"/><circle cx="194" cy="56" r="88" fill="none" stroke="${palette.orbit}" stroke-width=".8" opacity=".28"/>${inner}`;
  svg.setAttribute('aria-hidden','true');
}

function drawEthanolSketch(svg){
  const p=moleculeSketchPalette();
  baseSketch(svg,`<line x1="44" y1="102" x2="98" y2="102" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/><line x1="130" y1="102" x2="164" y2="78" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/>${drawNode({x:28,y:102,r:18,label:'CH3',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:10})}${drawNode({x:114,y:102,r:18,label:'CH2',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:10})}${drawNode({x:188,y:70,r:16,label:'OH',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:10})}`);
}

function drawAcetoneSketch(svg){
  const p=moleculeSketchPalette();
  baseSketch(svg,`<line x1="46" y1="102" x2="96" y2="102" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/><line x1="132" y1="102" x2="184" y2="102" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/><line x1="118" y1="94" x2="156" y2="72" stroke="${p.oxygen}" stroke-width="2.4" stroke-linecap="round"/><line x1="124" y1="100" x2="162" y2="78" stroke="${p.oxygen}" stroke-width="2.4" stroke-linecap="round"/>${drawNode({x:28,y:102,r:18,label:'CH3',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:10})}${drawNode({x:114,y:102,r:16,label:'CO',fill:p.atom,stroke:p.accent,textColor:p.text,fontSize:10})}${drawNode({x:176,y:70,r:14,label:'O',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:11})}${drawNode({x:202,y:102,r:18,label:'CH3',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:10})}`);
}

function drawAceticAcidSketch(svg){
  const p=moleculeSketchPalette();
  baseSketch(svg,`<line x1="46" y1="102" x2="98" y2="102" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/><line x1="130" y1="102" x2="174" y2="102" stroke="${p.bond}" stroke-width="3" stroke-linecap="round"/><line x1="116" y1="94" x2="154" y2="70" stroke="${p.oxygen}" stroke-width="2.3" stroke-linecap="round"/><line x1="122" y1="100" x2="160" y2="76" stroke="${p.oxygen}" stroke-width="2.3" stroke-linecap="round"/>${drawNode({x:28,y:102,r:18,label:'CH3',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:10})}${drawNode({x:114,y:102,r:16,label:'C',fill:p.atom,stroke:p.accent,textColor:p.text,fontSize:11})}${drawNode({x:170,y:70,r:14,label:'O',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:11})}${drawNode({x:196,y:102,r:16,label:'OH',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:10})}`);
}

function drawTolueneSketch(svg){
  const p=moleculeSketchPalette();
  const cx=122,cy=96,r=38;
  const points=[];
  for(let i=0;i<6;i+=1){
    const angle=(Math.PI/3*i)-Math.PI/6;
    points.push([cx+r*Math.cos(angle),cy+r*Math.sin(angle)]);
  }
  const attach=points[5];
  baseSketch(svg,`<polygon points="${points.map(point=>point.join(',')).join(' ')}" fill="none" stroke="${p.accent}" stroke-width="2.4"/><circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="${p.accent}" stroke-width="1.8" opacity=".5"/><line x1="${attach[0]}" y1="${attach[1]}" x2="${attach[0]-34}" y2="${attach[1]+10}" stroke="${p.bond}" stroke-width="2.8" stroke-linecap="round"/>${drawNode({x:attach[0]-54,y:attach[1]+16,r:16,label:'CH3',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:9})}`);
}

function drawGlucoseSketch(svg){
  const p=moleculeSketchPalette();
  baseSketch(svg,`<line x1="52" y1="98" x2="178" y2="98" stroke="${p.bond}" stroke-width="2.8" stroke-linecap="round"/><line x1="84" y1="98" x2="84" y2="70" stroke="${p.oxygen}" stroke-width="1.8"/><line x1="116" y1="98" x2="116" y2="64" stroke="${p.oxygen}" stroke-width="1.8"/><line x1="148" y1="98" x2="148" y2="70" stroke="${p.oxygen}" stroke-width="1.8"/>${drawNode({x:38,y:98,r:15,label:'CHO',fill:p.atom,stroke:p.accent,textColor:p.text,fontSize:8})}${drawNode({x:84,y:58,r:12,label:'OH',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:8})}${drawNode({x:116,y:52,r:12,label:'OH',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:8})}${drawNode({x:148,y:58,r:12,label:'OH',fill:p.atom,stroke:p.oxygen,textColor:p.oxygen,fontSize:8})}${drawNode({x:194,y:98,r:16,label:'CH2OH',fill:p.atom,stroke:p.atomStroke,textColor:p.text,fontSize:7})}`);
}

function drawMol(name){
  const compound=todaysCompounds.find(item=>item.id===name)||pickTodaysCompound();
  const wrap=document.getElementById('heroMol');
  if(!compound||!wrap)return;
  wrap.classList.remove('is-switching');
  void wrap.offsetWidth;
  wrap.classList.add('is-switching');
  currentMol=compound.id;
  compound.draw?.(document.getElementById('molSvg'));
  document.getElementById('molName').textContent=compound.name;
  document.getElementById('molFormula').textContent=compound.formula;
  document.getElementById('moleculeInfo').textContent=compound.info;
  document.getElementById('moleculeBenefit').textContent=compound.benefit;
  document.getElementById('moleculeIndustry').textContent=compound.industry;
  const dateLabel=document.getElementById('moleculeDate');
  if(dateLabel)dateLabel.textContent=`Featured for ${today()}`;
  const sourceLink=document.getElementById('moleculeSourceLink');
  if(sourceLink){
    sourceLink.href=compound.wikiUrl;
    sourceLink.textContent='Open on Wikipedia';
  }
  clearTimeout(drawMol.fxTimer);
  drawMol.fxTimer=setTimeout(()=>wrap.classList.remove('is-switching'),520);
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
  {q:'The molecular ion peak in mass spectrometry is especially useful for estimating:',opts:['Boiling point','Molecular mass','Solubility','Acidity'],ans:1,exp:'The molecular ion gives a direct clue about the compound molecular mass.',cat:'Spectroscopy',diff:'Advanced'},
  {q:'Which conformer places a substituted cyclohexane group in the more stable position?',opts:['Axial','Equatorial','Planar','Boat'],ans:1,exp:'Bulky substituents prefer the equatorial position to reduce 1,3-diaxial strain.',cat:'Stereochemistry',diff:'Advanced'},
  {q:'Which reagent set most directly converts an alkene into an anti diol?',opts:['Br2, H2O then NaOH','OsO4 then NaHSO3','O3 then Zn','H2, Pd/C'],ans:0,exp:'Halohydrin formation followed by ring closure and opening gives anti-dihydroxylation logic.',cat:'Reaction Mechanisms',diff:'Advanced'},
  {q:'Which acyl derivative is least reactive toward nucleophilic acyl substitution?',opts:['Acid chloride','Anhydride','Ester','Amide'],ans:3,exp:'Amides are least reactive because resonance donation from nitrogen is strongest.',cat:'Functional Groups',diff:'Advanced'},
  {q:'A para-disubstituted benzene usually gives how many aromatic proton signals in 1H NMR when the ring keeps symmetry?',opts:['1','2','4','6'],ans:1,exp:'A symmetric para pattern usually collapses into two aromatic proton environments.',cat:'Spectroscopy',diff:'Advanced'},
  {q:'Which base is best for generating the kinetic enolate of an unsymmetrical ketone?',opts:['NaOH in water','LDA at low temperature','EtOH with heat','HCl in methanol'],ans:1,exp:'LDA at low temperature favors fast deprotonation and the kinetic enolate.',cat:'Reaction Mechanisms',diff:'Advanced'},
  {q:'When assigning E/Z, the higher-priority groups on each alkene carbon are compared using which rule set?',opts:['Cahn-Ingold-Prelog priorities','Octet rule','Huckel rule','Markovnikov rule'],ans:0,exp:'E/Z assignments use the Cahn-Ingold-Prelog priority rules.',cat:'Stereochemistry',diff:'Advanced'},
  {q:'Which sequence best converts a carboxylic acid into an amide?',opts:['SOCl2 then NH3','NaBH4 then NH3','PCC then H2O','H2/Pd then NH3'],ans:0,exp:'The acid is commonly activated to an acid chloride first, then treated with ammonia.',cat:'Reaction Mechanisms',diff:'Advanced'},
  {q:'A nitrile hydrolyzes under strongly acidic conditions to give which final functional group?',opts:['Amine','Aldehyde','Carboxylic acid','Alcohol'],ans:2,exp:'Complete acidic hydrolysis of a nitrile gives a carboxylic acid.',cat:'Functional Groups',diff:'Advanced'},
  {q:'Which aromatic substituent is strongly deactivating yet still ortho/para-directing because of lone-pair donation?',opts:['-NO2','-SO3H','-Cl','-CF3'],ans:2,exp:'Halogens deactivate inductively but direct ortho/para through resonance donation.',cat:'Aromatic Chemistry',diff:'Advanced'},
  {q:'Which carbonyl compound usually shows the aldehydic proton near 9 to 10 ppm in 1H NMR?',opts:['Ketone','Aldehyde','Ester','Amide'],ans:1,exp:'Aldehydic protons commonly appear far downfield near 9 to 10 ppm.',cat:'Spectroscopy',diff:'Advanced'},
  {q:'Which reagent adds across an alkyne to stop at the cis alkene stage?',opts:['Na, NH3(l)','H2, Lindlar catalyst','H2, Pd/C','Br2, CCl4'],ans:1,exp:'Lindlar catalyst gives partial hydrogenation to the cis alkene.',cat:'Reaction Mechanisms',diff:'Advanced'},
  {q:'Which structure can be meso?',opts:['A molecule with one stereocenter','A molecule with two stereocenters and an internal mirror plane','A conformational isomer only','A planar carbocation'],ans:1,exp:'A meso compound contains stereocenters but remains achiral because of internal symmetry.',cat:'Stereochemistry',diff:'Advanced'},
  {q:'Which signal pattern most strongly suggests an ethyl group in 1H NMR?',opts:['Singlet plus singlet','Doublet plus quartet','Triplet plus quartet','Broad singlet only'],ans:2,exp:'An ethyl group often shows a triplet for CH3 and a quartet for CH2.',cat:'Spectroscopy',diff:'Advanced'},
  {q:'Which electrophilic aromatic substitution typically requires generation of the nitronium ion?',opts:['Sulfonation','Nitration','Friedel-Crafts alkylation','Bromination only'],ans:1,exp:'Nitration proceeds through the nitronium ion, NO2+.',cat:'Aromatic Chemistry',diff:'Advanced'},
  {q:'Which product is favored when a tertiary alcohol is dehydrated with strong acid and heat?',opts:['Substitution only','The more substituted alkene','A primary alkene only','No reaction'],ans:1,exp:'Acid-catalyzed dehydration of tertiary alcohols usually follows Zaitsev alkene formation.',cat:'Reaction Mechanisms',diff:'Advanced'},
  {q:'Which statement best explains why pyridine is aromatic but its lone pair is basic?',opts:['Its lone pair is part of the aromatic sextet','Its lone pair sits in an sp2 orbital outside the pi sextet','Its nitrogen is tetrahedral','It has 4n pi electrons'],ans:1,exp:'The lone pair in pyridine sits outside the aromatic pi sextet, so aromaticity is preserved and the pair remains available for basicity.',cat:'Aromatic Chemistry',diff:'Scholar'},
  {q:'Which enolate is favored under thermodynamic control?',opts:['The less substituted enolate formed fastest','The more substituted, more stable enolate','The enolate with fewer alkyl groups','The one formed only at -78 C'],ans:1,exp:'Thermodynamic control favors the more substituted and more stable enolate.',cat:'Reaction Mechanisms',diff:'Scholar'},
  {q:'A compound shows an IR carbonyl near 1715 cm^-1 and a 1H NMR singlet integrating to 9 H near 1.2 ppm. Which fragment is most consistent?',opts:['tert-Butyl ketone','Primary alcohol','Terminal alkyne','Aldehyde'],ans:0,exp:'A tert-butyl group often gives a 9-proton singlet, and the carbonyl signal supports a ketone-containing fragment.',cat:'Spectroscopy',diff:'Scholar'},
  {q:'Which step is rate-determining in a classic electrophilic aromatic substitution?',opts:['Deprotonation to restore aromaticity','Formation of the sigma complex','Diffusion of solvent','Product isolation'],ans:1,exp:'The slow step is usually formation of the non-aromatic sigma complex.',cat:'Aromatic Chemistry',diff:'Scholar'},
  {q:'Which epoxide-opening condition gives attack at the more substituted carbon?',opts:['Strong base only','Neutral water at room temperature','Acidic conditions','No catalyst'],ans:2,exp:'Under acidic conditions, the nucleophile attacks the more substituted carbon of the protonated epoxide.',cat:'Reaction Mechanisms',diff:'Scholar'},
  {q:'Which stereochemical relationship describes (R,S)-2,3-dibromobutane and (S,R)-2,3-dibromobutane?',opts:['Enantiomers','Diastereomers','Identical meso representations','Constitutional isomers'],ans:2,exp:'Those two descriptions can represent the same meso compound when the molecule has an internal plane of symmetry.',cat:'Stereochemistry',diff:'Scholar'},
  {q:'Which sequence best distinguishes an aldehyde from a ketone using mild oxidation logic?',opts:['Treat both with PCC','Use Tollens reagent','Hydrogenate both with H2','Heat both with NaCl'],ans:1,exp:'Tollens reagent oxidizes aldehydes readily while ketones usually do not respond.',cat:'Functional Groups',diff:'Scholar'},
  {q:'Aromatic substitution on anisole is faster than on benzene mainly because methoxy is:',opts:['Strongly electron-withdrawing by resonance','Electron-donating by resonance','Sterically tiny only','Unable to stabilize intermediates'],ans:1,exp:'Methoxy donates by resonance, activating the ring toward electrophilic substitution.',cat:'Aromatic Chemistry',diff:'Scholar'},
  {q:'Which retrosynthetic disconnection is most strategic for building a beta-hydroxy carbonyl product?',opts:['Break the C-C bond formed in the aldol step','Break the O-H bond first','Remove the carbonyl oxygen entirely','Convert it directly into an alkane'],ans:0,exp:'Aldol products are often analyzed by disconnecting the new carbon-carbon bond formed during enolate addition.',cat:'Reaction Mechanisms',diff:'Scholar'},
  {q:'Why is an amide carbonyl less reactive toward nucleophilic addition than an aldehyde carbonyl?',opts:['Amides are always protonated','Nitrogen donates electron density by resonance','Amides lack a pi bond','Aldehydes are aromatic'],ans:1,exp:'Resonance donation from nitrogen reduces electrophilicity at the amide carbonyl carbon.',cat:'Functional Groups',diff:'Scholar'},
  {q:'Which NMR pattern most strongly suggests a para-disubstituted aromatic ring with two equivalent proton sets?',opts:['A complex multiplet spread over six peaks','Two doublets integrating to two protons each','A single 5H multiplet','One broad singlet integrating to four protons'],ans:1,exp:'A symmetric para-disubstituted ring often gives two aromatic doublets, each integrating to two protons.',cat:'Spectroscopy',diff:'Scholar'},
  {q:'Which intermediate best explains allylic bromination with NBS under radical conditions?',opts:['A carbocation','A benzyne','An allylic radical','An enolate'],ans:2,exp:'NBS allylic bromination proceeds through a resonance-stabilized allylic radical.',cat:'Reaction Mechanisms',diff:'Scholar'}
];

const QUIZ_LEVELS=QuizJourney?.QUIZ_LEVELS||['Beginner','Intermediate','Advanced','Scholar'];
const COURSE_LEVELS=QuizJourney?.COURSE_LEVELS||['Beginner','Intermediate','Advanced'];
const QUIZ_MODE_CONFIG={
  evaluation:{label:'Evaluating Exam',historyLabel:'Evaluating exam',defaultLength:20},
  progressive:{label:'Progressive Quiz',historyLabel:'Progressive quiz'},
  final:{label:'End of Course Exam',historyLabel:'End of course exam',defaultLength:30}
};

let activeTopic=topics[0].id,currentReaction='sn2',quiz=[],qi=0,score=0,answered=false,quizMode='evaluation',quizMeta={type:'Evaluating Exam',category:'All categories',difficulty:'Placement ladder'},catResults={},difficultyResults={},questionResults=[],activeQuizSession=null,quizTimerHandle=0,quizJourneyBindingsReady=false;
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

function courseDifficultyFromLearnerLevel(level){
  if(level==='Scholar')return'Advanced';
  return COURSE_LEVELS.includes(level)?level:'Beginner';
}

function normalizeQuizAssessment(value){
  return QuizJourney?.normalizeQuizAssessment?.(value)||null;
}

state.quizAssessment=normalizeQuizAssessment(state.quizAssessment);
state.quizJourney=QuizJourney?.normalizeQuizJourney?.(state.quizJourney,{quizAssessment:state.quizAssessment,quizHistory:state.quizHistory})||state.quizJourney;
state.achievements=QuizJourney?.normalizeAchievements?.(state.achievements)||state.achievements||[];

function getCurriculumTopicLabels(entry=getAssignedCurriculumEntry()){
  return entry?(entry.topics||[]).map(curriculumTopicTitle).filter(Boolean):[];
}

function renderPlannerCurriculumSummary(){
  const node=document.getElementById('plannerCurriculumSummary');
  if(!node)return;
  if(!window.OrganoApp?.isAuthenticated?.()){
    node.textContent='Sign in and complete your profile to attach a curriculum track to the planner and OrganoBot.';
    return;
  }
  const profile=getSignedInProfile();
  if(!profile.curriculumTrack){
    node.textContent='No curriculum is attached to this account yet. Complete your profile to let the planner and OrganoBot adapt to your assigned track.';
    return;
  }
  const entry=getAssignedCurriculumEntry();
  if(!entry){
    node.textContent=`Curriculum "${profile.curriculumTrack}" is saved on your account, but it is not present in the loaded curriculum library.`;
    return;
  }
  node.textContent=`Planner and OrganoBot are using ${entry.title}${profile.academicYear?` for ${profile.academicYear}`:''}. ${entry.topics.length} curriculum topics will be used to bias roadmap priorities, study guidance, and explanations.`;
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
    difficulty:['all','Beginner','Intermediate','Advanced','Scholar'].includes(difficulty)?difficulty:'all',
    length:[5,8,10].includes(length)?length:5
  };
}

function getLatestStoredPlan(){
  const cached=AI?.readPlannerCache?.()||{};
  if(cached&&typeof cached==='object'&&(cached.roadmap||cached.tasks||cached.summary))return cached;
  return null;
}

function hasCurrentStudyPlan(){
  if(getLatestStoredPlan())return true;
  return Array.isArray(state.studyPlans)&&state.studyPlans.length>0;
}

function simplifyStudyPlanForQuiz(plan=getLatestStoredPlan()){
  if(!plan||typeof plan!=='object')return null;
  return{
    summary:typeof plan.summary==='string'?plan.summary:'',
    focusArea:typeof plan.focusArea==='string'?plan.focusArea:(typeof plan.inputs?.focusArea==='string'?plan.inputs.focusArea:'all'),
    priorityTopics:Array.isArray(plan.priorityTopics)?plan.priorityTopics.slice(0,6):[],
    roadmap:Array.isArray(plan.roadmap)?plan.roadmap.slice(0,4).map((entry,index)=>({
      step:index+1,
      goal:normalizeText(entry?.goal,''),
      topics:normalizeStringArray(entry?.topics,[]).slice(0,4),
      notes:normalizeText(entry?.notes,''),
      quizzes:Math.max(0,Math.round(Number(entry?.quizzes)||0)),
      majorExam:Boolean(entry?.majorExam)
    })):[],
    nextSession:plan.nextSession?{
      title:normalizeText(plan.nextSession.title,''),
      totalMinutes:Math.max(0,Math.round(Number(plan.nextSession.totalMinutes)||0)),
      blocks:Array.isArray(plan.nextSession.blocks)?plan.nextSession.blocks.slice(0,6).map((block,index)=>({
        label:normalizeText(block?.label,`Block ${index+1}`),
        minutes:Math.max(1,Math.round(Number(block?.minutes)||0)),
        activity:normalizeText(block?.activity,'review')
      })):[]
    }:null
  };
}

function getAverageQuizScore(){
  return state.quizHistory.length?Math.round(state.quizHistory.reduce((sum,item)=>sum+item.percent,0)/state.quizHistory.length):0;
}

function setPlannerStatus(message){
  const box=document.getElementById('plannerStatus');
  if(!box)return;
  const text=typeof message==='string'?message.trim():'';
  box.textContent=text;
  box.hidden=!text;
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
  const courseWeeks=Math.max(1,Math.ceil(courseDays/7));
  let sessionMinutes=35;
  let recommendedQuizzesPerWeek=2;
  let plannedMajorExams=2;
  let mode='Balanced month';
  if(courseDays<=7){
    sessionMinutes=75;
    recommendedQuizzesPerWeek=4;
    plannedMajorExams=1;
    mode='Rapid sprint';
  }else if(courseDays<=14){
    sessionMinutes=50;
    recommendedQuizzesPerWeek=3;
    plannedMajorExams=1;
    mode='Focused push';
  }else if(courseDays<=21){
    sessionMinutes=35;
    recommendedQuizzesPerWeek=2;
    plannedMajorExams=2;
    mode='Steady climb';
  }else{
    sessionMinutes=35;
    recommendedQuizzesPerWeek=2;
    plannedMajorExams=2;
    mode='Balanced month';
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

function syncPlannerTimelineUI(sourceDays){
  const slider=document.getElementById('plannerCourseDays');
  const daysInput=document.getElementById('courseDays');
  const weeksInput=document.getElementById('courseWeeks');
  const minutesSelect=document.getElementById('sessionMinutes');
  if(!slider||!daysInput||!weeksInput||!minutesSelect)return;
  const courseDays=readPlannerCourseDays(
    sourceDays??slider.value??daysInput.value??PLANNER_TIMELINE_DEFAULTS.defaultDays
  );
  const timeline=derivePlannerTimeline(courseDays);
  slider.value=String(timeline.courseDays);
  setPlannerSliderProgress(slider,timeline.courseDays);
  daysInput.value=String(timeline.courseDays);
  weeksInput.value=String(timeline.courseWeeks);
  minutesSelect.value=String(timeline.sessionMinutes);

  const daysLabel=document.getElementById('plannerCourseDaysValue');
  const daysMeta=document.getElementById('plannerCourseDaysMeta');
  const mode=document.getElementById('plannerModeValue');
  const derivedTimeline=document.getElementById('plannerDerivedTimeline');
  const derivedSession=document.getElementById('plannerDerivedSessionLength');
  const derivedQuizzes=document.getElementById('plannerDerivedQuizzes');

  if(daysLabel)daysLabel.textContent=`${timeline.courseDays} days`;
  if(daysMeta)daysMeta.textContent=`${timeline.courseDays} days total / ${timeline.sessionMinutes} min sessions`;
  if(mode)mode.textContent=timeline.mode;
  if(derivedTimeline)derivedTimeline.value=`${timeline.courseDays} days total`;
  if(derivedSession)derivedSession.value=`${timeline.sessionMinutes} minutes`;
  if(derivedQuizzes)derivedQuizzes.value=`${timeline.plannedQuizzes} total / ${timeline.recommendedQuizzesPerWeek} every 7 days`;
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
    const releaseSlider=()=>{
      slider.classList.remove('is-dragging');
      syncPlannerTimelineUI();
    };
    slider.addEventListener('input',()=>syncPlannerTimelineUI(slider.value));
    slider.addEventListener('change',releaseSlider);
    slider.addEventListener('pointerdown',()=>{
      slider.classList.add('is-dragging');
    });
    slider.addEventListener('pointerup',releaseSlider);
    slider.addEventListener('pointercancel',releaseSlider);
    slider.addEventListener('blur',()=>slider.classList.remove('is-dragging'));
    window.addEventListener('pointerup',()=>slider.classList.remove('is-dragging'));
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
  setPlannerStatus('');
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
    completedQuizzes:Math.max(0,state.quizHistory.length),
    completedMajorExams:0,
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
  if(cachedInputs?.startingLevel)document.getElementById('startingLevel').value=cachedInputs.startingLevel;
  else if(COURSE_LEVELS.includes(state.quizAssessment?.recommendedCourseDifficulty))document.getElementById('startingLevel').value=state.quizAssessment.recommendedCourseDifficulty;
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
  Promise.resolve(setupQuiz()).then(()=>{
    document.getElementById('quiz').scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>document.querySelector('#qOptions .quiz-opt')?.focus(),120);
  });
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

function plannerDayRangeLabel(segment,totalSegments,totalDays){
  const safeSegment=Math.max(1,Math.round(Number(segment)||1));
  const safeTotalSegments=Math.max(1,Math.round(Number(totalSegments)||1));
  const safeTotalDays=Math.max(safeSegment,Math.round(Number(totalDays)||safeTotalSegments*7));
  const start=Math.floor(((safeSegment-1)*safeTotalDays)/safeTotalSegments)+1;
  const end=Math.max(start,Math.floor((safeSegment*safeTotalDays)/safeTotalSegments));
  return start===end?`Day ${start}`:`Days ${start}-${end}`;
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
  const weeksToShow=Math.max(1,input.courseWeeks);
  const normalized=source.slice(0,weeksToShow).map((entry,index)=>({
    week:index+1,
    goal:normalizeText(entry?.goal,`Build stage ${index+1} around ${input.focusArea==='all'?'core organic chemistry patterns':input.focusArea}.`),
    topics:normalizeStringArray(entry?.topics,[topicsPool[index%topicsPool.length]]).slice(0,4),
    quizzes:Math.max(1,Math.min(5,Number(entry?.quizzes)||input.recommendedQuizzesPerWeek||2)),
    majorExam:Boolean(entry?.majorExam),
    notes:normalizeText(entry?.notes,'Use retrieval plus worked examples to keep this day block active.')
  }));
  while(normalized.length<weeksToShow){
    const index=normalized.length;
    normalized.push({
      week:index+1,
      goal:`Strengthen ${input.focusArea==='all'?'organic chemistry foundations':input.focusArea} with a steady stage-${index+1} push.`,
      topics:[topicsPool[index%topicsPool.length]],
      quizzes:Math.max(1,Math.min(5,input.recommendedQuizzesPerWeek||2)),
      majorExam:false,
      notes:'Keep one quiz, one review block, and one worked-example block every 7 days.'
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

function normalizeTodoItems(todo,input,{roadmap,blocks,priorityTopics,examMilestones,advice,focusLabel}){
  const allowedTypes=['study','quiz','review','checkpoint'];
  const normalizedSource=(Array.isArray(todo)?todo:[]).map((item,index)=>{
    if(typeof item==='string'){
      return{
        title:normalizeText(item,`Task ${index+1}`),
        detail:'',
        type:'study'
      };
    }
    return{
      title:normalizeText(item?.title,`Task ${index+1}`),
      detail:normalizeText(item?.detail,''),
      type:allowedTypes.includes(item?.type)?item.type:'study'
    };
  }).filter(item=>item.title);
  if(normalizedSource.length)return normalizedSource.slice(0,6);
  const primaryRoadmap=roadmap[0]||null;
  const openingBlock=blocks[0]||null;
  const focusTopic=priorityTopics[0]||focusLabel;
  const weakest=weakCats()[0]||null;
  const nextExam=examMilestones[0]||null;
  const fallback=[
    {
      title:openingBlock?`Finish today's ${input.sessionMinutes}-minute session`:'Complete the first study session',
      detail:openingBlock?`Start with "${openingBlock.label}" and work through the remaining planner blocks in order.`:`Use the planner blocks to complete one full chemistry session today.`,
      type:'study'
    },
    {
      title:`Review ${weakest?.cat||focusTopic}`,
      detail:weakest?`This is currently your lowest quiz category at ${weakest.p}% accuracy, so rebuild the core rules and one example.`:`Use this as the first review lane before branching into other chemistry topics.`,
      type:'review'
    },
    {
      title:primaryRoadmap?`Cover ${primaryRoadmap.goal}`:`Advance the roadmap by one stage`,
      detail:primaryRoadmap?`Focus on ${primaryRoadmap.topics.join(', ')} during ${plannerDayRangeLabel(primaryRoadmap.week,Math.max(1,input.courseWeeks),Math.max(1,input.courseDays))}.`:`Use the roadmap cards to finish the next stage of your course plan.`,
      type:'study'
    },
    {
      title:`Run ${Math.max(1,input.recommendedQuizzesPerWeek||1)} quiz${Math.max(1,input.recommendedQuizzesPerWeek||1)===1?'':'zes'} this week`,
      detail:`Keep retrieval active across the ${input.courseDays}-day plan, with extra emphasis on ${focusTopic}.`,
      type:'quiz'
    },
    {
      title:nextExam?`Prepare for the ${nextExam.type} checkpoint`:'Prepare for your next checkpoint',
      detail:nextExam?`Aim for ${plannerDayRangeLabel(nextExam.week,Math.max(1,input.courseWeeks),Math.max(1,input.courseDays))} and focus on ${nextExam.focus}.`:(advice[0]||'Use your advice panel to decide the next checkpoint focus.'),
      type:'checkpoint'
    }
  ];
  return fallback.slice(0,5);
}

function resolvePlanTodo(plan){
  if(!plan||typeof plan!=='object')return[];
  const focusLabel=plan.focusArea==='all'||!normalizeText(plan.focusArea,'')?'Balanced review':plan.focusArea;
  const input={
    focusArea:typeof plan.focusArea==='string'?plan.focusArea:'all',
    sessionMinutes:Math.max(1,Math.round(Number(plan.nextSession?.totalMinutes)||Number(plan.inputs?.sessionMinutes)||35)),
    recommendedQuizzesPerWeek:Math.max(1,Math.round(Number(plan.quizStrategy?.recommendedPerWeek)||Number(plan.inputs?.recommendedQuizzesPerWeek)||2)),
    courseWeeks:Math.max(1,Math.round(Number(plan.inputs?.courseWeeks)||plan.roadmap?.length||1)),
    courseDays:Math.max(1,Math.round(Number(plan.inputs?.courseDays)||((plan.roadmap?.length||1)*7)))
  };
  return normalizeTodoItems(plan.todo,input,{
    roadmap:Array.isArray(plan.roadmap)?plan.roadmap:[],
    blocks:Array.isArray(plan.nextSession?.blocks)?plan.nextSession.blocks:[],
    priorityTopics:Array.isArray(plan.priorityTopics)?plan.priorityTopics:[],
    examMilestones:Array.isArray(plan.examMilestones)?plan.examMilestones:[],
    advice:Array.isArray(plan.advice)?plan.advice:[],
    focusLabel
  });
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
  const advice=normalizeStringArray(raw?.advice,['Keep a short error log after each quiz.','Use the roadmap as a rhythm, not as a rigid script.']).slice(0,5);
  const todo=normalizeTodoItems(raw?.todo,input,{
    roadmap,
    blocks,
    priorityTopics,
    examMilestones:normalizedMilestones,
    advice,
    focusLabel
  });
  return{
    source,
    createdAt:new Date().toISOString(),
    inputs:{...input},
    focusArea:input.focusArea,
    summary:normalizeText(raw?.summary,`Build from ${input.startingLevel.toLowerCase()} toward mastery by spacing quizzes, topic rebuilds, and major exams across ${input.courseDays} days${input.curriculum?.track?` while staying aligned with ${input.curriculum.track}${input.curriculum?.academicYear?` for ${input.curriculum.academicYear}`:''}.`:'.'}`),
    learnerProfile:{
      startingLevel:normalizeText(raw?.learnerProfile?.startingLevel,input.startingLevel),
      targetLevel:'Master',
      pace:normalizeText(raw?.learnerProfile?.pace,`${input.sessionMinutes}-minute sessions across ${input.courseDays} days`)
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
    todo,
    examMilestones:normalizedMilestones,
    priorityTopics,
    advice
  };
}

function renderLegacyPlan(plan){
  const box=document.getElementById('studyPlan');
  if(!plan?.tasks?.length){
    box.innerHTML='<div class="plan-empty">No plan generated yet. Generate an AI roadmap to get started.</div>';
    return;
  }
  box.innerHTML=`<details class="plan-collapsible" open>
    <summary>
      <span>To Do</span>
      <span class="plan-collapsible-meta">${plan.tasks.length} planner task${plan.tasks.length===1?'':'s'}</span>
    </summary>
    <div class="planner-todo-list">${plan.tasks.map((task,index)=>`<article class="planner-todo-item"><div class="planner-todo-top"><strong>${esc(task.title)}</strong><span class="planner-todo-type">Study</span></div><div class="plan-note">${esc(task.copy||`${task.min||0} min`)}</div>${task.meta?`<div class="plan-note">${esc(task.meta)}</div>`:''}${task.quizPreset?`<div class="plan-actions"><button class="btn btn-secondary plan-action" type="button" onclick="startPlanQuiz('${esc(task.quizPreset.category)}',${task.quizPreset.length},'${esc(task.quizPreset.difficulty)}')">${esc(task.actionLabel||'Start planned quiz')}</button></div>`:''}</article>`).join('')}</div>
  </details>`;
}

function renderStudyPlan(plan=getLatestStoredPlan()){
  const box=document.getElementById('studyPlan');
  if(!plan){
    box.innerHTML='<div class="plan-empty"><strong>No roadmap generated yet.</strong><div>Generate a day-based roadmap and next session with the built-in AI.</div></div>';
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
  const resolvedTodo=resolvePlanTodo(plan);
  const todoItems=resolvedTodo.map(item=>`<article class="planner-todo-item"><div class="planner-todo-top"><strong>${esc(item.title)}</strong><span class="planner-todo-type">${esc(item.type||'study')}</span></div><div class="plan-note">${esc(item.detail||'Follow the planner guidance for this task.')}</div></article>`).join('');
  const roadmapSegments=Math.max(1,plan.inputs?.courseWeeks||plan.roadmap?.length||1);
  const roadmapDays=Math.max(1,plan.inputs?.courseDays||roadmapSegments*7);
  box.innerHTML=`<div class="plan-shell">
    <div class="plan-summary">
      <div class="plan-source">${summaryChips}</div>
      <h4>${esc(plan.nextSession?.title||'Organic chemistry roadmap')}</h4>
      <div class="plan-note">${esc(plan.summary||'')}</div>
      <div class="plan-note">Pace: ${esc(plan.learnerProfile?.pace||'Custom pacing')}</div>
    </div>
    <details class="plan-collapsible" open>
      <summary>
        <span>To Do</span>
        <span class="plan-collapsible-meta">${resolvedTodo.length} planner task${resolvedTodo.length===1?'':'s'}</span>
      </summary>
      <div class="planner-todo-list">${todoItems||'<div class="plan-note">Generate a roadmap to let the planner organize your next tasks.</div>'}</div>
    </details>
    <div class="plan-columns">
      <div class="plan-panel">
        <h4>Roadmap</h4>
        <div class="roadmap-grid">${(plan.roadmap||[]).map(week=>`<article class="roadmap-card"><div class="roadmap-week">${plannerDayRangeLabel(week.week,roadmapSegments,roadmapDays)}${week.majorExam?' - Major exam':''}</div><strong>${esc(week.goal)}</strong><div class="roadmap-topics">${(week.topics||[]).map(topic=>`<span class="roadmap-topic">${esc(topic)}</span>`).join('')}</div><div class="plan-note">${esc(week.notes)}</div><div class="activity-badge">${week.quizzes} quiz${week.quizzes===1?'':'zes'} planned</div></article>`).join('')}</div>
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
          <li><strong>${plan.inputs?.plannedQuizzes||0} quizzes planned</strong>${esc(plan.quizStrategy?.reason||'')} ${esc(`${plan.quizStrategy?.recommendedPerWeek||2} every 7 days across ${plan.inputs?.courseDays||0} days.`)}</li>
          ${(plan.examMilestones||[]).map(item=>`<li><strong>${plannerDayRangeLabel(item.week,roadmapSegments,roadmapDays)} - ${esc(item.type)}</strong>${esc(item.focus)}</li>`).join('')}
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

async function buildStudyPlan(){
  if(!canUseAccountFeature('Sign in to save AI roadmaps and planner history.'))return;
  if(!ensurePlanGenerationAllowed())return;
  if(!ensureFirstPlanEvaluationDecision())return;
  const input=readPlannerInputs();
  if(!AI){
    setPlannerError('The built-in AI module did not load, so the AI roadmap is unavailable.');
    setPlannerStatus('The built-in AI is unavailable right now.');
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
    renderQuizJourney();
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
    setPlannerError(AI.normalizeAIError(error));
  }finally{
    window.OrganoApp?.hideLoader?.();
  }
}

function resetPlannerData(){
  if(!canUseAccountFeature('Sign in to manage planner history and stored progress.'))return;
  if(!confirm('Reset planner data? This clears saved study plans and cached roadmap data, but keeps your quiz journey, badges, theme, topic marks, saved reactions, material studio state, and OrganoBot chats.'))return;
  state.studyPlans=[];
  saveState();
  AI?.clearPlannerCache?.();
  setPlannerError('');
  setPlannerStatus('Planner data cleared. Your quiz journey, badges, theme, topic status, saved reactions, material studio state, and OrganoBot chats were preserved.');
  renderStats();
  renderStudyPlan();
  renderQuizJourney();
  window.OrganoApp?.notify?.({
    title:'Planner data cleared',
    body:'Saved roadmaps and cached planner data were reset for a clean restart.',
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
  const topicCount=visibleEntries.reduce((count,entry)=>count+entry.topics.length,0);
  summaryNode.textContent=`Showing ${activeCurriculumCountry} with ${visibleEntries.length} track${visibleEntries.length===1?'':'s'} and ${topicCount} topic${topicCount===1?'':'s'} in view.`;
  grid.innerHTML=visibleEntries.map(entry=>`<article class="dashboard-panel curriculum-card"><div class="panel-header"><div><div class="panel-eyebrow">${esc(entry.country)}</div><h3>${esc(curriculumLevelLabel(entry.level))}</h3></div><span class="status-pill">${entry.topics.length} topics</span></div><p class="panel-copy">${esc(entry.title)}</p><div class="curriculum-meta"><span class="topic-tag">${esc(curriculumLevelLabel(entry.level))}</span><span class="topic-tag">${entry.sources.length} source${entry.sources.length===1?'':'s'}</span></div><div><div class="panel-eyebrow">Topics</div><div class="curriculum-topic-list">${entry.topics.map(topic=>`<span class="curriculum-topic-plain">${esc(curriculumTopicTitle(topic))}</span>`).join('')}</div></div><div><div class="panel-eyebrow">Sources</div><div class="curriculum-source-list">${entry.sources.map(source=>`<div class="curriculum-source"><strong>${esc(source.label)}</strong><span class="curriculum-source-meta">${esc(curriculumSourceTypeLabel(source.type))}</span><span class="panel-copy">${esc(curriculumSourceNote(source))}</span></div>`).join('')}</div></div></article>`).join('');
}

function renderReactionControls(){
  const controls=document.getElementById('rxnControls');
  if(!controls)return;
  controls.innerHTML=Object.entries(reactions).map(([id,r])=>`<button class="rxn-btn ${id===currentReaction?'active':''}" type="button" onclick="showRxn('${id}')">${esc(r.name)}</button>`).join('');
}

function showRxn(id){
  currentReaction=id;
  const r=reactions[id];
  const display=document.getElementById('rxnDisplay');
  const info=document.getElementById('rxnInfo');
  const title=document.getElementById('rxnCardTitle');
  const quickTake=document.getElementById('rxnQuickTake');
  const tags=document.getElementById('rxnTags');
  const saveButton=document.getElementById('saveReactionBtn');
  if(!display||!info||!title||!quickTake||!tags||!saveButton)return;
  renderReactionControls();
  display.innerHTML=r.display;
  info.innerHTML=`<div class="panel-eyebrow">Mechanism notes</div><h3>${esc(r.name)}</h3><div class="decision-notes">${r.info.map(x=>`<div class="note-item">${esc(x)}</div>`).join('')}</div>`;
  title.textContent=r.name;
  quickTake.textContent=r.quick;
  tags.innerHTML=r.tags.map(tag=>`<span class="chip">${esc(tag)}</span>`).join('');
  saveButton.textContent=state.savedReactions.includes(id)?'Remove from saved reactions':'Save reaction for review';
}

function learnerLevelRank(level){
  return Math.max(0,QUIZ_LEVELS.indexOf(level));
}

function getCourseDifficultyContext(){
  const plannerLevel=document.getElementById('startingLevel')?.value;
  if(COURSE_LEVELS.includes(plannerLevel))return{level:plannerLevel,source:'planner setup'};
  if(COURSE_LEVELS.includes(state.quizAssessment?.recommendedCourseDifficulty))return{level:state.quizAssessment.recommendedCourseDifficulty,source:'evaluation result'};
  const curriculumEntry=getAssignedCurriculumEntry();
  if(curriculumEntry)return{level:curriculumLevelStartingLevel(curriculumEntry.level),source:'curriculum track'};
  return{level:'Beginner',source:'default course setup'};
}

function getLearnerLevelContext(){
  if(QUIZ_LEVELS.includes(state.quizAssessment?.level))return{level:state.quizAssessment.level,source:'evaluation result'};
  const course=getCourseDifficultyContext();
  return{level:course.level,source:course.source};
}

function resolveProgressiveQuizLength(level){
  return Math.max(7,Math.min(10,7+learnerLevelRank(level)));
}

function difficultyFallbackOrder(level){
  if(level==='Advanced')return['Advanced','Scholar','Intermediate','Beginner'];
  if(level==='Intermediate')return['Intermediate','Advanced','Beginner','Scholar'];
  return['Beginner','Intermediate','Advanced','Scholar'];
}

function higherDifficultyOrder(level){
  if(level==='Advanced')return['Scholar'];
  if(level==='Intermediate')return['Advanced','Scholar'];
  return['Intermediate','Advanced','Scholar'];
}

function getEffectiveQuizCategory(mode){
  const selected=document.getElementById('quizCategory')?.value||'all';
  if(selected!=='all')return selected;
  if(['progressive','monthly','final'].includes(mode)){
    const focus=document.getElementById('studyFocus')?.value||'all';
    if(quizCategoryExists(focus))return focus;
  }
  return'all';
}

function sampleQuestions({count,category='all',difficulties=[],exclude=[]}){
  const excludeSet=new Set((exclude||[]).map(item=>item.q));
  const result=[];
  const seen=new Set();
  const passes=[
    {category,difficulties},
    ...(category!=='all'?[{category:'all',difficulties}]:[]),
    {category,difficulties:[]},
    ...(category!=='all'?[{category:'all',difficulties:[]}]:[])
  ];
  passes.forEach(pass=>{
    if(result.length>=count)return;
    const pool=shuffleList(bank.filter(item=>{
      if(excludeSet.has(item.q)||seen.has(item.q))return false;
      if(pass.category!=='all'&&item.cat!==pass.category)return false;
      if(Array.isArray(pass.difficulties)&&pass.difficulties.length&&!pass.difficulties.includes(item.diff))return false;
      return true;
    }));
    pool.forEach(item=>{
      if(result.length>=count||seen.has(item.q))return;
      seen.add(item.q);
      result.push(item);
    });
  });
  return result.slice(0,count);
}

function buildQuizMetaText(meta=quizMeta,questionIndex=qi){
  const questionNumber=questionIndex+1;
  const activeBlock=Array.isArray(meta.blockLabels)?meta.blockLabels.find(block=>questionNumber>=block.start&&questionNumber<=block.end):null;
  const base=activeBlock?`${meta.type} - ${activeBlock.label}`:`${meta.type} - ${meta.category} - ${meta.difficulty}`;
  return meta.generator?`${base} - ${meta.generator}`:base;
}

function buildQuizAnswerExplanation(question){
  const correctChoice=question?.opts?.[question?.ans]||'The correct answer';
  const reason=normalizeText(question?.exp,'It fits the key chemistry clue best, while the other choices do not match the structure, mechanism, naming rule, or data.');
  return `Correct answer: ${correctChoice}. ${reason}`;
}

function beginQuizSession(nextQuiz,nextMeta){
  quiz=nextQuiz;
  quizMeta=nextMeta;
  qi=0;score=0;answered=false;catResults={};difficultyResults={};questionResults=[];
  document.getElementById('quizMeta').textContent=buildQuizMetaText(quizMeta,0);
  loadQ();
}

function showQuizBuildState(message,detail){
  const opts=document.getElementById('qOptions');
  const feedback=document.getElementById('qFeedback');
  document.getElementById('qText').textContent=message;
  document.getElementById('qNum').textContent='...';
  document.getElementById('quizMeta').textContent=`${ORGANOQUIZO_BOT_NAME} is preparing your quiz`;
  opts.innerHTML='';
  feedback.className='quiz-feedback show';
  feedback.textContent=detail;
  document.getElementById('nextBtn').style.display='none';
  document.getElementById('restartBtn').style.display='none';
  document.getElementById('scoreDisplay').style.display='none';
}

function normalizeAdaptiveBlockLabels(rawLabels,totalQuestions){
  const safeTotal=Math.max(1,Math.round(Number(totalQuestions)||1));
  return(Array.isArray(rawLabels)?rawLabels:[]).map((block,index)=>({
    start:Math.max(1,Math.min(safeTotal,Math.round(Number(block?.start)||index+1))),
    end:Math.max(1,Math.min(safeTotal,Math.round(Number(block?.end)||index+1))),
    label:normalizeText(block?.label,'')
  })).filter(block=>block.label).map(block=>({
    ...block,
    end:Math.max(block.start,block.end)
  }));
}

function normalizeAdaptiveQuizQuestion(raw,request){
  const questionText=normalizeText(raw?.q,'');
  const options=(Array.isArray(raw?.opts)?raw.opts:[]).slice(0,4).map(option=>normalizeText(option,'')).filter(Boolean);
  const uniqueOptionCount=new Set(options.map(option=>option.toLowerCase())).size;
  if(!questionText||options.length!==4||uniqueOptionCount!==4)return null;
  const answerIndex=Math.max(0,Math.min(3,Math.round(Number(raw?.ans)||0)));
  const fallbackCategory=request.effectiveCategory==='all'
    ?categoryFromText(`${questionText} ${options.join(' ')}`,request.selectedCategory==='all'?'Functional Groups':request.selectedCategory)
    :request.effectiveCategory;
  return{
    q:questionText,
    opts:options,
    ans:answerIndex,
    exp:normalizeText(raw?.exp,'It fits the key clue best, while the other choices miss the required structural, naming, mechanistic, or spectroscopy detail.'),
    cat:chemistryCategories().includes(raw?.cat)?raw.cat:fallbackCategory,
    diff:QUIZ_LEVELS.includes(raw?.diff)?raw.diff:request.effectiveDifficulty
  };
}

function buildAdaptiveQuizRequest({selectedCategory,selectedDifficulty,selectedLength,effectiveCategory,course,learner,categoryLabel}){
  const plannerInput=readPlannerInputs();
  const studyPlan=simplifyStudyPlanForQuiz();
  const effectiveDifficulty=selectedDifficulty==='all'
    ?(quizMode==='practice'?learner.level:course.level)
    :selectedDifficulty;
  const requestedLength=quizMode==='progressive'
    ?resolveProgressiveQuizLength(learner.level)
    :quizMode==='monthly'
      ?20
      :quizMode==='final'
        ?30
        :selectedLength;
  return{
    input:{
      mode:quizMode,
      requestedLength,
      selectedCategory,
      effectiveCategory,
      categoryLabel,
      selectedDifficulty,
      effectiveDifficulty,
      courseLevel:course.level,
      courseSource:course.source,
      learnerLevel:learner.level,
      learnerSource:learner.source,
      focusArea:plannerInput.focusArea,
      studyPlan,
      availableCategories:chemistryCategories(),
      availableDifficulties:QUIZ_LEVELS
    },
    progress:{
      ...buildProgressSnapshot(plannerInput),
      studyPlan,
      latestQuizMode:quizMode
    }
  };
}

async function buildAdaptiveQuizSet(request){
  if(!AI?.requestAdaptiveQuiz)throw new Error('OrganoBot is unavailable.');
  showQuizBuildState(
    `${ORGANOQUIZO_BOT_NAME} is building your quiz...`,
    'Generating adaptive questions from your study plan, learner level, and weak areas.'
  );
  const rawQuiz=await AI.requestAdaptiveQuiz(request);
  const questions=(Array.isArray(rawQuiz?.questions)?rawQuiz.questions:[])
    .map(question=>normalizeAdaptiveQuizQuestion(question,request.input))
    .filter(Boolean)
    .slice(0,request.input.requestedLength);
  if(questions.length!==request.input.requestedLength){
    throw new Error(`${ORGANOQUIZO_BOT_NAME} returned an incomplete quiz.`);
  }
  const difficultyLabel=request.input.selectedDifficulty==='all'
    ?request.input.effectiveDifficulty
    :request.input.selectedDifficulty;
  beginQuizSession(questions,{
    mode:quizMode,
    type:normalizeText(rawQuiz?.title,QUIZ_MODE_CONFIG[quizMode]?.label||'Adaptive Quiz'),
    category:request.input.categoryLabel,
    difficulty:difficultyLabel==='all'?'Mixed difficulty':difficultyLabel,
    length:questions.length,
    generator:ORGANOQUIZO_BOT_NAME,
    strategy:normalizeText(rawQuiz?.strategy,''),
    blockLabels:normalizeAdaptiveBlockLabels(rawQuiz?.blockLabels,questions.length)
  });
}

function buildLocalQuizSet({generator=''}={}){
  const selectedCategory=document.getElementById('quizCategory').value;
  const selectedDifficulty=document.getElementById('quizDifficulty').value;
  const selectedLength=Number(document.getElementById('quizLength').value);
  const effectiveCategory=getEffectiveQuizCategory(quizMode);
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const categoryLabel=selectedCategory==='all'?(effectiveCategory==='all'?'All categories':`${effectiveCategory} focus`):selectedCategory;
  let nextQuiz=[];
  let nextMeta={mode:quizMode,type:QUIZ_MODE_CONFIG[quizMode].label,category:categoryLabel,difficulty:'Mixed difficulty',length:selectedLength,generator};
  if(quizMode==='evaluation'){
    nextQuiz=[
      ...sampleQuestions({count:5,category:'all',difficulties:['Beginner']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Intermediate']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Advanced']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Scholar']})
    ];
    nextMeta={
      mode:quizMode,
      type:QUIZ_MODE_CONFIG[quizMode].label,
      category:'All categories',
      difficulty:'Beginner to Scholar',
      blockLabels:[
        {start:1,end:5,label:'Beginner ladder'},
        {start:6,end:10,label:'Intermediate ladder'},
        {start:11,end:15,label:'Advanced ladder'},
        {start:16,end:20,label:'Scholar ladder'}
      ]
    };
  }else if(quizMode==='progressive'){
    const length=resolveProgressiveQuizLength(learner.level);
    nextQuiz=shuffleList(sampleQuestions({count:length,category:effectiveCategory,difficulties:difficultyFallbackOrder(course.level)}));
    nextMeta={mode:quizMode,type:QUIZ_MODE_CONFIG[quizMode].label,category:categoryLabel,difficulty:course.level,length,generator};
  }else if(quizMode==='monthly'){
    nextQuiz=shuffleList(sampleQuestions({count:20,category:effectiveCategory,difficulties:difficultyFallbackOrder(course.level)}));
    nextMeta={mode:quizMode,type:QUIZ_MODE_CONFIG[quizMode].label,category:categoryLabel,difficulty:course.level,length:20,generator};
  }else if(quizMode==='final'){
    const courseBlock=shuffleList(sampleQuestions({count:20,category:effectiveCategory,difficulties:difficultyFallbackOrder(course.level)}));
    const challengeBlock=shuffleList(sampleQuestions({count:10,category:effectiveCategory,difficulties:higherDifficultyOrder(course.level),exclude:courseBlock}));
    nextQuiz=[...courseBlock,...challengeBlock];
    nextMeta={
      mode:quizMode,
      type:QUIZ_MODE_CONFIG[quizMode].label,
      category:categoryLabel,
      difficulty:course.level,
      length:30,
      challengeStartsAt:21,
      blockLabels:[
        {start:1,end:20,label:'Course-level block'},
        {start:21,end:30,label:'Higher-level stretch'}
      ],
      generator
    };
  }else{
    const pool=bank.filter(q=>(selectedCategory==='all'||q.cat===selectedCategory)&&(selectedDifficulty==='all'||q.diff===selectedDifficulty));
    nextQuiz=[...(pool.length?pool:bank)].sort(()=>Math.random()-.5).slice(0,Math.min(selectedLength,(pool.length?pool:bank).length));
    nextMeta={mode:quizMode,type:QUIZ_MODE_CONFIG[quizMode].label,category:selectedCategory==='all'?'All categories':selectedCategory,difficulty:selectedDifficulty==='all'?'Mixed difficulty':selectedDifficulty,length:selectedLength,generator};
  }
  beginQuizSession(nextQuiz,nextMeta);
}

function evaluateLearnerLevel(percent,results){
  const scholar=results.Scholar;
  const advanced=results.Advanced;
  const scholarRate=scholar?.total?Math.round(scholar.correct/scholar.total*100):0;
  const advancedRate=advanced?.total?Math.round(advanced.correct/advanced.total*100):0;
  if(percent>=82&&scholarRate>=40)return'Scholar';
  if(percent>=62&&advancedRate>=40)return'Advanced';
  if(percent>=42)return'Intermediate';
  return'Beginner';
}

function renderQuizAssessmentPanel(){
  const panel=document.getElementById('quizAssessmentPanel');
  if(!panel)return;
  const assessment=normalizeQuizAssessment(state.quizAssessment);
  if(assessment?.level){
    panel.innerHTML=`<strong>Current learner level: ${esc(assessment.level)}</strong><div>The evaluation quiz placed this learner at ${esc(assessment.level)} and recommends the ${esc(assessment.recommendedCourseDifficulty||courseDifficultyFromLearnerLevel(assessment.level))} course baseline for progressive quizzes and exams.</div><div class="quiz-assessment-meta"><span class="quiz-assessment-chip">${esc(assessment.percent)}% placement score</span><span class="quiz-assessment-chip">${esc(assessment.score)}/${esc(assessment.total)} correct</span><span class="quiz-assessment-chip">${esc(prettyDate(assessment.createdAt||new Date().toISOString()))}</span></div>`;
    return;
  }
  if(assessment?.skippedAt){
    panel.innerHTML=`<strong>Evaluation quiz skipped</strong><div>The first-time assessment was skipped, so course quizzes currently follow the planner or curriculum course level until the evaluation quiz is completed.</div><div class="quiz-assessment-meta"><span class="quiz-assessment-chip">Skipped ${esc(prettyDate(assessment.skippedAt))}</span></div>`;
    return;
  }
  panel.innerHTML='<strong>No learner placement yet</strong><div>Take the skippable evaluating quiz to place the learner from beginner to scholar, or skip it and begin with course-based quizzes immediately.</div>';
}

function buildQuizModeSummary(mode){
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const category=getEffectiveQuizCategory(mode);
  if(mode==='evaluation')return'The evaluating quiz scales in four 5-question stages from beginner to scholar and can be skipped the first time if you want to begin directly with the course flow.';
  if(mode==='progressive')return`${ORGANOQUIZO_BOT_NAME} builds the progressive quiz from ${category==='all'?'the current course mix':category}, your study plan, and the ${course.level} course level from your ${course.source}.`;
  if(mode==='monthly')return`${ORGANOQUIZO_BOT_NAME} builds a 20-question checkpoint at the ${course.level} course level from your ${course.source}${category==='all'?' across the full course mix':` with ${category} emphasized`}.`;
  if(mode==='final')return`${ORGANOQUIZO_BOT_NAME} builds a 30-question end-of-course exam with a course-level block plus a higher-level stretch block based on your current plan.`;
  return`${ORGANOQUIZO_BOT_NAME} builds a short adaptive practice quiz from the planner focus or your current quiz filters.`;
}

function syncQuizBuilderUI(){
  const difficulty=document.getElementById('quizDifficulty');
  const length=document.getElementById('quizLength');
  const skip=document.getElementById('skipEvaluationBtn');
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const lockedMode=quizMode!=='practice';
  if(quizMode==='evaluation'){
    difficulty.value='all';
    length.value='20';
  }else if(quizMode==='progressive'){
    difficulty.value=course.level;
    length.value=String(resolveProgressiveQuizLength(learner.level));
  }else if(quizMode==='monthly'){
    difficulty.value=course.level;
    length.value='20';
  }else if(quizMode==='final'){
    difficulty.value=course.level;
    length.value='30';
  }
  difficulty.disabled=lockedMode;
  length.disabled=lockedMode;
  difficulty.closest('.field')?.classList.toggle('is-disabled',lockedMode);
  length.closest('.field')?.classList.toggle('is-disabled',lockedMode);
  document.querySelectorAll('[data-quiz-type]').forEach(button=>button.classList.toggle('is-active',button.dataset.quizType===quizMode));
  document.getElementById('quizTypeSummary').textContent=buildQuizModeSummary(quizMode);
  skip.style.display=quizMode==='evaluation'&&!state.quizAssessment?.level?'inline-flex':'none';
  renderQuizAssessmentPanel();
}

function setQuizMode(mode='progressive',options={}){
  quizMode=QUIZ_MODE_CONFIG[mode]?mode:'progressive';
  syncQuizBuilderUI();
  if(options.silent)return;
  document.getElementById('quizMeta').textContent=QUIZ_MODE_CONFIG[quizMode].label;
}

function initializeQuizModes(){
  document.querySelectorAll('[data-quiz-type]').forEach(button=>{
    button.addEventListener('click',()=>setQuizMode(button.dataset.quizType||'progressive'));
  });
  document.getElementById('quizCategory').addEventListener('change',syncQuizBuilderUI);
  document.getElementById('startingLevel')?.addEventListener('change',syncQuizBuilderUI);
  document.getElementById('studyFocus')?.addEventListener('change',syncQuizBuilderUI);
  setQuizMode(state.quizAssessment?.level||state.quizAssessment?.skippedAt?'progressive':'evaluation',{silent:true});
}

function skipEvaluationQuiz(){
  state.quizAssessment=normalizeQuizAssessment({...state.quizAssessment,skippedAt:new Date().toISOString()});
  saveState();
  renderQuizAssessmentPanel();
  setQuizMode('progressive');
  window.OrganoApp?.notify?.({
    title:'Evaluation skipped',
    body:'The learner placement quiz was skipped for now. Progressive quizzes will use the current course setup instead.',
    kind:'info',
    actionHref:'#quiz',
    actionLabel:'Open quiz partition',
    dedupeKey:'quiz-evaluation-skipped'
  });
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

async function setupQuiz(){
  const selectedCategory=document.getElementById('quizCategory').value;
  const selectedDifficulty=document.getElementById('quizDifficulty').value;
  const selectedLength=Number(document.getElementById('quizLength').value);
  const effectiveCategory=getEffectiveQuizCategory(quizMode);
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const categoryLabel=selectedCategory==='all'?(effectiveCategory==='all'?'All categories':`${effectiveCategory} focus`):selectedCategory;
  if(quizMode==='evaluation'){
    buildLocalQuizSet();
    return;
  }
  const adaptiveRequest=buildAdaptiveQuizRequest({selectedCategory,selectedDifficulty,selectedLength,effectiveCategory,course,learner,categoryLabel});
  try{
    await buildAdaptiveQuizSet(adaptiveRequest);
  }catch(error){
    buildLocalQuizSet({generator:'Local backup'});
    window.OrganoApp?.notify?.({
      title:`${ORGANOQUIZO_BOT_NAME} fallback`,
      body:`Adaptive quiz generation was unavailable, so the local quiz bank was used instead. ${AI?.normalizeAIError?.(error)||String(error)}`,
      kind:'info',
      actionHref:'#quiz',
      actionLabel:'Review quiz'
    });
  }
}

function loadQ(){
  const q=quiz[qi],opts=document.getElementById('qOptions'),fb=document.getElementById('qFeedback');
  if(!q){document.getElementById('qText').textContent='Build a quiz to begin.';document.getElementById('qNum').textContent='0/0';opts.innerHTML='';fb.className='quiz-feedback';document.getElementById('nextBtn').style.display='none';document.getElementById('restartBtn').style.display='none';document.getElementById('scoreDisplay').style.display='none';return;}
  document.getElementById('qText').textContent=q.q;
  document.getElementById('qNum').textContent=`${qi+1}/${quiz.length}`;
  document.getElementById('quizMeta').textContent=buildQuizMetaText(quizMeta,qi);
  opts.innerHTML='';
  q.opts.forEach((opt,i)=>{const b=document.createElement('button');b.className='quiz-opt';b.textContent=opt;b.onclick=()=>checkA(i);opts.appendChild(b);});
  fb.className='quiz-feedback';fb.textContent='';document.getElementById('nextBtn').style.display='none';document.getElementById('restartBtn').style.display='none';document.getElementById('scoreDisplay').style.display='none';answered=false;
}

function checkA(choice){
  if(answered)return;answered=true;
  const q=quiz[qi],opts=document.querySelectorAll('.quiz-opt'),fb=document.getElementById('qFeedback');
  const explanation=buildQuizAnswerExplanation(q);
  opts.forEach(b=>b.classList.add('disabled'));
  if(!catResults[q.cat])catResults[q.cat]={correct:0,total:0};
  if(!difficultyResults[q.diff])difficultyResults[q.diff]={correct:0,total:0};
  catResults[q.cat].total+=1;
  difficultyResults[q.diff].total+=1;
  const correct=choice===q.ans;
  questionResults.push({index:qi,correct,difficulty:q.diff,category:q.cat});
  if(correct){score+=1;catResults[q.cat].correct+=1;difficultyResults[q.diff].correct+=1;opts[choice].classList.add('correct');fb.className='quiz-feedback correct-fb show';fb.textContent=`Correct. ${explanation}`;}
  else{opts[choice].classList.add('wrong');opts[q.ans].classList.add('correct');fb.className='quiz-feedback wrong-fb show';fb.textContent=`Not quite. ${explanation}`;}
  if(qi<quiz.length-1)document.getElementById('nextBtn').style.display='inline-block';else showScore();
}

function nextQ(){qi+=1;loadQ();}

function restartQuiz(){
  Promise.resolve(setupQuiz());
}

function showScore(){
  const pct=Math.round(score/quiz.length*100);
  const genericMsg=[[0,50,'Build back up from the topic explorer and try again.'],[50,75,'Good base. Tighten the weaker categories next.'],[75,90,'Strong understanding. One more focused pass could push this higher.'],[90,101,'Excellent work. The patterns are sticking.']].find(([a,b])=>pct>=a&&pct<b)?.[2]||'';
  let msg=genericMsg;
  let evaluatedLevel='';
  if(quizMeta.mode==='evaluation'){
    evaluatedLevel=evaluateLearnerLevel(pct,difficultyResults);
    msg=`Placement complete. This learner currently sits at the ${evaluatedLevel} level.`;
  }else if(quizMeta.mode==='progressive'){
    msg=`Course checkpoint complete. ${genericMsg}`;
  }else if(quizMeta.mode==='monthly'){
    msg=`Monthly exam complete. ${genericMsg}`;
  }else if(quizMeta.mode==='final'){
    const challengeStart=(quizMeta.challengeStartsAt||quiz.length+1)-1;
    const challengeCorrect=questionResults.slice(challengeStart).filter(item=>item.correct).length;
    msg=`End-of-course exam complete. You solved ${challengeCorrect}/${Math.max(0,quiz.length-challengeStart)} of the higher-level stretch questions.`;
  }
  document.getElementById('scoreDisplay').style.display='grid';
  document.getElementById('scoreText').textContent=`${score}/${quiz.length} - ${pct}%`;
  document.getElementById('scoreMsg').textContent=msg;
  const scoreChips=[];
  if(quizMeta.mode==='final'&&quizMeta.challengeStartsAt){
    const challengeStart=quizMeta.challengeStartsAt-1;
    const courseCorrect=questionResults.slice(0,challengeStart).filter(item=>item.correct).length;
    const challengeCorrect=questionResults.slice(challengeStart).filter(item=>item.correct).length;
    scoreChips.push(`<div class="score-chip"><strong>Course-level block</strong>${courseCorrect}/${challengeStart} correct</div>`);
    scoreChips.push(`<div class="score-chip"><strong>Higher-level stretch</strong>${challengeCorrect}/${quiz.length-challengeStart} correct</div>`);
  }
  if(quizMeta.mode==='evaluation'){
    scoreChips.push(...Object.entries(difficultyResults).map(([k,v])=>`<div class="score-chip"><strong>${esc(k)}</strong>${v.correct}/${v.total} correct - ${Math.round(v.correct/v.total*100)}%</div>`));
  }
  scoreChips.push(...Object.entries(catResults).map(([k,v])=>`<div class="score-chip"><strong>${esc(k)}</strong>${v.correct}/${v.total} correct - ${Math.round(v.correct/v.total*100)}%</div>`));
  document.getElementById('scoreBreakdown').innerHTML=scoreChips.join('');
  document.getElementById('restartBtn').style.display='inline-block';
  document.getElementById('nextBtn').style.display='none';
  if(quizMeta.mode==='evaluation'){
    state.quizAssessment=normalizeQuizAssessment({
      level:evaluatedLevel,
      recommendedCourseDifficulty:courseDifficultyFromLearnerLevel(evaluatedLevel),
      percent:pct,
      score,
      total:quiz.length,
      createdAt:new Date().toISOString()
    });
    const startingLevel=document.getElementById('startingLevel');
    if(startingLevel&&COURSE_LEVELS.includes(state.quizAssessment.recommendedCourseDifficulty)){
      startingLevel.value=state.quizAssessment.recommendedCourseDifficulty;
      syncPlannerSetupUI();
    }
    saveState();
    renderQuizAssessmentPanel();
  }
  if(!window.OrganoApp?.isAuthenticated?.()){
    document.getElementById('scoreMsg').textContent=`${msg} Sign in to save quiz history to your account${quizMeta.mode==='evaluation'?' and sync this learner placement':''}.`;
    renderQuizHistory();
    renderStats();
    renderWeakAreas();
    renderMission();
    window.OrganoApp?.notify?.({
      title:`Quiz complete: ${pct}%`,
      body:`Preview mode finished a ${quizMeta.type.toLowerCase()}. Sign in to keep quiz history and progress synced.`,
      kind:pct>=75?'success':'info',
      actionHref:'auth.html',
      actionLabel:'Sign in to save'
    });
    return;
  }
  state.quizHistory.unshift({createdAt:new Date().toISOString(),score,total:quiz.length,percent:pct,category:quizMeta.category,difficulty:quizMeta.difficulty,type:quizMeta.type,mode:quizMeta.mode,breakdown:catResults,evaluatedLevel,generator:quizMeta.generator||''});
  state.quizHistory=state.quizHistory.slice(0,8);
  saveState();
  renderQuizHistory();renderStats();renderWeakAreas();renderMission();
  window.OrganoApp?.notify?.({
    title:`Quiz saved: ${pct}%`,
    body:`${quizMeta.type} is now part of your saved quiz history.`,
    kind:pct>=75?'success':'info',
    actionHref:'#quiz',
    actionLabel:'Review quiz history'
  });
}

function renderQuizHistory(){
  const locked=!window.OrganoApp?.isAuthenticated?.();
  document.getElementById('quizHistory').innerHTML=state.quizHistory.map(s=>`<div class="history-item"><strong>${s.percent}% - ${esc(s.type||'Quiz')}</strong>${esc(s.category)} - ${esc(s.difficulty)} - ${s.score}/${s.total} correct${s.evaluatedLevel?` - placed at ${esc(s.evaluatedLevel)}`:''}${s.generator?` - ${esc(s.generator)}`:''} - ${prettyDate(s.createdAt)}</div>`).join('')||(locked?'<div class="history-item"><strong>Sign in to save quiz sessions</strong>Your completed quizzes still work in preview mode, but history is only stored for signed-in users.</div>':'<div class="history-item"><strong>No saved sessions yet</strong>Your completed quizzes will appear here.</div>');
}

function getQuizJourneyState(){
  state=normalizeMainState(state);
  return state.quizJourney;
}

function getJourneyLaunchMode(){
  const journey=getQuizJourneyState();
  if(activeQuizSession?.mode)return activeQuizSession.mode;
  if(journey.stage==='COMPLETED')return'final';
  if(journey.stage==='FINAL')return'final';
  if(journey.stage==='PROGRESSIVE')return'progressive';
  return'evaluation';
}

function hasQuizJourneyProgress(){
  return QuizJourney?.hasAnyJourneyProgress?.(getQuizJourneyState())||false;
}

function getPlanGenerationBlockMessage(){
  const session=QuizJourney?.normalizeActiveSession?.(getQuizJourneyState().activeSession)||null;
  if(session&&QuizJourney?.isSessionActive?.(session)){
    return 'Finish or submit the current quiz before generating another study plan.';
  }
  return 'Your current study plan stays active until you delete it or finish all required quizzes and the End of Course Exam.';
}

function ensureFirstPlanEvaluationDecision(){
  const assessment=normalizeQuizAssessment(state.quizAssessment);
  const journey=getQuizJourneyState();
  if(hasCurrentStudyPlan()||assessment?.level||assessment?.skippedAt||journey.evaluation.status!=='not_started'){
    if(state.firstPlanEvaluationRequired){
      delete state.firstPlanEvaluationRequired;
      saveState();
    }
    return true;
  }
  if(state.firstPlanEvaluationRequired){
    setPlannerError('Finish the Evaluating Exam before generating your first study plan.');
    setPlannerStatus('Finish the Evaluating Exam before generating your first study plan.');
    renderQuizJourney();
    window.OrganoApp?.notify?.({
      title:'Evaluating Exam required',
      body:'Finish the Evaluating Exam before generating your first study plan.',
      kind:'warning',
      actionHref:'#quiz',
      actionLabel:'Open quiz journey',
      dedupeKey:'planner-initial-evaluation-required'
    });
    return false;
  }
  const shouldSkip=confirm('Do you wish to skip the evaluating exam?');
  if(shouldSkip){
    delete state.firstPlanEvaluationRequired;
    const skippedAt=new Date().toISOString();
    state.quizAssessment=normalizeQuizAssessment({
      ...(state.quizAssessment||{}),
      skippedAt
    });
    state.quizJourney=QuizJourney?.normalizeQuizJourney?.(state.quizJourney,{quizAssessment:state.quizAssessment,quizHistory:state.quizHistory})||state.quizJourney;
    saveState();
    renderQuizJourney();
    window.OrganoApp?.notify?.({
      title:'Evaluating Exam skipped',
      body:'Your first study plan is being generated without the Evaluating Exam. You can still complete the exam later.',
      kind:'info',
      actionHref:'#dashboard',
      actionLabel:'Open planner',
      dedupeKey:'planner-initial-evaluation-skipped'
    });
    return true;
  }
  state.firstPlanEvaluationRequired=true;
  saveState();
  setPlannerError('Finish the Evaluating Exam before generating your first study plan.');
  setPlannerStatus('Finish the Evaluating Exam before generating your first study plan.');
  renderQuizJourney();
  window.OrganoApp?.notify?.({
    title:'Evaluating Exam required',
    body:'Finish the Evaluating Exam before generating your first study plan, or try again and choose to skip it.',
    kind:'warning',
    actionHref:'#quiz',
    actionLabel:'Open quiz journey',
    dedupeKey:'planner-initial-evaluation-required'
  });
  return false;
}

function updatePlannerJourneyGuard(){
  const locked=!(QuizJourney?.canGenerateNewPlan?.(state)??true);
  const guard=document.getElementById('plannerJourneyGuard');
  if(guard){
    guard.hidden=!locked;
    guard.textContent=getPlanGenerationBlockMessage();
  }
  document.querySelectorAll('.planner-toolbar .btn').forEach(button=>{
    if(button.classList.contains('danger-btn'))return;
    button.disabled=locked;
    button.setAttribute('aria-disabled',locked?'true':'false');
  });
}

function ensurePlanGenerationAllowed(notify=true){
  const allowed=QuizJourney?.canGenerateNewPlan?.(state)??true;
  updatePlannerJourneyGuard();
  if(allowed)return true;
  setPlannerError(getPlanGenerationBlockMessage());
  setPlannerStatus(getPlanGenerationBlockMessage());
  if(notify){
    window.OrganoApp?.notify?.({
      title:'Study plan still active',
      body:getPlanGenerationBlockMessage(),
      kind:'warning',
      actionHref:(QuizJourney?.isSessionActive?.(getQuizJourneyState().activeSession)||false)?'#quiz':'#dashboard',
      actionLabel:(QuizJourney?.isSessionActive?.(getQuizJourneyState().activeSession)||false)?'Open quiz journey':'Open planner',
      dedupeKey:'planner-quiz-path-locked'
    });
  }
  return false;
}

function modeToJourneyStage(mode){
  if(mode==='evaluation')return'EVALUATION';
  if(mode==='final')return'FINAL';
  return'PROGRESSIVE';
}

function createSessionResponses(length){
  return Array.from({length},()=>({selectedIndex:null,isCorrect:null,answeredAt:''}));
}

function setQuizSessionBanner(message=''){
  const node=document.getElementById('quizSessionBanner');
  if(!node)return;
  if(!message){
    node.hidden=true;
    node.textContent='';
    return;
  }
  node.hidden=false;
  node.textContent=message;
}

function clearQuizSessionBanner(){
  setQuizSessionBanner('');
}

function stopQuizTimer(){
  clearInterval(quizTimerHandle);
  quizTimerHandle=0;
}

function computeSessionResults(session=activeQuizSession){
  const source=session||{};
  const nextCatResults={};
  const nextDifficultyResults={};
  const nextQuestionResults=[];
  let nextScore=0;
  (source.questions||[]).forEach((question,index)=>{
    const response=source.responses?.[index];
    if(response?.selectedIndex===null||response?.selectedIndex===undefined)return;
    if(!nextCatResults[question.cat])nextCatResults[question.cat]={correct:0,total:0};
    if(!nextDifficultyResults[question.diff])nextDifficultyResults[question.diff]={correct:0,total:0};
    nextCatResults[question.cat].total+=1;
    nextDifficultyResults[question.diff].total+=1;
    const correct=Boolean(response.isCorrect);
    if(correct){
      nextScore+=1;
      nextCatResults[question.cat].correct+=1;
      nextDifficultyResults[question.diff].correct+=1;
    }
    nextQuestionResults.push({index,correct,difficulty:question.diff,category:question.cat});
  });
  return{
    score:nextScore,
    catResults:nextCatResults,
    difficultyResults:nextDifficultyResults,
    questionResults:nextQuestionResults
  };
}

function syncRuntimeFromSession(session){
  if(!session){
    quiz=[];
    qi=0;
    score=0;
    answered=false;
    quizMode=getJourneyLaunchMode();
    quizMeta={type:QUIZ_MODE_CONFIG[quizMode]?.label||'Quiz Journey',category:'All categories',difficulty:'Adaptive'};
    catResults={};
    difficultyResults={};
    questionResults=[];
    return;
  }
  quiz=session.questions||[];
  qi=Math.max(0,Math.min(session.currentIndex||0,Math.max(quiz.length-1,0)));
  quizMode=session.mode;
  quizMeta={
    mode:session.mode,
    type:session.type,
    category:session.category,
    difficulty:session.difficulty,
    length:quiz.length,
    generator:session.generator,
    strategy:session.strategy,
    challengeStartsAt:session.challengeStartsAt,
    blockLabels:session.blockLabels
  };
  const results=computeSessionResults(session);
  score=results.score;
  catResults=results.catResults;
  difficultyResults=results.difficultyResults;
  questionResults=results.questionResults;
  answered=Boolean(session.responses?.[qi]&&session.responses[qi].selectedIndex!==null);
}

function renderQuizTimer(){
  const timer=document.getElementById('quizTimer');
  if(!timer)return;
  if(!activeQuizSession||activeQuizSession.status!=='active'){
    timer.hidden=true;
    timer.classList.remove('is-warning','is-expired');
    timer.textContent='00:00';
    return;
  }
  const remainingMs=QuizJourney?.getRemainingMs?.(activeQuizSession)||0;
  timer.hidden=false;
  timer.textContent=QuizJourney?.formatRemainingTime?.(remainingMs)||'00:00';
  timer.classList.toggle('is-warning',remainingMs>0&&remainingMs<=((QuizJourney?.LOW_TIME_WARNING_MS)||300000));
  timer.classList.toggle('is-expired',remainingMs<=0);
}

function setActiveQuizSession(session,{persist=true}={}){
  stopQuizTimer();
  activeQuizSession=session?QuizJourney?.normalizeActiveSession?.(session)||session:null;
  state.quizJourney.activeSession=activeQuizSession;
  syncRuntimeFromSession(activeQuizSession);
  if(persist)saveState();
  renderQuizTimer();
}

function startQuizTimer(){
  renderQuizTimer();
  if(!activeQuizSession||activeQuizSession.status!=='active')return;
  quizTimerHandle=window.setInterval(()=>{
    const remainingMs=QuizJourney?.getRemainingMs?.(activeQuizSession)||0;
    renderQuizTimer();
    if(remainingMs<=0)finalizeQuizSession('expired');
  },1000);
}

function buildIdleQuizPrompt(){
  const mode=getJourneyLaunchMode();
  if(mode==='evaluation')return'Evaluating Exam is the first guided step. Start it to unlock your progressive quizzes.';
  if(mode==='progressive')return`Progressive quizzes completed and passed: ${getQuizJourneyState().progressive.passedCount} / ${getQuizJourneyState().progressive.requiredCount}.`;
  if(getQuizJourneyState().stage==='COMPLETED')return'Your guided quiz journey is complete. You can review your results, reset the journey, or retake the final exam.';
  return'Your final exam is unlocked. Start it when you are ready to complete the journey.';
}

function createQuizSession(nextQuiz,nextMeta){
  const mode=nextMeta.mode;
  const startedAt=new Date().toISOString();
  const durationMin=QuizJourney?.durationMinutesForMode?.(mode)||(mode==='progressive'?20:60);
  return QuizJourney?.normalizeActiveSession?.({
    id:`quiz-session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    stage:modeToJourneyStage(mode),
    mode,
    status:'active',
    type:nextMeta.type,
    category:nextMeta.category,
    difficulty:nextMeta.difficulty,
    generator:nextMeta.generator||'',
    strategy:nextMeta.strategy||'',
    challengeStartsAt:nextMeta.challengeStartsAt||0,
    blockLabels:nextMeta.blockLabels||[],
    questions:nextQuiz,
    responses:createSessionResponses(nextQuiz.length),
    currentIndex:0,
    startedAt,
    expiresAt:new Date(Date.now()+durationMin*60*1000).toISOString(),
    durationMin
  })||null;
}

function beginQuizSession(nextQuiz,nextMeta){
  const existing=getQuizJourneyState().activeSession;
  if(existing&&QuizJourney?.isSessionActive?.(existing)){
    setQuizSessionBanner('Finish or submit your current quiz before starting another one.');
    restoreQuizSessionFromState();
    return;
  }
  clearQuizSessionBanner();
  const session=createQuizSession(nextQuiz,nextMeta);
  if(!session)return;
  setActiveQuizSession(session,{persist:true});
  startQuizTimer();
  document.getElementById('scoreDisplay').style.display='none';
  loadQ();
  renderQuizJourney();
}

function restoreQuizSessionFromState(){
  const session=QuizJourney?.normalizeActiveSession?.(getQuizJourneyState().activeSession)||null;
  if(!session){
    setActiveQuizSession(null,{persist:false});
    return false;
  }
  setActiveQuizSession(session,{persist:false});
  if(session.status==='active'&&(QuizJourney?.getRemainingMs?.(session)||0)<=0){
    finalizeQuizSession('expired');
    return false;
  }
  if(session.status==='active')startQuizTimer();
  loadQ();
  return true;
}

function showQuizBuildState(message,detail){
  const opts=document.getElementById('qOptions');
  const feedback=document.getElementById('qFeedback');
  document.getElementById('qText').textContent=message;
  document.getElementById('qNum').textContent='...';
  document.getElementById('quizMeta').textContent=`${ORGANOQUIZO_BOT_NAME} is preparing your quiz`;
  document.getElementById('quizTimer').hidden=true;
  opts.innerHTML='';
  feedback.className='quiz-feedback show';
  feedback.textContent=detail;
  document.getElementById('nextBtn').style.display='none';
  document.getElementById('restartBtn').style.display='none';
  document.getElementById('scoreDisplay').style.display='none';
}

function buildAdaptiveQuizRequest({selectedCategory,effectiveCategory,course,learner,categoryLabel,mode}){
  const plannerInput=readPlannerInputs();
  const studyPlan=simplifyStudyPlanForQuiz();
  const requestedLength=mode==='progressive'
    ?resolveProgressiveQuizLength(learner.level)
    :mode==='final'
      ?30
      :20;
  return{
    input:{
      mode,
      requestedLength,
      selectedCategory,
      effectiveCategory,
      categoryLabel,
      selectedDifficulty:'all',
      effectiveDifficulty:mode==='evaluation'?'Beginner to Scholar':course.level,
      courseLevel:course.level,
      courseSource:course.source,
      learnerLevel:learner.level,
      learnerSource:learner.source,
      focusArea:plannerInput.focusArea,
      studyPlan,
      availableCategories:chemistryCategories(),
      availableDifficulties:QUIZ_LEVELS
    },
    progress:{
      ...buildProgressSnapshot(plannerInput),
      studyPlan,
      latestQuizMode:mode
    }
  };
}

async function buildAdaptiveQuizSet(request){
  if(!AI?.requestAdaptiveQuiz)throw new Error('OrganoBot is unavailable.');
  showQuizBuildState(
    `${ORGANOQUIZO_BOT_NAME} is building your quiz...`,
    'Generating adaptive questions from your study plan, learner level, and weak areas.'
  );
  const rawQuiz=await AI.requestAdaptiveQuiz(request);
  const questions=(Array.isArray(rawQuiz?.questions)?rawQuiz.questions:[])
    .map(question=>normalizeAdaptiveQuizQuestion(question,request.input))
    .filter(Boolean)
    .slice(0,request.input.requestedLength);
  if(questions.length!==request.input.requestedLength){
    throw new Error(`${ORGANOQUIZO_BOT_NAME} returned an incomplete quiz.`);
  }
  beginQuizSession(questions,{
    mode:request.input.mode,
    type:normalizeText(rawQuiz?.title,QUIZ_MODE_CONFIG[request.input.mode]?.label||'Adaptive Quiz'),
    category:request.input.categoryLabel,
    difficulty:request.input.effectiveDifficulty,
    length:questions.length,
    generator:ORGANOQUIZO_BOT_NAME,
    strategy:normalizeText(rawQuiz?.strategy,''),
    blockLabels:normalizeAdaptiveBlockLabels(rawQuiz?.blockLabels,questions.length)
  });
}

function buildLocalQuizSet({generator='',mode=getJourneyLaunchMode()}={}){
  const selectedCategory=document.getElementById('quizCategory').value;
  const effectiveCategory=getEffectiveQuizCategory(mode);
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const categoryLabel=selectedCategory==='all'?(effectiveCategory==='all'?'All categories':`${effectiveCategory} focus`):selectedCategory;
  let nextQuiz=[];
  let nextMeta={mode,type:QUIZ_MODE_CONFIG[mode].label,category:categoryLabel,difficulty:course.level,length:0,generator};
  if(mode==='evaluation'){
    nextQuiz=[
      ...sampleQuestions({count:5,category:'all',difficulties:['Beginner']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Intermediate']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Advanced']}),
      ...sampleQuestions({count:5,category:'all',difficulties:['Scholar']})
    ];
    nextMeta={
      mode,
      type:QUIZ_MODE_CONFIG[mode].label,
      category:'All categories',
      difficulty:'Beginner to Scholar',
      length:20,
      blockLabels:[
        {start:1,end:5,label:'Beginner ladder'},
        {start:6,end:10,label:'Intermediate ladder'},
        {start:11,end:15,label:'Advanced ladder'},
        {start:16,end:20,label:'Scholar ladder'}
      ]
    };
  }else if(mode==='progressive'){
    const length=resolveProgressiveQuizLength(learner.level);
    nextQuiz=shuffleList(sampleQuestions({count:length,category:effectiveCategory,difficulties:difficultyFallbackOrder(course.level)}));
    nextMeta={mode,type:QUIZ_MODE_CONFIG[mode].label,category:categoryLabel,difficulty:course.level,length,generator};
  }else{
    const courseBlock=shuffleList(sampleQuestions({count:20,category:effectiveCategory,difficulties:difficultyFallbackOrder(course.level)}));
    const challengeBlock=shuffleList(sampleQuestions({count:10,category:effectiveCategory,difficulties:higherDifficultyOrder(course.level),exclude:courseBlock}));
    nextQuiz=[...courseBlock,...challengeBlock];
    nextMeta={
      mode,
      type:QUIZ_MODE_CONFIG[mode].label,
      category:categoryLabel,
      difficulty:course.level,
      length:30,
      challengeStartsAt:21,
      blockLabels:[
        {start:1,end:20,label:'Course-level block'},
        {start:21,end:30,label:'Higher-level stretch'}
      ],
      generator
    };
  }
  beginQuizSession(nextQuiz,nextMeta);
}

function renderQuizAssessmentPanel(){
  const panel=document.getElementById('quizAssessmentPanel');
  if(!panel)return;
  const assessment=normalizeQuizAssessment(state.quizAssessment);
  const journey=getQuizJourneyState();
  panel.hidden=false;
  if(activeQuizSession&&activeQuizSession.status==='active'){
    panel.innerHTML=`<strong>${esc(activeQuizSession.type)} in progress</strong><div>The timer is running, OrganoBot chat is locked, and plan generation stays blocked until this quiz is submitted or expires.</div><div class="quiz-assessment-meta"><span class="quiz-assessment-chip">${esc(activeQuizSession.category)}</span><span class="quiz-assessment-chip">${esc(activeQuizSession.difficulty)}</span><span class="quiz-assessment-chip">Stage ${esc(activeQuizSession.stage)}</span></div>`;
    return;
  }
  if(assessment?.level){
    panel.innerHTML=`<strong>Current learner level: ${esc(assessment.level)}</strong><div>The Evaluating Exam placed this learner at ${esc(assessment.level)} and recommends the ${esc(assessment.recommendedCourseDifficulty||courseDifficultyFromLearnerLevel(assessment.level))} course baseline for the guided journey.</div><div class="quiz-assessment-meta"><span class="quiz-assessment-chip">${esc(assessment.percent)}% placement score</span><span class="quiz-assessment-chip">${esc(assessment.score)}/${esc(assessment.total)} correct</span><span class="quiz-assessment-chip">${esc(prettyDate(assessment.createdAt||new Date().toISOString()))}</span></div>`;
    return;
  }
  if(journey.evaluation.status==='legacy-exempt'){
    panel.innerHTML=`<strong>Evaluating Exam skipped</strong><div>The first study plan was generated without the Evaluating Exam, so course quizzes currently follow the planner or curriculum course level until the evaluation quiz is completed.</div><div class="quiz-assessment-meta"><span class="quiz-assessment-chip">Skipped ${esc(prettyDate(assessment?.skippedAt||journey.evaluation.skippedAt||new Date().toISOString()))}</span></div>`;
    return;
  }
  panel.innerHTML='<strong>No learner placement yet</strong><div>Start with the Evaluating Exam to personalize the guided path, unlock progressive quizzes, and improve how OrganoBot generates adaptive questions for you.</div>';
}

function buildStageStatus(stage){
  const journey=getQuizJourneyState();
  if(stage==='EVALUATION'){
    if(journey.evaluation.status==='completed'||journey.evaluation.status==='legacy-exempt')return{label:'Completed',tone:'is-open',complete:true};
    return{label:'Current step',tone:'is-open',current:true};
  }
  if(stage==='PROGRESSIVE'){
    if(journey.progressive.passedCount>=journey.progressive.requiredCount)return{label:'Completed',tone:'is-open',complete:true};
    if(['PROGRESSIVE','FINAL','COMPLETED'].includes(journey.stage))return{label:journey.stage==='PROGRESSIVE'?'Current step':'Open',tone:'is-open',current:journey.stage==='PROGRESSIVE'};
    return{label:'Locked',tone:'is-locked',locked:true};
  }
  if(journey.stage==='COMPLETED')return{label:'Completed',tone:'is-open',complete:true};
  if(journey.stage==='FINAL')return{label:'Current step',tone:'is-open',current:true};
  return{label:'Locked',tone:'is-locked',locked:true};
}

function renderQuizAchievements(){
  const grid=document.getElementById('quizBadgesGrid');
  const panel=grid?.closest('.quiz-badges-panel');
  if(!grid)return;
  const earnedAchievements=(state.achievements||[]).filter(item=>item?.unlocked&&item?.earnedAt);
  if(panel)panel.hidden=!earnedAchievements.length;
  if(!earnedAchievements.length){
    grid.innerHTML='';
    return;
  }
  grid.innerHTML=earnedAchievements.map(item=>`<article class="quiz-badge-card" data-badge-tone="${esc(item.badgeType)}"><div class="quiz-badge-top"><span class="quiz-badge-level">${esc(item.level)}</span><span class="quiz-badge-status is-earned">Earned</span></div><strong>${esc(item.title)}</strong><div class="quiz-badge-copy">${esc(item.badgeType.charAt(0).toUpperCase()+item.badgeType.slice(1))} badge</div><div class="quiz-badge-date">Earned ${esc(prettyDate(item.earnedAt))}</div></article>`).join('');
}

function renderQuizJourney(){
  const journey=getQuizJourneyState();
  const launchMode=getJourneyLaunchMode();
  document.getElementById('quizTypeSummary').textContent='This guided journey starts with evaluation, continues through required progressive quizzes, and unlocks the final exam only when you are ready.';
  const recommendation=document.getElementById('quizJourneyRecommendation');
  if(recommendation)recommendation.hidden=journey.evaluation.status!=='not_started';
  const startButton=document.getElementById('startQuizJourneyBtn');
  if(startButton){
    startButton.textContent=activeQuizSession&&activeQuizSession.status==='active'
      ?'Resume current quiz'
      :launchMode==='evaluation'
        ?'Start Evaluating Exam'
        :launchMode==='progressive'
          ?'Start Progressive Quiz'
          :journey.stage==='COMPLETED'
            ?'Retake Final Exam'
            :'Start End of Course Exam';
  }
  const resetButton=document.getElementById('resetQuizJourneyBtn');
  if(resetButton)resetButton.style.display=hasQuizJourneyProgress()?'inline-flex':'none';
  const stageGrid=document.getElementById('quizStageGrid');
  if(stageGrid){
    const progressiveMeta=`Progressive quizzes completed and passed: ${journey.progressive.passedCount} / ${journey.progressive.requiredCount}`;
    stageGrid.innerHTML=[
      {id:'EVALUATION',kicker:'Step 1',title:'Evaluating Exam',copy:'Complete the evaluation first for better personalization and adaptive quiz generation.',meta:'60 minutes'},
      {id:'PROGRESSIVE',kicker:'Step 2',title:'Progressive Quizzes',copy:'Pass the required progressive quizzes to unlock your final exam.',meta:progressiveMeta},
      {id:'FINAL',kicker:'Step 3',title:'End of Course Exam',copy:'The final exam unlocks after the required progressive quizzes are completed and passed.',meta:'60 minutes'}
    ].map(card=>{
      const status=buildStageStatus(card.id);
      return`<article class="quiz-stage-card ${status.current?'is-current':''} ${status.complete?'is-complete':''} ${status.locked?'is-locked':''}"><div class="quiz-stage-top"><span class="quiz-stage-kicker">${esc(card.kicker)}</span><span class="quiz-stage-status ${status.tone}">${esc(status.label)}</span></div><strong>${esc(card.title)}</strong><div class="quiz-stage-copy">${esc(card.copy)}</div><div class="quiz-stage-meta">${esc(card.meta)}</div></article>`;
    }).join('');
  }
  renderQuizAssessmentPanel();
  renderQuizAchievements();
  updatePlannerJourneyGuard();
  renderQuizTimer();
}

function openQuizResetModal(){
  document.getElementById('quizResetModal')?.removeAttribute('hidden');
}

function closeQuizResetModal(){
  document.getElementById('quizResetModal')?.setAttribute('hidden','hidden');
}

function confirmQuizJourneyReset(){
  closeQuizResetModal();
  stopQuizTimer();
  activeQuizSession=null;
  state.quizHistory=[];
  state.quizAssessment=null;
  state.quizJourney=QuizJourney?.createEmptyJourney?.()||null;
  state.achievements=QuizJourney?.normalizeAchievements?.([])||[];
  state.studyPlans=[];
  AI?.clearPlannerCache?.();
  saveState();
  syncRuntimeFromSession(null);
  clearQuizSessionBanner();
  loadQ();
  renderStats();
  renderStudyPlan();
  renderWeakAreas();
  renderMission();
  renderQuizHistory();
  renderQuizJourney();
  window.OrganoApp?.notify?.({
    title:'Quiz journey reset',
    body:'Your quiz path, related progress, and active session were deleted. You can generate a new plan again.',
    kind:'warning',
    actionHref:'#quiz',
    actionLabel:'Start again',
    dedupeKey:'quiz-journey-reset'
  });
}

function syncQuizBuilderUI(){
  renderQuizJourney();
}

function initializeQuizModes(){
  if(!quizJourneyBindingsReady){
    document.getElementById('quizCategory').addEventListener('change',renderQuizJourney);
    document.getElementById('startingLevel')?.addEventListener('change',renderQuizJourney);
    document.getElementById('studyFocus')?.addEventListener('change',renderQuizJourney);
    quizJourneyBindingsReady=true;
  }
  restoreQuizSessionFromState();
  renderQuizJourney();
  loadQ();
}

async function setupQuiz(){
  if(restoreQuizSessionFromState())return;
  const mode=getJourneyLaunchMode();
  const selectedCategory=document.getElementById('quizCategory').value;
  const effectiveCategory=getEffectiveQuizCategory(mode);
  const course=getCourseDifficultyContext();
  const learner=getLearnerLevelContext();
  const categoryLabel=selectedCategory==='all'?(effectiveCategory==='all'?'All categories':`${effectiveCategory} focus`):selectedCategory;
  if(mode==='evaluation'){
    buildLocalQuizSet({mode});
    return;
  }
  const adaptiveRequest=buildAdaptiveQuizRequest({selectedCategory,effectiveCategory,course,learner,categoryLabel,mode});
  try{
    await buildAdaptiveQuizSet(adaptiveRequest);
  }catch(error){
    buildLocalQuizSet({generator:'Local backup',mode});
    window.OrganoApp?.notify?.({
      title:`${ORGANOQUIZO_BOT_NAME} fallback`,
      body:`Adaptive quiz generation was unavailable, so the local quiz bank was used instead. ${AI?.normalizeAIError?.(error)||String(error)}`,
      kind:'info',
      actionHref:'#quiz',
      actionLabel:'Review quiz'
    });
  }
}

function loadQ(){
  const q=quiz[qi],opts=document.getElementById('qOptions'),fb=document.getElementById('qFeedback');
  if(!q||!activeQuizSession){
    document.getElementById('qText').textContent=buildIdleQuizPrompt();
    document.getElementById('qNum').textContent='0/0';
    document.getElementById('quizMeta').textContent=QUIZ_MODE_CONFIG[getJourneyLaunchMode()]?.label||'Quiz Journey';
    opts.innerHTML='';
    fb.className='quiz-feedback';
    fb.textContent='';
    document.getElementById('nextBtn').style.display='none';
    document.getElementById('restartBtn').style.display='none';
    document.getElementById('scoreDisplay').style.display='none';
    renderQuizTimer();
    return;
  }
  document.getElementById('qText').textContent=q.q;
  document.getElementById('qNum').textContent=`${qi+1}/${quiz.length}`;
  document.getElementById('quizMeta').textContent=buildQuizMetaText(quizMeta,qi);
  opts.innerHTML='';
  q.opts.forEach((opt,i)=>{
    const button=document.createElement('button');
    button.className='quiz-opt';
    button.textContent=opt;
    button.onclick=()=>checkA(i);
    opts.appendChild(button);
  });
  fb.className='quiz-feedback';
  fb.textContent='';
  document.getElementById('nextBtn').style.display='none';
  document.getElementById('restartBtn').style.display='none';
  document.getElementById('scoreDisplay').style.display='none';
  const response=activeQuizSession.responses?.[qi];
  answered=Boolean(response&&response.selectedIndex!==null);
  if(answered){
    const buttons=[...document.querySelectorAll('.quiz-opt')];
    const explanation=buildQuizAnswerExplanation(q);
    buttons.forEach(button=>button.classList.add('disabled'));
    if(response.isCorrect){
      buttons[response.selectedIndex]?.classList.add('correct');
      fb.className='quiz-feedback correct-fb show';
      fb.textContent=`Correct. ${explanation}`;
    }else{
      buttons[response.selectedIndex]?.classList.add('wrong');
      buttons[q.ans]?.classList.add('correct');
      fb.className='quiz-feedback wrong-fb show';
      fb.textContent=`Not quite. ${explanation}`;
    }
    if(qi<quiz.length-1)document.getElementById('nextBtn').style.display='inline-block';
  }
  renderQuizTimer();
}

function checkA(choice){
  if(answered||!activeQuizSession||activeQuizSession.status!=='active')return;
  if((QuizJourney?.getRemainingMs?.(activeQuizSession)||0)<=0){
    finalizeQuizSession('expired');
    return;
  }
  const q=quiz[qi],opts=document.querySelectorAll('.quiz-opt'),fb=document.getElementById('qFeedback');
  const explanation=buildQuizAnswerExplanation(q);
  const correct=choice===q.ans;
  activeQuizSession.responses[qi]={
    selectedIndex:choice,
    isCorrect:correct,
    answeredAt:new Date().toISOString()
  };
  activeQuizSession.currentIndex=qi;
  state.quizJourney.activeSession=activeQuizSession;
  saveState();
  syncRuntimeFromSession(activeQuizSession);
  opts.forEach(button=>button.classList.add('disabled'));
  if(correct){
    opts[choice].classList.add('correct');
    fb.className='quiz-feedback correct-fb show';
    fb.textContent=`Correct. ${explanation}`;
  }else{
    opts[choice].classList.add('wrong');
    opts[q.ans].classList.add('correct');
    fb.className='quiz-feedback wrong-fb show';
    fb.textContent=`Not quite. ${explanation}`;
  }
  if(qi<quiz.length-1)document.getElementById('nextBtn').style.display='inline-block';
  else finalizeQuizSession('submitted');
}

function nextQ(){
  if(!activeQuizSession)return;
  activeQuizSession.currentIndex=Math.min(qi+1,Math.max(quiz.length-1,0));
  state.quizJourney.activeSession=activeQuizSession;
  saveState();
  syncRuntimeFromSession(activeQuizSession);
  loadQ();
}

function showScore(){
  finalizeQuizSession('submitted');
}

function finalizeQuizSession(reason='submitted'){
  const session=activeQuizSession?QuizJourney?.normalizeActiveSession?.(activeQuizSession)||activeQuizSession:null;
  if(!session)return;
  stopQuizTimer();
  const results=computeSessionResults(session);
  const pct=Math.round((results.score/Math.max(1,session.questions.length))*100);
  const genericMsg=[[0,50,'Build back up from the topic explorer and try again.'],[50,75,'Good base. Tighten the weaker categories next.'],[75,90,'Strong understanding. One more focused pass could push this higher.'],[90,101,'Excellent work. The patterns are sticking.']].find(([a,b])=>pct>=a&&pct<b)?.[2]||'';
  let msg=genericMsg;
  let evaluatedLevel='';
  const pass=session.mode==='evaluation'?true:(QuizJourney?.isPassedPercent?.(pct)??pct>=60);
  if(session.mode==='evaluation'){
    evaluatedLevel=evaluateLearnerLevel(pct,results.difficultyResults);
    msg=`Placement complete. This learner currently sits at the ${evaluatedLevel} level.`;
  }else if(session.mode==='progressive'){
    msg=pass
      ?`Progressive quiz passed. ${genericMsg}`
      :`Progressive quiz finished. Reach ${(QuizJourney?.PASS_PERCENTAGE)||60}% to count this checkpoint toward unlocking the final exam.`;
  }else{
    const challengeStart=(session.challengeStartsAt||session.questions.length+1)-1;
    const challengeCorrect=results.questionResults.slice(challengeStart).filter(item=>item.correct).length;
    msg=pass
      ?`End-of-course exam complete. You solved ${challengeCorrect}/${Math.max(0,session.questions.length-challengeStart)} of the higher-level stretch questions.`
      :`End-of-course exam finished. Reach ${(QuizJourney?.PASS_PERCENTAGE)||60}% to complete this journey and earn the course badge.`;
  }
  document.getElementById('scoreDisplay').style.display='grid';
  document.getElementById('scoreText').textContent=`${results.score}/${session.questions.length} - ${pct}%`;
  document.getElementById('scoreMsg').textContent=msg;
  const scoreChips=[];
  if(session.mode==='final'&&session.challengeStartsAt){
    const challengeStart=session.challengeStartsAt-1;
    const courseCorrect=results.questionResults.slice(0,challengeStart).filter(item=>item.correct).length;
    const challengeCorrect=results.questionResults.slice(challengeStart).filter(item=>item.correct).length;
    scoreChips.push(`<div class="score-chip"><strong>Course-level block</strong>${courseCorrect}/${challengeStart} correct</div>`);
    scoreChips.push(`<div class="score-chip"><strong>Higher-level stretch</strong>${challengeCorrect}/${session.questions.length-challengeStart} correct</div>`);
  }
  if(session.mode==='evaluation'){
    scoreChips.push(...Object.entries(results.difficultyResults).map(([k,v])=>`<div class="score-chip"><strong>${esc(k)}</strong>${v.correct}/${v.total} correct - ${Math.round(v.correct/v.total*100)}%</div>`));
  }
  scoreChips.push(...Object.entries(results.catResults).map(([k,v])=>`<div class="score-chip"><strong>${esc(k)}</strong>${v.correct}/${v.total} correct - ${Math.round(v.correct/v.total*100)}%</div>`));
  document.getElementById('scoreBreakdown').innerHTML=scoreChips.join('');
  document.getElementById('restartBtn').style.display='inline-block';
  document.getElementById('nextBtn').style.display='none';
  const completedAt=new Date().toISOString();
  if(session.mode==='evaluation'){
    state.quizAssessment=normalizeQuizAssessment({
      level:evaluatedLevel,
      recommendedCourseDifficulty:courseDifficultyFromLearnerLevel(evaluatedLevel),
      percent:pct,
      score:results.score,
      total:session.questions.length,
      createdAt:completedAt
    });
    const startingLevel=document.getElementById('startingLevel');
    if(startingLevel&&COURSE_LEVELS.includes(state.quizAssessment.recommendedCourseDifficulty)){
      startingLevel.value=state.quizAssessment.recommendedCourseDifficulty;
      syncPlannerSetupUI();
    }
  }
  state.quizHistory.unshift({
    createdAt:completedAt,
    score:results.score,
    total:session.questions.length,
    percent:pct,
    category:session.category,
    difficulty:session.difficulty,
    type:session.type,
    mode:session.mode,
    breakdown:results.catResults,
    evaluatedLevel,
    generator:session.generator||'',
    passed:pass,
    sessionId:session.id,
    completedBy:reason,
    journeyStage:session.stage
  });
  state.quizHistory=state.quizHistory.slice(0,12);
  const nextJourney={...getQuizJourneyState(),activeSession:null};
  if(session.mode==='evaluation'){
    nextJourney.evaluation={
      status:'completed',
      percent:pct,
      passed:true,
      learnerLevel:evaluatedLevel,
      recommendedCourseDifficulty:courseDifficultyFromLearnerLevel(evaluatedLevel),
      completedAt,
      skippedAt:''
    };
  }else if(session.mode==='progressive'){
    nextJourney.progressive={
      ...nextJourney.progressive,
      completedCount:(nextJourney.progressive.completedCount||0)+1,
      passedCount:(nextJourney.progressive.passedCount||0)+(pass?1:0),
      lastCompletedAt:completedAt,
      lastPassedAt:pass?completedAt:(nextJourney.progressive.lastPassedAt||'')
    };
  }else{
    nextJourney.final={
      status:pass?'completed':'unlocked',
      percent:pct,
      passed:pass,
      completedAt:pass?completedAt:'',
      courseDifficulty:getCourseDifficultyContext().level,
      learnerLevel:getLearnerLevelContext().level
    };
    if(pass){
      const badgeLevel=QuizJourney?.deriveBadgeLevel?.({
        courseDifficulty:nextJourney.final.courseDifficulty,
        learnerLevel:nextJourney.final.learnerLevel,
        percent:pct
      });
      state.achievements=QuizJourney?.awardBadge?.(state.achievements,badgeLevel,completedAt)||state.achievements;
    }
  }
  state.quizJourney=QuizJourney?.normalizeQuizJourney?.(nextJourney,{quizAssessment:state.quizAssessment,quizHistory:state.quizHistory})||nextJourney;
  activeQuizSession=null;
  syncRuntimeFromSession(null);
  saveState();
  if(reason==='expired')setQuizSessionBanner('Time is up. Your quiz was submitted automatically.');
  renderQuizHistory();
  renderStats();
  renderWeakAreas();
  renderMission();
  renderQuizJourney();
  window.OrganoApp?.notify?.({
    title:`Quiz saved: ${pct}%`,
    body:reason==='expired'
      ?`${session.type} was auto-submitted when the timer expired.`
      :`${session.type} is now part of your saved quiz history.`,
    kind:pct>=75?'success':'info',
    actionHref:'#quiz',
    actionLabel:'Review quiz history'
  });
}

function restartQuiz(){
  clearQuizSessionBanner();
  Promise.resolve(setupQuiz());
}

function renderQuizHistory(){
  document.getElementById('quizHistory').innerHTML=state.quizHistory.map(s=>`<div class="history-item"><strong>${s.percent}% - ${esc(s.type||'Quiz')}</strong>${esc(s.category)} - ${esc(s.difficulty)} - ${s.score}/${s.total} correct - ${s.passed?'Passed':'Needs retry'}${s.evaluatedLevel?` - placed at ${esc(s.evaluatedLevel)}`:''}${s.generator?` - ${esc(s.generator)}`:''} - ${prettyDate(s.createdAt)}</div>`).join('')||'<div class="history-item"><strong>No saved sessions yet</strong>Your completed quizzes will appear here.</div>';
}

function renderReference(){
  const q=document.getElementById('referenceSearch').value.trim().toLowerCase(),family=document.getElementById('referenceFamily').value,diff=document.getElementById('referenceDifficulty').value;
  const rows=refs.filter(([n,f,s,g,p,d])=>(!q||[n,f,s,g,p].join(' ').toLowerCase().includes(q))&&(family==='all'||f===family)&&(diff==='all'||d===diff));
  document.getElementById('referenceSummary').textContent=`${rows.length} result${rows.length===1?'':'s'} shown across the reference explorer.`;
  document.getElementById('referenceBody').innerHTML=rows.map(([n,f,s,g,p,d])=>`<tr><td>${esc(n)}</td><td>${esc(f)}</td><td class="mono">${esc(s)}</td><td class="mono">${esc(g)}</td><td>${esc(p)}</td><td><span class="tag-pill">${esc(d)}</span></td></tr>`).join('');
}

document.getElementById('referenceSearch').addEventListener('input',renderReference);
document.getElementById('referenceFamily').addEventListener('change',renderReference);
document.getElementById('referenceDifficulty').addEventListener('change',renderReference);
window.addEventListener('organo:hydrate-main-state',()=>{
  state=readState();
  state.quizAssessment=normalizeQuizAssessment(state.quizAssessment);
  hydratePlannerInputs();
  renderStats();
  renderStudyPlan();
  renderCurriculum();
  renderWeakAreas();
  renderSavedReactions();
  renderMission();
  renderQuizHistory();
  initializeQuizModes();
  renderQuizJourney();
  renderReference();
});
window.addEventListener('organo:auth-changed',()=>{
  state=readState();
  state.quizAssessment=normalizeQuizAssessment(state.quizAssessment);
  hydratePlannerInputs();
  renderStats();
  renderStudyPlan();
  renderWeakAreas();
  renderMission();
  renderSavedReactions();
  renderQuizHistory();
  renderQuizJourney();
  renderCurriculum();
});
bindPlannerSetupUI();
hydratePlannerInputs();
initializeQuizModes();
syncPlannerAISettingsUI();
setPlannerError('');
refreshPlannerActivationState();
renderStats();
renderStudyPlan();
renderCurriculum();
renderWeakAreas();
renderSavedReactions();
renderMission();
renderQuizHistory();
renderQuizJourney();
renderReference();
currentMol=pickTodaysCompound()?.id||currentMol;
drawMol(currentMol);
