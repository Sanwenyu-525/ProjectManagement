/**
 * Browser automation script injected into iframes.
 *
 * Listens for `devhub-browser-command` postMessage events, executes the
 * requested action, and posts back `devhub-browser-result`.
 *
 * Supported actions:
 *   navigate  { url }                      → window.location.href = url
 *   click     { selector }                 → querySelector + click
 *   fill      { selector, value, delay? }  → set value + dispatch input/change
 *   wait      { selector, timeout? }       → poll until element exists
 *   scroll    { x, y }                     → window.scrollTo
 *   screenshot { }                         → DOM structure analysis (text)
 *   pixel-screenshot { }                   → request parent to take OS-level screenshot (V5)
 *   verify    { check, selector?, value? } → verify DOM condition (V5)
 */
export const AUTOMATION_SCRIPT = `
(function(){
  if(window.__dh_automation_injected) return;
  window.__dh_automation_injected=true;

  var AUTH_TOKEN='__AUTH_TOKEN__';
  function send(r){window.parent.postMessage(Object.assign({_auth:AUTH_TOKEN,type:'devhub-browser-result'},r),'*')}

  // Unicode-safe base64 decode
  function decodeB64(s){return decodeURIComponent(escape(atob(s)))}

  // Scenario continuation after page navigation
  var __dh_resume=localStorage.getItem('__dh_scenario_resume');
  if(__dh_resume){
    localStorage.removeItem('__dh_scenario_resume');
    try{
      var __state=JSON.parse(__dh_resume);
      function __dh_cont(){
        if(document.readyState==='complete'||document.readyState==='interactive'){
          runScenario(__state.label,__state.steps,__state.completedSteps);
        }else{setTimeout(__dh_cont,100)}
      }
      setTimeout(__dh_cont,200);
    }catch(e){}
  }

  function analyzeDom(){
    var d=document;
    var title=d.title||'';
    var url=location.href;
    var headings=[];
    d.querySelectorAll('h1,h2,h3').forEach(function(h){headings.push(h.tagName+': '+h.textContent.trim().substring(0,80))});
    var links=[];
    d.querySelectorAll('a[href]').forEach(function(a){links.push(a.textContent.trim().substring(0,40)+' → '+a.href)}).count;
    var forms=[];
    d.querySelectorAll('form').forEach(function(f){forms.push({action:f.action,method:f.method,fields:f.querySelectorAll('input,select,textarea').length})});
    var images=[];
    d.querySelectorAll('img').forEach(function(img){images.push({src:img.src.substring(0,100),alt:img.alt||'',w:img.width,h:img.height})});
    var buttons=[];
    d.querySelectorAll('button,input[type=submit]').forEach(function(b){buttons.push((b.textContent||b.value||'').trim().substring(0,40))});
    var inputs=[];
    d.querySelectorAll('input,textarea,select').forEach(function(i){inputs.push({type:i.type||i.tagName.toLowerCase(),name:i.name||'',placeholder:i.placeholder||''})});
    var bodyLen=(d.body||d.documentElement).innerHTML.length;
    return {
      title:title,url:url,
      headings:headings.slice(0,20),
      links:links.slice(0,30),
      forms:forms,
      images:images.slice(0,15),
      buttons:buttons.slice(0,20),
      inputs:inputs.slice(0,20),
      bodySize:bodyLen,
      textPreview:(d.body?d.body.textContent:'').substring(0,500).replace(/\\s+/g,' ').trim()
    };
  }

  function waitElement(selector,timeout){
    timeout=timeout||5000;
    return new Promise(function(resolve){
      if(document.querySelector(selector)){resolve({ok:true,found:true});return}
      var start=Date.now();
      var timer=setInterval(function(){
        if(document.querySelector(selector)){clearInterval(timer);resolve({ok:true,found:true})}
        else if(Date.now()-start>timeout){clearInterval(timer);resolve({ok:false,error:'Timeout waiting for '+selector})}
      },200);
    });
  }

  // V5: verify DOM conditions
  function verifyCondition(check, selector, expectedValue){
    switch(check){
      case'exists':{
        var el=document.querySelector(selector);
        return{pass:!!el,detail:el?'Element found':'Element not found: '+selector}}
      case'not-exists':{
        var el=document.querySelector(selector);
        return{pass:!el,detail:el?'Element still exists: '+selector:'Element correctly absent'}}
      case'text':{
        var el=document.querySelector(selector);
        if(!el)return{pass:false,detail:'Element not found: '+selector};
        var actual=el.textContent||'';
        var pass=actual.includes(expectedValue);
        return{pass:pass,detail:pass?'Text matches':'Expected "'+expectedValue+'" in "'+actual.substring(0,100)+'"'}}
      case'value':{
        var el=document.querySelector(selector);
        if(!el)return{pass:false,detail:'Element not found: '+selector};
        var actual=el.value||'';
        var pass=actual===expectedValue;
        return{pass:pass,detail:pass?'Value matches':'Expected "'+expectedValue+'" got "'+actual+'"'}}
      case'visible':{
        var el=document.querySelector(selector);
        if(!el)return{pass:false,detail:'Element not found: '+selector};
        var style=window.getComputedStyle(el);
        var pass=style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
        return{pass:pass,detail:pass?'Element visible':'Element hidden (display:'+style.display+', visibility:'+style.visibility+')'}}
      case'count':{
        var els=document.querySelectorAll(selector);
        var expected=parseInt(expectedValue,10);
        var pass=els.length===expected;
        return{pass:pass,detail:pass?'Count matches':'Expected '+expected+' found '+els.length}}
      case'url':{
        var pass=location.href.includes(expectedValue);
        return{pass:pass,detail:pass?'URL matches':'Expected "'+expectedValue+'" in "'+location.href+'"'}}
      case'title':{
        var pass=document.title===expectedValue;
        return{pass:pass,detail:pass?'Title matches':'Expected "'+expectedValue+'" got "'+document.title+'"'}}
      default:
        return{pass:false,detail:'Unknown check: '+check};
    }
  }

  // V5: describe a step in human-readable form
  function describeStep(step){
    switch(step.action){
      case'navigate':return 'navigate → '+step.url;
      case'click':return 'click '+step.selector;
      case'fill':return 'fill '+step.selector+' → '+step.value;
      case'wait':return 'wait '+step.selector+(step.timeout?' ['+step.timeout+'ms]':'');
      case'scroll':return 'scroll ('+(step.x||0)+','+(step.y||0)+')';
      case'screenshot':return 'screenshot';
      case'pixel-screenshot':return 'pixel-screenshot';
      case'verify':return 'verify '+step.check+(step.selector?' '+step.selector:'')+(step.value?' '+step.value:'');
      default:return step.action;
    }
  }

  // V5: execute a single step, returns {pass,detail}
  function executeStep(step){
    switch(step.action){
      case'click':{
        var el=document.querySelector(step.selector);
        if(!el)return{pass:false,detail:'Element not found: '+step.selector};
        el.scrollIntoView({behavior:'smooth',block:'center'});
        el.click();
        return{pass:true,detail:'Clicked '+(el.textContent||'').substring(0,30)};}
      case'fill':{
        var el=document.querySelector(step.selector);
        if(!el)return{pass:false,detail:'Element not found: '+step.selector};
        el.focus();
        var ns=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')&&Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
        if(ns&&el.tagName==='INPUT'){ns.call(el,step.value)}
        else{el.value=step.value}
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        return{pass:true,detail:'Filled '+step.value};}
      case'scroll':
        window.scrollTo(step.x||0,step.y||0);
        return{pass:true,detail:'Scrolled to ('+window.scrollX+','+window.scrollY+')'};
      case'screenshot':{
        var a=analyzeDom();
        return{pass:true,detail:'DOM analysis: '+a.headings.length+' headings, '+a.buttons.length+' buttons',analysis:a};}
      case'verify':
        return verifyCondition(step.check,step.selector,step.value);
      default:
        return{pass:false,detail:'Unknown action: '+step.action};
    }
  }

  // V5: run a batch scenario
  async function runScenario(label,steps,completedSteps){
    completedSteps=completedSteps||[];
    var startTime=Date.now();
    var results=[];
    for(var i=0;i<steps.length;i++){
      var step=steps[i];
      var stepStart=Date.now();
      var stepResult;
      try{
        if(step.action==='navigate'){
          if(i<steps.length-1){
            localStorage.setItem('__dh_scenario_resume',JSON.stringify({
              label:label,steps:steps.slice(i+1),completedSteps:completedSteps.concat(results)
            }));
            window.location.href=step.url;
            return;
          }
          window.location.href=step.url;
          stepResult={pass:true,detail:'Navigated to '+step.url};
        }else if(step.action==='wait'){
          var wr=await waitElement(step.selector,step.timeout||5000);
          stepResult={pass:wr.ok||wr.found,detail:wr.error||'Found'};
        }else{
          stepResult=await executeStep(step);
        }
      }catch(err){
        stepResult={pass:false,detail:err.message};
      }
      stepResult.duration=Date.now()-stepStart;
      stepResult.index=i;
      stepResult.action=step.action;
      stepResult.label=describeStep(step);
      results.push(stepResult);
    }
    var allResults=completedSteps.concat(results);
    var totalDuration=Date.now()-startTime;
    var passed=allResults.filter(function(r){return r.pass}).length;
    var report={
      label:label,steps:allResults,
      passed:passed,failed:allResults.length-passed,total:allResults.length,
      duration:totalDuration
    };
    send({id:Date.now(),ok:true,scenarioResult:report});
  }

  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='devhub-browser-command')return;
    var cmd=e.data;
    try{
      switch(cmd.action){
        case'navigate':
          window.location.href=cmd.url;
          send({id:cmd.id,ok:true});
          break;
        case'click':{
          var el=document.querySelector(cmd.selector);
          if(!el){send({id:cmd.id,ok:false,error:'Element not found: '+cmd.selector});break}
          el.scrollIntoView({behavior:'smooth',block:'center'});
          el.click();
          send({id:cmd.id,ok:true,tag:el.tagName,text:(el.textContent||'').substring(0,50)});
          break}
        case'fill':{
          var el=document.querySelector(cmd.selector);
          if(!el){send({id:cmd.id,ok:false,error:'Element not found: '+cmd.selector});break}
          el.focus();
          var nativeSet=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')&&Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
          if(nativeSet&&el.tagName==='INPUT'){nativeSet.call(el,cmd.value)}
          else{el.value=cmd.value}
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
          if(cmd.delay){setTimeout(function(){send({id:cmd.id,ok:true,value:cmd.value})},cmd.delay)}
          else{send({id:cmd.id,ok:true,value:cmd.value})}
          break}
        case'wait':
          waitElement(cmd.selector,cmd.timeout).then(function(r){send(Object.assign({id:cmd.id},r))});
          break;
        case'scroll':
          window.scrollTo(cmd.x||0,cmd.y||0);
          send({id:cmd.id,ok:true,scrollX:window.scrollX,scrollY:window.scrollY});
          break;
        case'screenshot':{
          var analysis=analyzeDom();
          send({id:cmd.id,ok:true,analysis:analysis});
          break}
        case'pixel-screenshot':{
          // Request parent to take OS-level screenshot via Tauri API
          window.parent.postMessage({_auth:AUTH_TOKEN,type:'devhub-screenshot-request',id:cmd.id},'*');
          break}
        case'verify':{
          var result=verifyCondition(cmd.check,cmd.selector,cmd.value);
          send({id:cmd.id,ok:true,verifyResult:result});
          break}
        case'scenario':{
          try{
            var steps=JSON.parse(decodeB64(cmd.steps));
            runScenario(cmd.label||'未命名测试',steps,[]);
          }catch(err){
            send({id:cmd.id,ok:false,error:'Scenario parse error: '+err.message});
          }
          break}
        default:
          send({id:cmd.id,ok:false,error:'Unknown action: '+cmd.action});
      }
    }catch(err){
      send({id:cmd.id,ok:false,error:err.message});
    }
  });
})();
`;
