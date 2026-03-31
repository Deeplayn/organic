(function(){
const LABELS={'lab-noir':'Lab Noir','cyberpunk':'Cyberpunk','academic-ink':'Academic Ink','deep-space':'Deep Space','copper-reactor':'Copper Reactor','forest-glass':'Forest Glass','lab-white':'Lab White','neon-day':'Neon Day','ivory':'Ivory Academic','clean-slate':'Clean Slate','paper-spectrum':'Paper Spectrum','solar-lab':'Solar Lab'};
const THEME_KEY='oc-theme';

const materials=[
  {
    id:'ethanol',
    pubchemQuery:'ethanol',
    name:'Ethanol',
    aliases:['ethyl alcohol','grain alcohol'],
    framework:'chain',
    group:'alcohol',
    family:'Primary alcohol',
    formula:'C2H6O',
    summary:'A small polar organic liquid used as a solvent, fuel additive, and laboratory reference alcohol.',
    build:{framework:'Two-carbon chain',bonding:'Single-bond saturated scaffold',signature:'Hydroxyl group (-OH)',classification:'Small polar protic molecule'},
    physical:{'State at room temperature':'Colorless liquid','Boiling point':'78.4 C','Melting point':'-114.1 C','Density':'0.789 g/mL','Water solubility':'Miscible'},
    chemical:[
      'The hydroxyl group makes ethanol capable of hydrogen bonding and moderate nucleophilic behavior.',
      'It can be oxidized to ethanal and then to ethanoic acid under stronger oxidation conditions.',
      'Under acidic dehydration conditions it can lose water to form ethene.'
    ],
    safety:[
      'Highly flammable and should be kept away from ignition sources.',
      'Vapors can accumulate in poorly ventilated spaces.',
      'Commonly handled in closed containers with standard solvent PPE.'
    ],
    routeLead:'A standard industrial route is catalytic hydration of ethene.',
    route:[
      'Start with ethene as the alkene feedstock.',
      'Add steam over a phosphoric acid catalyst under pressure.',
      'Hydrate the carbon-carbon double bond to give ethanol.',
      'Separate and purify the ethanol from water and unreacted feed.'
    ],
    routeNotes:[
      'The alkene is electron rich enough to be activated toward acid-catalyzed addition.',
      'Hydration adds the elements of water across the double bond.',
      'The route is scalable and works well when a simple alcohol is needed in bulk.'
    ],
    equations:[
      {label:'Hydration of ethene',equation:'CH2=CH2 + H2O -> CH3CH2OH',note:'Steam adds across the alkene over a phosphoric acid catalyst.'},
      {label:'Compact molecular formula view',equation:'C2H4 + H2O -> C2H6O',note:'This is the same transformation written at the formula level.'}
    ],
    uses:['Solvent for organic work','Fuel and disinfectant applications','Feedstock for esters and other oxygenated products']
  },
  {
    id:'acetone',
    pubchemQuery:'acetone',
    name:'Acetone',
    aliases:['propanone','dimethyl ketone'],
    framework:'chain',
    group:'ketone',
    family:'Simple ketone',
    formula:'C3H6O',
    summary:'A fast-evaporating ketone used widely as a solvent and as a benchmark carbonyl compound.',
    build:{framework:'Three-carbon chain',bonding:'Central carbonyl on a saturated chain',signature:'Ketone group (C=O)',classification:'Polar aprotic carbonyl compound'},
    physical:{'State at room temperature':'Colorless liquid','Boiling point':'56.1 C','Melting point':'-94.7 C','Density':'0.785 g/mL','Water solubility':'Miscible'},
    chemical:[
      'The carbonyl carbon is electrophilic and can undergo nucleophilic addition.',
      'Alpha hydrogens allow enolate formation under basic conditions.',
      'Acetone is less reactive than aldehydes but remains a useful carbonyl model.'
    ],
    safety:[
      'Highly flammable with a low flash point.',
      'Can dry skin and irritate eyes with prolonged contact.',
      'Needs ventilation because vapors form readily.'
    ],
    routeLead:'A common industrial source is the cumene process, where acetone is formed alongside phenol.',
    route:[
      'Convert benzene to cumene by alkylation with propene.',
      'Oxidize cumene to the corresponding hydroperoxide.',
      'Cleave the hydroperoxide under acidic conditions.',
      'Separate phenol and acetone as the main products.'
    ],
    routeNotes:[
      'The route is attractive because it co-produces two important industrial chemicals.',
      'Acidic cleavage reorganizes the hydroperoxide intermediate efficiently.',
      'Acetone is then isolated as a volatile liquid by standard separation steps.'
    ],
    equations:[
      {label:'Cumene process overview',equation:'C6H5CH(CH3)2 + O2 -> C6H5OH + (CH3)2CO',note:'Industrial production proceeds through cumene hydroperoxide before cleavage to phenol and acetone.'}
    ],
    uses:['General lab and industrial solvent','Cleaning agent for resins and oils','Starting point for carbonyl chemistry teaching']
  },
  {
    id:'acetic-acid',
    pubchemQuery:'acetic acid',
    name:'Acetic Acid',
    aliases:['ethanoic acid','vinegar acid'],
    framework:'chain',
    group:'carboxylic-acid',
    family:'Carboxylic acid',
    formula:'C2H4O2',
    summary:'A small acidic organic molecule used in synthesis, food chemistry, and polymer precursor routes.',
    build:{framework:'Two-carbon chain',bonding:'Saturated chain ending in carbonyl plus hydroxyl',signature:'Carboxylic acid group (-COOH)',classification:'Polar acidic organic molecule'},
    physical:{'State at room temperature':'Colorless liquid','Boiling point':'118.1 C','Melting point':'16.6 C','Density':'1.049 g/mL','Water solubility':'Miscible'},
    chemical:[
      'The acidic proton can be removed to give acetate salts.',
      'It participates in esterification with alcohols under acidic conditions.',
      'The carbonyl still reacts, but resonance changes its behavior relative to aldehydes and ketones.'
    ],
    safety:[
      'Concentrated acetic acid is corrosive and can damage skin or eyes.',
      'Vapors are irritating and should not be inhaled directly.',
      'Dilution should be done carefully with proper splash protection.'
    ],
    routeLead:'A major industrial route is methanol carbonylation.',
    route:[
      'Use methanol as the starting alcohol feedstock.',
      'React methanol with carbon monoxide in the presence of a catalyst system.',
      'Form the acetyl intermediate and convert it to acetic acid.',
      'Separate the product and recycle catalyst and feed gases.'
    ],
    routeNotes:[
      'Carbonylation inserts a one-carbon unit efficiently into the feedstock.',
      'Catalyst choice is critical for speed and selectivity.',
      'This route is favored because it is direct and highly scalable.'
    ],
    equations:[
      {label:'Methanol carbonylation',equation:'CH3OH + CO -> CH3COOH',note:'This compact net equation summarizes the catalytic carbonylation route.'}
    ],
    uses:['Acid component in vinegar after dilution','Reagent for acetate and ester production','Industrial feedstock for vinyl acetate and related chemistry']
  },
  {
    id:'aniline',
    pubchemQuery:'aniline',
    name:'Aniline',
    aliases:['aminobenzene','phenylamine'],
    framework:'aromatic',
    group:'amine',
    family:'Aromatic amine',
    formula:'C6H7N',
    summary:'An aromatic amine that links ring chemistry with nitrogen functionality and dye chemistry.',
    build:{framework:'Six-membered aromatic ring',bonding:'Delocalized aromatic pi system',signature:'Amino group (-NH2)',classification:'Basic aromatic amine'},
    physical:{'State at room temperature':'Oily liquid','Boiling point':'184.1 C','Melting point':'-6 C','Density':'1.02 g/mL','Water solubility':'Slightly soluble'},
    chemical:[
      'The amino group donates electron density into the ring and activates electrophilic aromatic substitution.',
      'Aniline is basic, although less basic than many aliphatic amines because the lone pair is conjugated.',
      'It can form diazonium salts, which makes it valuable in dye and substitution chemistry.'
    ],
    safety:[
      'Toxic by inhalation, ingestion, or skin absorption.',
      'Requires careful glove selection and good ventilation.',
      'Should be handled as a hazardous aromatic amine rather than a routine solvent.'
    ],
    routeLead:'A standard manufacturing route is reduction of nitrobenzene.',
    route:[
      'Begin with nitrobenzene as the aromatic nitrogen precursor.',
      'Reduce the nitro group using catalytic hydrogenation or an equivalent reducing system.',
      'Convert the nitro functionality through intermediate reduction states to the amine.',
      'Purify aniline from by-products and residual reagents.'
    ],
    routeNotes:[
      'Reduction changes the strongly withdrawing nitro group into an electron-donating amine.',
      'Catalytic hydrogenation is widely used because it is efficient at scale.',
      'Purification matters because aromatic amine products can contain colored impurities.'
    ],
    equations:[
      {label:'Nitrobenzene reduction',equation:'C6H5NO2 + 3 H2 -> C6H5NH2 + 2 H2O',note:'Hydrogenation converts the nitro group into the aromatic amine.'}
    ],
    uses:['Precursor to dyes and pigments','Intermediate for pharmaceuticals and polymers','Reference example for aromatic amine reactivity']
  },
  {
    id:'aspirin',
    pubchemQuery:'aspirin',
    name:'Aspirin',
    aliases:['acetylsalicylic acid','asa'],
    framework:'mixed',
    group:'ester',
    family:'Aromatic ester with acid group',
    formula:'C9H8O4',
    summary:'A classic aromatic ester-containing pharmaceutical built from salicylic acid chemistry.',
    build:{framework:'Aromatic ring plus carbonyl-containing substituents',bonding:'Aromatic core with ester and acid functionality',signature:'Ester group plus carboxylic acid',classification:'Mixed-function aromatic organic molecule'},
    physical:{'State at room temperature':'White crystalline solid','Boiling point':'Decomposes before clean boiling','Melting point':'136 C','Density':'1.40 g/cm3','Water solubility':'Slightly soluble'},
    chemical:[
      'The ester can hydrolyze, especially under strongly acidic or basic conditions.',
      'The carboxylic acid contributes acidity and changes solubility behavior.',
      'Its aromatic core is less reactive than isolated alkenes because aromatic stabilization is retained.'
    ],
    safety:[
      'Solid powder should be handled to avoid dust inhalation.',
      'Hydrolysis can occur if stored with excess moisture or heat.',
      'Laboratory synthesis typically requires standard acid and anhydride precautions.'
    ],
    routeLead:'A familiar preparation is acetylation of salicylic acid.',
    route:[
      'Start from salicylic acid, which already contains the aromatic ring and acid group.',
      'React it with acetic anhydride in the presence of an acid catalyst.',
      'Transfer the acetyl group onto the phenolic oxygen to form the ester.',
      'Crystallize and dry the aspirin product.'
    ],
    routeNotes:[
      'The phenolic oxygen is the site that becomes acetylated.',
      'Acetic anhydride is used because it is a strong acyl donor.',
      'Crystallization is a convenient purification step for this solid product.'
    ],
    equations:[
      {label:'Acetylation of salicylic acid',equation:'C7H6O3 + (CH3CO)2O -> C9H8O4 + CH3COOH',note:'Salicylic acid reacts with acetic anhydride to form aspirin and acetic acid.'}
    ],
    uses:['Analgesic and antipyretic drug','Classic teaching example for ester formation','Accessible crystallization experiment in teaching labs']
  },
  {
    id:'styrene',
    pubchemQuery:'styrene',
    name:'Styrene',
    aliases:['vinylbenzene','phenylethene'],
    framework:'aromatic',
    group:'alkene',
    family:'Aromatic alkene',
    formula:'C8H8',
    summary:'An aromatic alkene best known as the monomer used to make polystyrene and related materials.',
    build:{framework:'Aromatic ring attached to a two-carbon vinyl side chain',bonding:'Aromatic system plus reactive carbon-carbon double bond',signature:'Alkene group (C=C)',classification:'Polymer precursor monomer'},
    physical:{'State at room temperature':'Colorless liquid','Boiling point':'145 C','Melting point':'-30.6 C','Density':'0.909 g/mL','Water solubility':'Very low'},
    chemical:[
      'The alkene can undergo polymerization to make polystyrene.',
      'The double bond also participates in addition reactions more readily than the aromatic ring.',
      'The aromatic ring stabilizes adjacent intermediates and influences reactivity.'
    ],
    safety:[
      'Flammable liquid with notable vapor exposure concerns.',
      'Stored with inhibitors because spontaneous polymerization is undesirable.',
      'Ventilation and temperature control are important in handling.'
    ],
    routeLead:'A widely used industrial route starts from ethylbenzene.',
    route:[
      'Prepare ethylbenzene from benzene and ethene-derived feedstocks.',
      'Heat ethylbenzene over a dehydrogenation catalyst.',
      'Remove hydrogen to create the vinyl double bond.',
      'Separate styrene and stabilize it for storage.'
    ],
    routeNotes:[
      'Dehydrogenation converts a saturated side chain into the reactive alkene.',
      'The process is energy intensive and depends on catalyst control.',
      'Inhibitors are added because the product can polymerize during storage.'
    ],
    equations:[
      {label:'Dehydrogenation of ethylbenzene',equation:'C6H5CH2CH3 -> C6H5CH=CH2 + H2',note:'A dehydrogenation catalyst removes hydrogen to create the vinyl group.'}
    ],
    uses:['Monomer for polystyrene production','Intermediate for resins and copolymers','Teaching example for polymer precursor chemistry']
  }
];

const frameworkSelect=document.getElementById('frameworkSelect');
const groupSelect=document.getElementById('groupSelect');
const materialSelect=document.getElementById('materialSelect');
const compoundSearch=document.getElementById('compoundSearch');
const compoundSuggestionList=document.getElementById('compoundSuggestionList');
const searchSuggestions=document.getElementById('searchSuggestions');
const loadMaterialBtn=document.getElementById('loadMaterialBtn');
const searchCompoundBtn=document.getElementById('searchCompoundBtn');
const builderStatus=document.getElementById('builderStatus');
const viewerStatus=document.getElementById('viewerStatus');
const viewerCaption=document.getElementById('viewerCaption');
const viewerAtomLegend=document.getElementById('viewerAtomLegend');
const apiDataList=document.getElementById('apiDataList');
const propertyHighlights=document.getElementById('propertyHighlights');
const prepOverview=document.getElementById('prepOverview');

let currentViewer=null;
let currentViewerStyle='stick';
let currentSdf='';
let currentRenderMode='none';
let currentViewerAtoms=[];

function escapeHtml(value){
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function togglePanel(){return window.togglePanel?.();}
function closePanel(){return window.closePanel?.();}
function setTheme(theme,button){return window.setTheme?.(theme,button);}

function renderCardList(targetId,items,strongLabel){
  const target=document.getElementById(targetId);
  if(!target)return;
  target.innerHTML=items.map(item=>`<div class="stack-card">${strongLabel?`<strong>${strongLabel}</strong>`:''}${item}</div>`).join('');
}

function renderHighlightStrip(items){
  propertyHighlights.innerHTML=items.map(item=>`<div class="highlight-card"><span class="label">${item.label}</span><span class="value">${item.value}</span></div>`).join('');
}

function renderPrepOverview(items){
  prepOverview.innerHTML=items.map(item=>`<div class="prep-card"><span class="label">${item.label}</span><span class="value">${item.value}</span></div>`).join('');
}

function renderEquationList(items){
  const target=document.getElementById('routeEquations');
  if(!target)return;
  const entries=items?.length?items:[{label:'Equation status',equation:'No curated teaching equation available.',note:'Choose a curated studio material to see a compact preparation equation.'}];
  target.innerHTML=entries.map(item=>`<div class="equation-card"><span class="equation-label">${escapeHtml(item.label||'Equation')}</span><div class="equation-formula">${escapeHtml(item.equation||'No curated teaching equation available.')}</div>${item.note?`<p class="equation-note">${escapeHtml(item.note)}</p>`:''}</div>`).join('');
}

function normalizeQuery(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function compactQuery(value){
  return normalizeQuery(value).replace(/\s+/g,'');
}

function levenshteinDistance(a,b){
  if(a===b)return 0;
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  const rows=Array.from({length:b.length+1},(_,index)=>index);
  for(let i=1;i<=a.length;i++){
    let previous=i-1;
    rows[0]=i;
    for(let j=1;j<=b.length;j++){
      const current=rows[j];
      const cost=a[i-1]===b[j-1]?0:1;
      rows[j]=Math.min(
        rows[j]+1,
        rows[j-1]+1,
        previous+cost
      );
      previous=current;
    }
  }
  return rows[b.length];
}

function materialSearchTerms(material){
  return [...new Set([
    material.name,
    material.pubchemQuery,
    material.family,
    material.formula,
    ...(material.aliases||[])
  ].filter(Boolean))];
}

function scoreMaterialMatch(query,material){
  const normalized=normalizeQuery(query);
  const compact=compactQuery(query);
  if(!normalized)return 0;
  let best=0;
  materialSearchTerms(material).forEach(term=>{
    const termNormalized=normalizeQuery(term);
    const termCompact=compactQuery(term);
    if(!termNormalized)return;
    if(normalized===termNormalized||compact===termCompact){
      best=Math.max(best,120);
      return;
    }
    if(termNormalized.startsWith(normalized)||termCompact.startsWith(compact))best=Math.max(best,95);
    if(termNormalized.includes(normalized)||termCompact.includes(compact))best=Math.max(best,85);
    const queryTokens=normalized.split(' ').filter(Boolean);
    const termTokens=termNormalized.split(' ').filter(Boolean);
    if(queryTokens.length&&queryTokens.every(token=>termTokens.some(candidate=>candidate.startsWith(token)||candidate.includes(token))))best=Math.max(best,74);
    if(compact.length>=4&&termCompact.length>=4){
      const distance=levenshteinDistance(compact,termCompact);
      if(distance<=2)best=Math.max(best,68-distance*4);
    }
  });
  return best;
}

function getSuggestedMaterials(query,limit=5){
  const normalized=normalizeQuery(query);
  if(!normalized){
    const defaults=filteredMaterials();
    return (defaults.length?defaults:materials).slice(0,limit).map(material=>({material,score:1}));
  }
  return materials
    .map(material=>({material,score:scoreMaterialMatch(normalized,material)}))
    .filter(entry=>entry.score>0)
    .sort((a,b)=>b.score-a.score||a.material.name.localeCompare(b.material.name))
    .slice(0,limit);
}

function resolveLocalMaterial(query){
  const best=getSuggestedMaterials(query,1)[0];
  if(!best)return null;
  const queryCompact=compactQuery(query);
  if(!queryCompact)return null;
  const exactAlias=materialSearchTerms(best.material).some(term=>compactQuery(term)===queryCompact);
  if(exactAlias||best.score>=95)return best.material;
  if(queryCompact.length>=6&&best.score>=85)return best.material;
  return null;
}

function renderSearchSuggestions(query){
  const suggestions=getSuggestedMaterials(query,5);
  compoundSuggestionList.innerHTML=suggestions.map(({material})=>`<option value="${escapeHtml(material.name)}"></option>`).join('');
  searchSuggestions.innerHTML=suggestions.map(({material})=>`<button type="button" class="search-suggestion" data-material-id="${material.id}"><span class="search-suggestion-name">${escapeHtml(material.name)}</span><span class="search-suggestion-meta">${escapeHtml(`${material.family} · ${material.formula}`)}</span></button>`).join('');
}

function filteredMaterials(){
  return materials.filter(material=>{
    const frameworkMatch=frameworkSelect.value==='all'||material.framework===frameworkSelect.value;
    const groupMatch=groupSelect.value==='all'||material.group===groupSelect.value;
    return frameworkMatch&&groupMatch;
  });
}

function fillMaterialSelect(preferredId){
  const options=filteredMaterials();
  materialSelect.innerHTML='';
  if(!options.length){
    materialSelect.innerHTML='<option value="">No matching material</option>';
    materialSelect.disabled=true;
    loadMaterialBtn.disabled=true;
    return null;
  }
  materialSelect.disabled=false;
  loadMaterialBtn.disabled=false;
  options.forEach(material=>{
    const option=document.createElement('option');
    option.value=material.id;
    option.textContent=material.name;
    materialSelect.appendChild(option);
  });
  const chosen=options.find(material=>material.id===preferredId)||options[0];
  materialSelect.value=chosen.id;
  return chosen;
}

function setBuilderStatus(message){
  builderStatus.textContent=message;
}

function setViewerStatus(message){
  viewerStatus.textContent=message;
}

function atomColor(element){
  const palette={
    H:'#f6f9ff',
    C:'#d9e4ff',
    N:'#7b9cff',
    O:'#ff8e8e',
    S:'#ffd26b',
    P:'#ffb86c',
    F:'#74f0d7',
    Cl:'#74f0d7',
    Br:'#c792ff',
    I:'#d6b3ff'
  };
  return palette[element]||'#c7d3ea';
}

function elementName(element){
  const names={
    H:'Hydrogen',
    C:'Carbon',
    N:'Nitrogen',
    O:'Oxygen',
    S:'Sulfur',
    P:'Phosphorus',
    F:'Fluorine',
    Cl:'Chlorine',
    Br:'Bromine',
    I:'Iodine'
  };
  return names[element]||element;
}

function collectUniqueElements(atoms){
  const seen=new Set();
  return atoms.filter(atom=>{
    const key=String(atom.element||'').trim();
    if(!key||seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

function parseSdfAtoms(sdf){
  const lines=String(sdf||'').split(/\r?\n/);
  const countsLine=lines[3]||'';
  const atomCount=Number.parseInt(countsLine.slice(0,3).trim(),10);
  if(!Number.isFinite(atomCount)||atomCount<=0)return[];
  return Array.from({length:atomCount},(_,index)=>{
    const line=lines[4+index]||'';
    const parts=line.trim().split(/\s+/);
    const element=(parts[3]||'?').replace(/[^A-Za-z]/g,'')||'?';
    return{
      index:index+1,
      element,
      x:Number.parseFloat(parts[0])||0,
      y:Number.parseFloat(parts[1])||0,
      z:Number.parseFloat(parts[2])||0
    };
  });
}

function renderViewerAtomLegend(atoms=[]){
  currentViewerAtoms=atoms;
  if(!viewerAtomLegend)return;
  if(!atoms.length){
    viewerAtomLegend.innerHTML='<div class="viewer-atom-legend-title">Atom guide</div><div class="viewer-atom-empty">Load a structure to see the element color key.</div>';
    return;
  }
  const elements=collectUniqueElements(atoms);
  viewerAtomLegend.innerHTML=`<div class="viewer-atom-legend-title">Atom guide</div><div class="viewer-atom-legend-list">${elements.map(atom=>`<div class="viewer-atom-legend-item"><span class="viewer-atom-swatch" style="background:${atomColor(atom.element)}"></span><span class="viewer-atom-code">${escapeHtml(atom.element)}</span><span>${escapeHtml(elementName(atom.element))}</span></div>`).join('')}</div>`;
}

function clearViewerLabels(){
  if(currentViewer&&typeof currentViewer.removeAllLabels==='function'){
    currentViewer.removeAllLabels();
  }
}

function getSelectedLocalMaterial(){
  return materials.find(entry=>entry.id===materialSelect.value)||null;
}

function syncControlsToMaterial(material){
  if(!material)return;
  frameworkSelect.value=material.framework;
  groupSelect.value=material.group;
  fillMaterialSelect(material.id);
  materialSelect.value=material.id;
  compoundSearch.value=material.pubchemQuery||material.name;
  renderSearchSuggestions(compoundSearch.value);
}

function resetViewerShell(message='3D viewer will update when a compound is loaded.'){
  const mount=document.getElementById('viewer3d');
  mount.innerHTML='';
  currentViewer=null;
  currentSdf='';
  currentRenderMode='none';
  currentViewerAtoms=[];
  renderViewerAtomLegend([]);
  setViewerStatus(message);
}

function ensureViewer(){
  if(currentViewer||!window.$3Dmol)return currentViewer;
  const mount=document.getElementById('viewer3d');
  currentViewer=window.$3Dmol.createViewer(mount,{backgroundColor:'rgba(0,0,0,0)'});
  return currentViewer;
}

function refreshViewerLayout({recenter=false}={}){
  if(!currentViewer)return;
  currentViewer.resize();
  if(recenter){
    currentViewer.zoomTo();
  }
  clearViewerLabels();
  currentViewer.render();
}

function applyViewerStyle(){
  if(!currentViewer||!currentSdf)return;
  currentViewer.setStyle({},{});
  if(currentViewerStyle==='sphere'){
    currentViewer.setStyle({},{sphere:{scale:.32},stick:{radius:.14}});
  }else{
    currentViewer.setStyle({},{stick:{radius:.18},sphere:{scale:.24}});
  }
  refreshViewerLayout({recenter:true});
}

function renderSdfInViewer(sdf,compoundName,mode='3d'){
  if(!window.$3Dmol){
    resetViewerShell('3Dmol.js did not load, so the 3D viewer is unavailable.');
    return;
  }
  const viewer=ensureViewer();
  viewer.clear();
  clearViewerLabels();
  if(typeof viewer.removeAllModels==='function')viewer.removeAllModels();
  viewer.addModel(sdf,'sdf');
  currentSdf=sdf;
  currentRenderMode=mode;
  renderViewerAtomLegend(parseSdfAtoms(sdf));
  applyViewerStyle();
  viewerCaption.textContent=`${mode==='3d'?'3D conformer':'2D structure'} for ${compoundName}. Drag to rotate and scroll to zoom.`;
  setViewerStatus(`${mode==='3d'?'3D conformer':'2D structure'} loaded for ${compoundName}.`);
}

function renderLocalMaterial(material){
  if(!material){
    document.getElementById('previewTitle').textContent='No matching material';
    document.getElementById('materialSummary').textContent='Try a different framework or functional group combination to load a profile.';
    document.getElementById('materialChips').innerHTML='';
    document.getElementById('buildSummary').innerHTML='<div><dt>Status</dt><dd>Waiting for a matching material</dd></div>';
    document.getElementById('physicalList').innerHTML='<div><dt>Physical profile</dt><dd>No data until a matching material is selected.</dd></div>';
    renderCardList('chemicalList',['No chemical behavior is shown because the current filter combination has no matching material.']);
    apiDataList.innerHTML='<div class="stack-card">Live PubChem data will appear here after a compound search or material load.</div>';
    document.getElementById('routeLead').textContent='Choose a different filter combination to see a preparation route.';
    document.getElementById('routeSteps').innerHTML='<li>No synthesis route is available for the current filter combination.</li>';
    renderEquationList([]);
    renderCardList('routeNotes',['Route explanations will appear after a material profile is loaded.']);
    renderCardList('useList',['Uses will appear after a material profile is loaded.']);
    renderHighlightStrip([
      {label:'Formula',value:'Waiting'},
      {label:'Mass / CID',value:'-'},
      {label:'3D View',value:'Idle'},
      {label:'Source',value:'Local only'}
    ]);
    renderPrepOverview([
      {label:'Route source',value:'No match'},
      {label:'Preparation type',value:'Unavailable'},
      {label:'Teaching layer',value:'Paused'},
      {label:'Equation layer',value:'Waiting'}
    ]);
    resetViewerShell('3D viewer is waiting for a matching material.');
    return;
  }

  document.getElementById('previewTitle').textContent=material.name;
  document.getElementById('materialSummary').textContent=material.summary;
  document.getElementById('materialChips').innerHTML=[
    material.family,
    material.formula,
    material.framework.replace('-', ' ')
  ].map(value=>`<span class="chip">${value}</span>`).join('');

  document.getElementById('buildSummary').innerHTML=Object.entries(material.build)
    .map(([key,value])=>`<div><dt>${key.replace(/([A-Z])/g,' $1')}</dt><dd>${value}</dd></div>`)
    .join('');

  document.getElementById('physicalList').innerHTML=Object.entries(material.physical)
    .map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`)
    .join('');

  renderCardList('chemicalList',material.chemical);
  renderRouteData(material,[]);
  renderCardList('useList',material.uses);
  apiDataList.innerHTML='<div class="stack-card">Fetching live PubChem data for this material will add identifiers, computed descriptors, and a 3D conformer.</div>';
  renderHighlightStrip([
    {label:'Formula',value:material.formula},
    {label:'Mass / CID',value:'Loading'},
    {label:'3D View',value:'Preparing'},
    {label:'Source',value:'Local + API'}
  ]);
  renderPrepOverview([
    {label:'Route source',value:'Curated'},
    {label:'Preparation type',value:material.route[0]?'Structured':'Pending'},
    {label:'Teaching layer',value:'Active'},
    {label:'Equation layer',value:material.equations?.length?'Curated':'Unavailable'}
  ]);
}

function renderSearchPlaceholder(query){
  document.getElementById('previewTitle').textContent=query;
  document.getElementById('materialSummary').textContent='Searching PubChem for live compound data and a 3D conformer.';
  document.getElementById('materialChips').innerHTML=`<span class="chip">Live search</span><span class="chip">${query}</span>`;
  document.getElementById('buildSummary').innerHTML='<div><dt>Status</dt><dd>Fetching compound record</dd></div>';
  document.getElementById('physicalList').innerHTML='<div><dt>Physical profile</dt><dd>Waiting for PubChem data.</dd></div>';
  renderCardList('chemicalList',['Live chemical annotations will appear after the search completes.']);
  renderCardList('routeNotes',['Curated or annotation-based route notes will appear after the search completes.']);
  renderCardList('useList',['Local uses appear automatically when the searched compound matches a curated material.']);
  apiDataList.innerHTML='<div class="stack-card">Querying PubChem for identifiers and descriptors.</div>';
  document.getElementById('routeLead').textContent='Preparing route section.';
  document.getElementById('routeSteps').innerHTML='<li>Waiting for compound data.</li>';
  renderEquationList([]);
  renderHighlightStrip([
    {label:'Formula',value:'Searching'},
    {label:'Mass / CID',value:'Searching'},
    {label:'3D View',value:'Checking'},
    {label:'Source',value:'PubChem'}
  ]);
  renderPrepOverview([
    {label:'Route source',value:'Pending'},
    {label:'Preparation type',value:'Unknown'},
    {label:'Teaching layer',value:'Not matched'},
    {label:'Equation layer',value:'Pending'}
  ]);
}

function mergePhysicalProfile(localMaterial,props){
  const rows={...(localMaterial?.physical||{})};
  if(props.MolecularWeight)rows['Molecular weight']=`${props.MolecularWeight} g/mol`;
  if(props.XLogP!==undefined)rows['XLogP']=String(props.XLogP);
  if(props.TPSA!==undefined)rows['Topological polar surface area']=`${props.TPSA} A2`;
  if(props.HBondDonorCount!==undefined)rows['H-bond donor count']=String(props.HBondDonorCount);
  if(props.HBondAcceptorCount!==undefined)rows['H-bond acceptor count']=String(props.HBondAcceptorCount);
  if(props.Complexity!==undefined)rows['Complexity']=String(props.Complexity);
  document.getElementById('physicalList').innerHTML=Object.entries(rows)
    .map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`)
    .join('');
}

function renderApiData(data){
  const items=[];
  if(data.cid)items.push(`<strong>PubChem CID</strong>${data.cid}`);
  if(data.properties?.IUPACName)items.push(`<strong>IUPAC name</strong>${data.properties.IUPACName}`);
  if(data.properties?.CanonicalSMILES)items.push(`<strong>Canonical SMILES</strong>${data.properties.CanonicalSMILES}`);
  if(data.properties?.MolecularFormula)items.push(`<strong>Molecular formula</strong>${data.properties.MolecularFormula}`);
  if(data.properties?.Charge!==undefined)items.push(`<strong>Formal charge</strong>${data.properties.Charge}`);
  if(data.url)items.push(`<strong>Source</strong><a href="${data.url}" target="_blank" rel="noreferrer">Open PubChem record</a>`);
  apiDataList.innerHTML=items.length?items.map(item=>`<div class="stack-card">${item}</div>`).join(''):'<div class="stack-card">PubChem returned limited live descriptor data for this compound.</div>';
}

function renderRouteData(localMaterial,manufacturingItems){
  if(manufacturingItems.length){
    document.getElementById('routeLead').textContent='PubChem returned a manufacturing or preparation note for this compound.';
    document.getElementById('routeSteps').innerHTML=manufacturingItems.map(item=>`<li>${item}</li>`).join('');
    renderEquationList(localMaterial?.equations||[]);
    renderCardList('routeNotes',['These notes were pulled from PubChem annotation text and may be less structured than the curated local routes.']);
  }else if(localMaterial){
    document.getElementById('routeLead').textContent=localMaterial.routeLead;
    document.getElementById('routeSteps').innerHTML=localMaterial.route.map(step=>`<li>${step}</li>`).join('');
    renderEquationList(localMaterial.equations||[]);
    renderCardList('routeNotes',localMaterial.routeNotes);
  }else{
    document.getElementById('routeLead').textContent='No structured manufacturing note was returned for this compound.';
    document.getElementById('routeSteps').innerHTML='<li>PubChem did not return a compact manufacturing route for this search.</li>';
    renderEquationList([]);
    renderCardList('routeNotes',['Try a well-known industrial compound or rely on the curated material list for teaching-oriented synthesis notes.']);
  }
}

function renderUseData(localMaterial){
  renderCardList('useList',localMaterial?.uses||['No curated uses are stored locally for this searched compound.']);
}

function normalizeMarkupText(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(normalizeMarkupText).join(' ');
  if(value?.StringWithMarkup)return value.StringWithMarkup.map(entry=>entry.String).join(' ');
  if(value?.String)return value.String;
  if(value?.Number)return String(value.Number);
  if(value?.Boolean!==undefined)return String(value.Boolean);
  return '';
}

function collectSectionText(section,bucket=[]){
  if(section?.Information){
    section.Information.forEach(info=>{
      const text=normalizeMarkupText(info.Value).replace(/\s+/g,' ').trim();
      if(text)bucket.push({heading:section.TOCHeading||'PubChem note',text});
    });
  }
  if(section?.Section)section.Section.forEach(child=>collectSectionText(child,bucket));
  return bucket;
}

async function fetchJson(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function fetchText(url){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Request failed: ${response.status}`);
  return response.text();
}

async function fetchPubChemData(query){
  const cidUrl=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`;
  const cidJson=await fetchJson(cidUrl);
  const cid=cidJson?.IdentifierList?.CID?.[0];
  if(!cid)throw new Error('No PubChem compound was found for that query.');

  const propertyNames='MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,Complexity,Charge';
  const propUrl=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${propertyNames}/JSON`;
  const manufHeadings=['Methods of Manufacturing','Manufacturing Process','Synthesis Reference'];

  const [propertiesResult,sdf3dResult,sdf2dResult,...manufacturingResults]=await Promise.allSettled([
    fetchJson(propUrl),
    fetchText(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`),
    fetchText(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`),
    ...manufHeadings.map(heading=>fetchJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`))
  ]);

  const properties=propertiesResult.status==='fulfilled'?propertiesResult.value?.PropertyTable?.Properties?.[0]||{}:{};
  const manufacturingText=manufacturingResults
    .filter(result=>result.status==='fulfilled')
    .flatMap(result=>collectSectionText(result.value?.Record).map(entry=>entry.text));

  return{
    cid,
    properties,
    manufacturingText:[...new Set(manufacturingText)].slice(0,5),
    sdf3d:sdf3dResult.status==='fulfilled'&&sdf3dResult.value.includes('M  END')?sdf3dResult.value:'',
    sdf2d:sdf2dResult.status==='fulfilled'&&sdf2dResult.value.includes('M  END')?sdf2dResult.value:'',
    url:`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
  };
}

function deriveChemicalNotes(localMaterial,props){
  const notes=[...(localMaterial?.chemical||[])];
  if(props.CanonicalSMILES)notes.unshift(`Canonical SMILES from PubChem: ${props.CanonicalSMILES}`);
  if(props.HBondDonorCount!==undefined||props.HBondAcceptorCount!==undefined){
    notes.push(`Computed hydrogen-bond profile: ${props.HBondDonorCount??0} donor(s) and ${props.HBondAcceptorCount??0} acceptor(s).`);
  }
  if(props.XLogP!==undefined)notes.push(`Computed lipophilicity (XLogP) is ${props.XLogP}, which helps estimate partitioning between polar and nonpolar environments.`);
  return [...new Set(notes)].slice(0,6);
}

async function loadCompound(query,localMaterial){
  const resolvedQuery=query.trim();
  if(!resolvedQuery){
    setBuilderStatus('Enter a compound name or choose a material from the list first.');
    return;
  }

  setBuilderStatus(`Looking up ${resolvedQuery} in PubChem...`);
  setViewerStatus(`Fetching 3D structure for ${resolvedQuery}...`);
  if(localMaterial)renderLocalMaterial(localMaterial);
  else renderSearchPlaceholder(resolvedQuery);

  try{
    const data=await fetchPubChemData(resolvedQuery);
    const displayName=localMaterial?.name||data.properties?.IUPACName||resolvedQuery;
    const routeSource=data.manufacturingText.length?'PubChem annotation':localMaterial?'Curated studio note':'Unavailable';
    const has3d=Boolean(data.sdf3d);
    const has2d=Boolean(data.sdf2d);
    const viewState=has3d?'3D ready':has2d?'2D ready':'Unavailable';

    document.getElementById('previewTitle').textContent=displayName;
    document.getElementById('materialSummary').textContent=localMaterial?.summary||`Live compound data loaded from PubChem for ${displayName}.`;
    document.getElementById('materialChips').innerHTML=[
      localMaterial?.family,
      data.properties?.MolecularFormula,
      localMaterial?.framework?.replace('-', ' '),
      `CID ${data.cid}`
    ].filter(Boolean).map(value=>`<span class="chip">${value}</span>`).join('');

    if(localMaterial){
      document.getElementById('buildSummary').innerHTML=Object.entries(localMaterial.build)
        .map(([key,value])=>`<div><dt>${key.replace(/([A-Z])/g,' $1')}</dt><dd>${value}</dd></div>`)
        .join('');
    }else{
      document.getElementById('buildSummary').innerHTML=[
        ['query',resolvedQuery],
        ['iupac',data.properties?.IUPACName||'Not provided'],
        ['formula',data.properties?.MolecularFormula||'Not provided'],
        ['smiles',data.properties?.CanonicalSMILES||'Not provided']
      ].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
    }

    mergePhysicalProfile(localMaterial,data.properties);
    renderCardList('chemicalList',deriveChemicalNotes(localMaterial,data.properties));
    renderRouteData(localMaterial,data.manufacturingText);
    renderUseData(localMaterial);
    renderApiData(data);
    renderHighlightStrip([
      {label:'Formula',value:data.properties?.MolecularFormula||localMaterial?.formula||'Unknown'},
      {label:'Mass / CID',value:data.properties?.MolecularWeight?`${data.properties.MolecularWeight} / ${data.cid}`:`CID ${data.cid}`},
      {label:'3D View',value:viewState},
      {label:'Source',value:'PubChem'}
    ]);
    renderPrepOverview([
      {label:'Route source',value:routeSource},
      {label:'Preparation type',value:data.manufacturingText.length?'Annotation-based':localMaterial?'Curated route':'Limited'},
      {label:'Teaching layer',value:localMaterial?'Active':'Generic'},
      {label:'Equation layer',value:localMaterial?.equations?.length?'Curated':'Unavailable'}
    ]);

    if(has3d){
      renderSdfInViewer(data.sdf3d,displayName,'3d');
    }else if(has2d){
      renderSdfInViewer(data.sdf2d,displayName,'2d');
    }else{
      resetViewerShell(`PubChem did not return a usable 2D or 3D structure for ${displayName}.`);
      viewerCaption.textContent='The selected compound did not return a usable 2D or 3D structure from this lookup.';
    }

    setBuilderStatus(`Loaded live PubChem data for ${displayName}.`);
    compoundSearch.value=resolvedQuery;
  }catch(error){
    setBuilderStatus(`PubChem lookup failed for ${resolvedQuery}. Showing the local teaching profile instead.`);
    resetViewerShell('3D structure could not be loaded from PubChem.');
    apiDataList.innerHTML='<div class="stack-card">PubChem data could not be loaded right now. The page is using the local fallback profile.</div>';
    if(localMaterial)renderLocalMaterial(localMaterial);
    else{
      const suggestions=getSuggestedMaterials(resolvedQuery,3).map(entry=>entry.material.name);
      document.getElementById('previewTitle').textContent=resolvedQuery;
      document.getElementById('materialSummary').textContent='PubChem did not return a usable record for this search.';
      document.getElementById('materialChips').innerHTML='<span class="chip">Search failed</span>';
      document.getElementById('buildSummary').innerHTML='<div><dt>Status</dt><dd>No usable PubChem record found</dd></div>';
      document.getElementById('physicalList').innerHTML='<div><dt>Physical profile</dt><dd>No live property data is available for this query.</dd></div>';
      renderCardList('chemicalList',[suggestions.length?`Try one of these curated suggestions instead: ${suggestions.join(', ')}.`:'Try a more standard compound name or pick a curated material from the list.']);
      document.getElementById('routeLead').textContent='No route data is available for this query.';
      document.getElementById('routeSteps').innerHTML='<li>Use a different compound name or select one of the curated materials.</li>';
      renderEquationList([{label:'Equation status',equation:'No curated teaching equation available.',note:suggestions.length?`Try ${suggestions.join(', ')} for stored route equations.`:'Choose a curated studio material to see an equation view.'}]);
      renderCardList('routeNotes',['The builder could not map this query to a compact manufacturing or teaching route.']);
      renderCardList('useList',['Curated uses are only shown for compounds that match the local teaching set.']);
      renderHighlightStrip([
        {label:'Formula',value:'Unavailable'},
        {label:'Mass / CID',value:'Unavailable'},
        {label:'3D View',value:'Failed'},
        {label:'Source',value:'No record'}
      ]);
      renderPrepOverview([
        {label:'Route source',value:'No data'},
        {label:'Preparation type',value:'Unavailable'},
        {label:'Teaching layer',value:'No match'},
        {label:'Equation layer',value:'No match'}
      ]);
    }
  }
}

function loadSelectedMaterial(){
  const material=getSelectedLocalMaterial();
  renderLocalMaterial(material);
  if(!material){
    setBuilderStatus('No matching material is selected.');
    return;
  }
  loadCompound(material.pubchemQuery||material.name,material);
}

function searchTypedCompound(){
  const query=compoundSearch.value.trim();
  if(!query){
    setBuilderStatus('Type a compound name first, then search PubChem.');
    compoundSearch.focus();
    return;
  }
  const localMatch=resolveLocalMaterial(query);
  if(localMatch){
    syncControlsToMaterial(localMatch);
    renderLocalMaterial(localMatch);
    if(compactQuery(query)!==compactQuery(localMatch.name)&&compactQuery(query)!==compactQuery(localMatch.pubchemQuery)){
      setBuilderStatus(`Using the closest curated match, ${localMatch.name}, while loading live PubChem data.`);
    }
  }
  loadCompound(localMatch?(localMatch.pubchemQuery||localMatch.name):query,localMatch||null);
}

document.getElementById('styleStickBtn').addEventListener('click',()=>{
  currentViewerStyle='stick';
  applyViewerStyle();
});

document.getElementById('styleSphereBtn').addEventListener('click',()=>{
  currentViewerStyle='sphere';
  applyViewerStyle();
});

document.getElementById('resetViewBtn').addEventListener('click',()=>{
  if(currentViewer){
    refreshViewerLayout({recenter:true});
    setViewerStatus('3D view reset.');
  }
});

window.addEventListener('resize',()=>{
  if(currentViewer){
    refreshViewerLayout();
  }
});

window.addEventListener('organo:panel-changed',event=>{
  if(event.detail?.panel!=='studio'||!currentViewer)return;
  requestAnimationFrame(()=>{
    refreshViewerLayout({recenter:true});
    requestAnimationFrame(()=>refreshViewerLayout({recenter:true}));
  });
});

frameworkSelect.addEventListener('change',()=>{
  const material=fillMaterialSelect(materialSelect.value);
  renderLocalMaterial(material);
  if(material)setBuilderStatus(`${material.name} is ready to load.`);
  else setBuilderStatus('No materials match the current filters. Change one of the filters to continue.');
  renderSearchSuggestions(compoundSearch.value);
});

groupSelect.addEventListener('change',()=>{
  const material=fillMaterialSelect(materialSelect.value);
  renderLocalMaterial(material);
  if(material)setBuilderStatus(`${material.name} is ready to load.`);
  else setBuilderStatus('No materials match the current filters. Change one of the filters to continue.');
  renderSearchSuggestions(compoundSearch.value);
});

materialSelect.addEventListener('change',()=>{
  const material=getSelectedLocalMaterial();
  renderLocalMaterial(material);
  if(material)compoundSearch.value=material.pubchemQuery||material.name;
  renderSearchSuggestions(compoundSearch.value);
});

loadMaterialBtn.addEventListener('click',loadSelectedMaterial);
searchCompoundBtn.addEventListener('click',searchTypedCompound);
searchSuggestions.addEventListener('click',event=>{
  const button=event.target.closest('[data-material-id]');
  if(!button)return;
  const material=materials.find(entry=>entry.id===button.dataset.materialId);
  if(!material)return;
  syncControlsToMaterial(material);
  renderLocalMaterial(material);
  setBuilderStatus(`${material.name} selected from suggestions. Loading live data now.`);
  loadCompound(material.pubchemQuery||material.name,material);
});
compoundSearch.addEventListener('input',()=>{
  renderSearchSuggestions(compoundSearch.value);
});
compoundSearch.addEventListener('focus',()=>{
  renderSearchSuggestions(compoundSearch.value);
});
compoundSearch.addEventListener('keydown',event=>{
  if(event.key==='Enter'){
    event.preventDefault();
    searchTypedCompound();
  }
});

const first=fillMaterialSelect('ethanol');
renderLocalMaterial(first);
compoundSearch.value=first?.pubchemQuery||'';
renderSearchSuggestions(compoundSearch.value);
resetViewerShell('3D viewer will load after the first PubChem lookup finishes.');
if(first)loadCompound(first.pubchemQuery,first);
})();
