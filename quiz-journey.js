(function(){
  const JOURNEY_VERSION=2;
  const EVALUATING_DURATION_MIN=60;
  const PROGRESSIVE_DURATION_MIN=20;
  const FINAL_DURATION_MIN=60;
  const REQUIRED_PROGRESSIVE_QUIZZES=3;
  const PASS_PERCENTAGE=60;
  const LOW_TIME_WARNING_MS=5*60*1000;
  const QUIZ_STAGES=['EVALUATION','PROGRESSIVE','FINAL','COMPLETED'];
  const QUIZ_MODES=['evaluation','progressive','final'];
  const QUIZ_LEVELS=['Beginner','Intermediate','Advanced','Scholar'];
  const COURSE_LEVELS=['Beginner','Intermediate','Advanced'];
  const BADGE_ORDER=['beginner','intermediate','high','scholar','phd'];
  const BADGE_MAP={
    beginner:{level:'Beginner',badgeType:'bronze',title:'Bronze Beginner Completion'},
    intermediate:{level:'Intermediate',badgeType:'silver',title:'Silver Intermediate Completion'},
    high:{level:'High',badgeType:'gold',title:'Gold High Completion'},
    scholar:{level:'Scholar',badgeType:'diamond',title:'Diamond Scholar Completion'},
    phd:{level:'PHD',badgeType:'rainbow',title:'Rainbow PHD Completion'}
  };

  function asObject(value){
    return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  }

  function safeArray(value){
    return Array.isArray(value)?value:[];
  }

  function clampNumber(value,min,max,fallback=0){
    const parsed=Math.round(Number(value));
    if(!Number.isFinite(parsed))return fallback;
    return Math.max(min,Math.min(max,parsed));
  }

  function normalizeDate(value){
    const text=String(value||'').trim();
    if(!text)return'';
    return Number.isNaN(new Date(text).getTime())?'':text;
  }

  function normalizeText(value,fallback=''){
    const text=String(value??'').trim();
    return text||fallback;
  }

  function normalizeQuizAssessment(value){
    const source=asObject(value);
    const level=QUIZ_LEVELS.includes(source.level)?source.level:'';
    const recommendedCourseDifficulty=COURSE_LEVELS.includes(source.recommendedCourseDifficulty)
      ?source.recommendedCourseDifficulty
      :(level==='Scholar'?'Advanced':COURSE_LEVELS.includes(level)?level:'');
    const percent=clampNumber(source.percent,0,100,0);
    const score=Math.max(0,Math.round(Number(source.score)||0));
    const total=Math.max(0,Math.round(Number(source.total)||0));
    const createdAt=normalizeDate(source.createdAt);
    const skippedAt=normalizeDate(source.skippedAt);
    if(!level&&!skippedAt)return null;
    return{
      level,
      recommendedCourseDifficulty,
      percent,
      score,
      total,
      createdAt,
      skippedAt
    };
  }

  function isMonthlyHistoryEntry(item){
    const mode=String(item?.mode||'').toLowerCase();
    const type=String(item?.type||'').toLowerCase();
    return mode==='monthly'||type.includes('month');
  }

  function normalizeQuizHistoryItem(value){
    const source=asObject(value);
    if(isMonthlyHistoryEntry(source))return null;
    const mode=QUIZ_MODES.includes(source.mode)?source.mode:'';
    return{
      createdAt:normalizeDate(source.createdAt)||new Date().toISOString(),
      score:Math.max(0,Math.round(Number(source.score)||0)),
      total:Math.max(0,Math.round(Number(source.total)||0)),
      percent:clampNumber(source.percent,0,100,0),
      category:normalizeText(source.category,'All categories'),
      difficulty:normalizeText(source.difficulty,'Mixed difficulty'),
      type:normalizeText(source.type,'Quiz'),
      mode,
      breakdown:asObject(source.breakdown),
      evaluatedLevel:QUIZ_LEVELS.includes(source.evaluatedLevel)?source.evaluatedLevel:'',
      generator:normalizeText(source.generator),
      passed:source.passed===undefined?clampNumber(source.percent,0,100,0)>=PASS_PERCENTAGE:Boolean(source.passed),
      sessionId:normalizeText(source.sessionId),
      completedBy:normalizeText(source.completedBy),
      journeyStage:QUIZ_STAGES.includes(source.journeyStage)?source.journeyStage:''
    };
  }

  function normalizeQuizHistory(history){
    return safeArray(history)
      .map(normalizeQuizHistoryItem)
      .filter(Boolean)
      .slice(0,24);
  }

  function emptyBadge(key){
    const config=BADGE_MAP[key];
    return{
      id:`badge-${key}`,
      level:config.level,
      badgeType:config.badgeType,
      title:config.title,
      earnedAt:'',
      unlocked:false
    };
  }

  function normalizeAchievements(value){
    const sourceItems=Array.isArray(value)?value:Object.values(asObject(value));
    const normalizedById={};
    sourceItems.forEach(item=>{
      const source=asObject(item);
      const badgeKey=BADGE_ORDER.find(key=>BADGE_MAP[key].badgeType===source.badgeType)||BADGE_ORDER.find(key=>BADGE_MAP[key].level.toLowerCase()===String(source.level||'').toLowerCase());
      if(!badgeKey)return;
      normalizedById[badgeKey]={
        ...emptyBadge(badgeKey),
        earnedAt:normalizeDate(source.earnedAt),
        unlocked:Boolean(source.unlocked||source.earnedAt)
      };
    });
    return BADGE_ORDER.map(key=>normalizedById[key]||emptyBadge(key));
  }

  function awardBadge(records,levelKey,earnedAt){
    if(!BADGE_MAP[levelKey])return records;
    return normalizeAchievements(records).map(item=>{
      if(item.id!==`badge-${levelKey}`)return item;
      if(item.unlocked)return item;
      return{
        ...item,
        unlocked:true,
        earnedAt:normalizeDate(earnedAt)||new Date().toISOString()
      };
    });
  }

  function deriveBadgeLevel({courseDifficulty='',learnerLevel='',percent=0}){
    const course=normalizeText(courseDifficulty);
    const learner=normalizeText(learnerLevel);
    const score=clampNumber(percent,0,100,0);
    if(/^p(?:hd|h\.?d\.?)$/i.test(course))return'phd';
    if(/^scholar$/i.test(course))return'scholar';
    if(learner==='Scholar'&&score>=95)return'phd';
    if(learner==='Scholar')return'scholar';
    if(course==='Advanced'||course==='High')return'high';
    if(course==='Intermediate')return'intermediate';
    return'beginner';
  }

  function durationMinutesForMode(mode){
    if(mode==='evaluation')return EVALUATING_DURATION_MIN;
    if(mode==='final')return FINAL_DURATION_MIN;
    return PROGRESSIVE_DURATION_MIN;
  }

  function normalizeQuestion(question){
    const source=asObject(question);
    const options=safeArray(source.opts).slice(0,4).map(option=>normalizeText(option)).filter(Boolean);
    if(!normalizeText(source.q)||options.length!==4)return null;
    return{
      q:normalizeText(source.q),
      opts:options,
      ans:clampNumber(source.ans,0,3,0),
      exp:normalizeText(source.exp),
      cat:normalizeText(source.cat,'Functional Groups'),
      diff:QUIZ_LEVELS.includes(source.diff)?source.diff:'Beginner'
    };
  }

  function normalizeResponse(response){
    const source=asObject(response);
    const selectedIndex=source.selectedIndex===null||source.selectedIndex===undefined?'':String(source.selectedIndex).trim();
    const nextIndex=selectedIndex===''?null:clampNumber(selectedIndex,0,3,0);
    return{
      selectedIndex:nextIndex,
      isCorrect:typeof source.isCorrect==='boolean'?source.isCorrect:null,
      answeredAt:normalizeDate(source.answeredAt)
    };
  }

  function normalizeActiveSession(value){
    const source=asObject(value);
    const mode=QUIZ_MODES.includes(source.mode)?source.mode:'';
    const questions=safeArray(source.questions).map(normalizeQuestion).filter(Boolean);
    if(!mode||!questions.length)return null;
    const responses=safeArray(source.responses).slice(0,questions.length).map(normalizeResponse);
    while(responses.length<questions.length){
      responses.push({selectedIndex:null,isCorrect:null,answeredAt:''});
    }
    return{
      id:normalizeText(source.id,`quiz-session-${Date.now()}`),
      stage:QUIZ_STAGES.includes(source.stage)?source.stage:modeToStage(mode),
      mode,
      status:['active','submitted','expired'].includes(source.status)?source.status:'active',
      type:normalizeText(source.type,'Quiz'),
      category:normalizeText(source.category,'All categories'),
      difficulty:normalizeText(source.difficulty,'Mixed difficulty'),
      generator:normalizeText(source.generator),
      strategy:normalizeText(source.strategy),
      challengeStartsAt:Math.max(0,Math.round(Number(source.challengeStartsAt)||0)),
      blockLabels:safeArray(source.blockLabels).map(block=>({
        start:Math.max(1,Math.round(Number(block?.start)||1)),
        end:Math.max(1,Math.round(Number(block?.end)||1)),
        label:normalizeText(block?.label)
      })).filter(block=>block.label),
      questions,
      responses,
      currentIndex:clampNumber(source.currentIndex,0,Math.max(questions.length-1,0),0),
      startedAt:normalizeDate(source.startedAt)||new Date().toISOString(),
      expiresAt:normalizeDate(source.expiresAt),
      durationMin:Math.max(1,Math.round(Number(source.durationMin)||durationMinutesForMode(mode))),
      timeUpMessageShown:Boolean(source.timeUpMessageShown)
    };
  }

  function createEmptyJourney(){
    return{
      version:JOURNEY_VERSION,
      stage:'EVALUATION',
      evaluation:{
        status:'not_started',
        percent:0,
        passed:false,
        learnerLevel:'',
        recommendedCourseDifficulty:'',
        completedAt:'',
        skippedAt:''
      },
      progressive:{
        requiredCount:REQUIRED_PROGRESSIVE_QUIZZES,
        completedCount:0,
        passedCount:0,
        lastCompletedAt:'',
        lastPassedAt:''
      },
      final:{
        status:'locked',
        percent:0,
        passed:false,
        completedAt:'',
        courseDifficulty:'',
        learnerLevel:''
      },
      activeSession:null,
      resetAt:'',
      legacyMigratedAt:''
    };
  }

  function modeToStage(mode){
    if(mode==='evaluation')return'EVALUATION';
    if(mode==='final')return'FINAL';
    return'PROGRESSIVE';
  }

  function hasAnyJourneyProgress(journey){
    const source=journey||createEmptyJourney();
    return Boolean(
      source.activeSession||
      source.evaluation.status!=='not_started'||
      source.progressive.completedCount||
      source.final.completedAt||
      source.final.passed
    );
  }

  function deriveStage(journey){
    if(journey.final.passed)return'COMPLETED';
    if(journey.progressive.passedCount>=REQUIRED_PROGRESSIVE_QUIZZES)return'FINAL';
    if(journey.evaluation.status==='completed'||journey.evaluation.status==='legacy-exempt'||journey.progressive.completedCount>0)return'PROGRESSIVE';
    return'EVALUATION';
  }

  function normalizeQuizJourney(value,{quizAssessment=null,quizHistory=[]}={}){
    const defaults=createEmptyJourney();
    const source=asObject(value);
    const evaluationSource=asObject(source.evaluation);
    const progressiveSource=asObject(source.progressive);
    const finalSource=asObject(source.final);
    const activeSession=normalizeActiveSession(source.activeSession);
    let journey={
      ...defaults,
      version:JOURNEY_VERSION,
      evaluation:{
        status:['not_started','completed','legacy-exempt'].includes(evaluationSource.status)?evaluationSource.status:'not_started',
        percent:clampNumber(evaluationSource.percent,0,100,0),
        passed:Boolean(evaluationSource.passed),
        learnerLevel:QUIZ_LEVELS.includes(evaluationSource.learnerLevel)?evaluationSource.learnerLevel:'',
        recommendedCourseDifficulty:COURSE_LEVELS.includes(evaluationSource.recommendedCourseDifficulty)?evaluationSource.recommendedCourseDifficulty:'',
        completedAt:normalizeDate(evaluationSource.completedAt),
        skippedAt:normalizeDate(evaluationSource.skippedAt)
      },
      progressive:{
        requiredCount:REQUIRED_PROGRESSIVE_QUIZZES,
        completedCount:Math.max(0,Math.round(Number(progressiveSource.completedCount)||0)),
        passedCount:Math.max(0,Math.round(Number(progressiveSource.passedCount)||0)),
        lastCompletedAt:normalizeDate(progressiveSource.lastCompletedAt),
        lastPassedAt:normalizeDate(progressiveSource.lastPassedAt)
      },
      final:{
        status:['locked','unlocked','completed'].includes(finalSource.status)?finalSource.status:'locked',
        percent:clampNumber(finalSource.percent,0,100,0),
        passed:Boolean(finalSource.passed),
        completedAt:normalizeDate(finalSource.completedAt),
        courseDifficulty:normalizeText(finalSource.courseDifficulty),
        learnerLevel:QUIZ_LEVELS.includes(finalSource.learnerLevel)?finalSource.learnerLevel:''
      },
      activeSession,
      resetAt:normalizeDate(source.resetAt),
      legacyMigratedAt:normalizeDate(source.legacyMigratedAt)
    };

    if(!hasAnyJourneyProgress(journey)){
      const evaluationRecord=normalizeQuizAssessment(quizAssessment);
      const evaluationHistory=quizHistory.find(item=>item.mode==='evaluation');
      const progressiveHistory=quizHistory.filter(item=>item.mode==='progressive');
      const passedProgressive=progressiveHistory.filter(item=>item.passed);
      const passedFinal=quizHistory.filter(item=>item.mode==='final'&&item.passed).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]||null;
      const latestProgressive=progressiveHistory.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0]||null;

      if(evaluationRecord?.level){
        journey.evaluation={
          status:'completed',
          percent:evaluationRecord.percent,
          passed:evaluationRecord.percent>=PASS_PERCENTAGE,
          learnerLevel:evaluationRecord.level,
          recommendedCourseDifficulty:evaluationRecord.recommendedCourseDifficulty,
          completedAt:evaluationRecord.createdAt,
          skippedAt:''
        };
      }else if(evaluationRecord?.skippedAt){
        journey.evaluation={
          status:'legacy-exempt',
          percent:0,
          passed:false,
          learnerLevel:'',
          recommendedCourseDifficulty:'',
          completedAt:'',
          skippedAt:evaluationRecord.skippedAt
        };
      }else if(evaluationHistory){
        journey.evaluation={
          status:'completed',
          percent:evaluationHistory.percent,
          passed:evaluationHistory.percent>=PASS_PERCENTAGE,
          learnerLevel:QUIZ_LEVELS.includes(evaluationHistory.evaluatedLevel)?evaluationHistory.evaluatedLevel:'',
          recommendedCourseDifficulty:evaluationHistory.difficulty==='Scholar'?'Advanced':(COURSE_LEVELS.includes(evaluationHistory.difficulty)?evaluationHistory.difficulty:''),
          completedAt:evaluationHistory.createdAt,
          skippedAt:''
        };
      }

      journey.progressive.completedCount=progressiveHistory.length;
      journey.progressive.passedCount=passedProgressive.length;
      journey.progressive.lastCompletedAt=latestProgressive?.createdAt||'';
      journey.progressive.lastPassedAt=passedProgressive[passedProgressive.length-1]?.createdAt||'';

      if(passedFinal){
        journey.final={
          status:'completed',
          percent:passedFinal.percent,
          passed:true,
          completedAt:passedFinal.createdAt,
          courseDifficulty:passedFinal.difficulty,
          learnerLevel:passedFinal.evaluatedLevel||journey.evaluation.learnerLevel
        };
      }else if(quizHistory.some(item=>item.mode==='final')){
        const latestFinal=quizHistory.filter(item=>item.mode==='final').sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];
        journey.final={
          status:'unlocked',
          percent:latestFinal?.percent||0,
          passed:false,
          completedAt:'',
          courseDifficulty:latestFinal?.difficulty||journey.evaluation.recommendedCourseDifficulty,
          learnerLevel:latestFinal?.evaluatedLevel||journey.evaluation.learnerLevel
        };
      }

      if(journey.evaluation.status==='legacy-exempt'||progressiveHistory.length||quizHistory.some(item=>item.mode==='final')){
        journey.legacyMigratedAt=new Date().toISOString();
      }
    }

    journey.progressive.requiredCount=REQUIRED_PROGRESSIVE_QUIZZES;
    if(journey.progressive.completedCount&&journey.progressive.passedCount>journey.progressive.completedCount){
      journey.progressive.passedCount=journey.progressive.completedCount;
    }
    journey.stage=deriveStage(journey);
    if(journey.stage==='FINAL'&&!journey.final.passed)journey.final.status='unlocked';
    if(journey.stage==='COMPLETED')journey.final.status='completed';
    return journey;
  }

  function hydrateAchievements(achievements,{quizHistory=[],quizJourney=null}={}){
    let next=normalizeAchievements(achievements);
    quizHistory
      .filter(item=>item.mode==='final'&&item.passed)
      .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))
      .forEach(item=>{
        next=awardBadge(next,deriveBadgeLevel({
          courseDifficulty:item.difficulty,
          learnerLevel:item.evaluatedLevel,
          percent:item.percent
        }),item.createdAt);
      });
    if(quizJourney?.final?.passed){
      next=awardBadge(next,deriveBadgeLevel({
        courseDifficulty:quizJourney.final.courseDifficulty,
        learnerLevel:quizJourney.final.learnerLevel||quizJourney.evaluation.learnerLevel,
        percent:quizJourney.final.percent
      }),quizJourney.final.completedAt);
    }
    return next;
  }

  function normalizeMainState(value){
    const source=asObject(value);
    const quizHistory=normalizeQuizHistory(source.quizHistory);
    const quizAssessment=normalizeQuizAssessment(source.quizAssessment);
    const quizJourney=normalizeQuizJourney(source.quizJourney,{quizAssessment,quizHistory});
    const achievements=hydrateAchievements(source.achievements,{quizHistory,quizJourney});
    return{
      ...source,
      topicStatus:asObject(source.topicStatus),
      savedReactions:safeArray(source.savedReactions),
      quizHistory,
      studyPlans:safeArray(source.studyPlans),
      quizAssessment,
      quizJourney,
      achievements
    };
  }

  function isPassedPercent(percent){
    return clampNumber(percent,0,100,0)>=PASS_PERCENTAGE;
  }

  function getRemainingMs(session,now=Date.now()){
    const active=normalizeActiveSession(session);
    if(!active)return 0;
    const expiresAt=new Date(active.expiresAt||active.startedAt).getTime();
    return Math.max(0,expiresAt-now);
  }

  function isSessionActive(session,now=Date.now()){
    const active=normalizeActiveSession(session);
    return Boolean(active&&active.status==='active'&&getRemainingMs(active,now)>0);
  }

  function isChatBlocked(mainState,now=Date.now()){
    const state=normalizeMainState(mainState);
    return isSessionActive(state.quizJourney.activeSession,now);
  }

  function canGenerateNewPlan(mainState){
    const state=normalizeMainState(mainState);
    if(isSessionActive(state.quizJourney.activeSession))return false;
    if(!safeArray(state.studyPlans).length)return true;
    return state.quizJourney.stage==='COMPLETED';
  }

  function formatRemainingTime(ms){
    const totalSeconds=Math.max(0,Math.ceil(ms/1000));
    const hours=Math.floor(totalSeconds/3600);
    const minutes=Math.floor((totalSeconds%3600)/60);
    const seconds=totalSeconds%60;
    if(hours>0)return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    return`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  window.OrganoQuizJourney={
    JOURNEY_VERSION,
    EVALUATING_DURATION_MIN,
    PROGRESSIVE_DURATION_MIN,
    FINAL_DURATION_MIN,
    REQUIRED_PROGRESSIVE_QUIZZES,
    PASS_PERCENTAGE,
    LOW_TIME_WARNING_MS,
    QUIZ_STAGES,
    QUIZ_MODES,
    QUIZ_LEVELS,
    COURSE_LEVELS,
    BADGE_MAP,
    normalizeQuizAssessment,
    normalizeQuizHistory,
    normalizeQuizJourney,
    normalizeMainState,
    normalizeAchievements,
    normalizeActiveSession,
    createEmptyJourney,
    hasAnyJourneyProgress,
    durationMinutesForMode,
    isPassedPercent,
    isSessionActive,
    isChatBlocked,
    canGenerateNewPlan,
    getRemainingMs,
    formatRemainingTime,
    deriveBadgeLevel,
    awardBadge
  };
})();
