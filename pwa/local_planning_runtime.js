(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrhLocalPlanningRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var SCHEMA = 'PRH_LOCAL_PLANNING_RUNTIME_V1';
  var VERSION = '1.0.0';
  var SOURCE_SCHEMA = 'PRH_LOCAL_PLANNING_SOURCE_V1';
  var RESPONSE_SCHEMA = 'PRH_LOCAL_PLANNING_SYNC_RESPONSE_V1';
  var QUERY_SCHEMA = 'PRH_LOCAL_PLANNING_QUERY_V1';
  var RESULT_SCHEMA = 'PRH_LOCAL_PLANNING_RESULT_V1';
  var DB_NAME = 'prihrash-local-planning-v1';
  var STORE = 'snapshots';
  var ACTIVE_KEY = 'active';
  var ROUTES = Object.freeze(['budget','obligations','liquidity']);
  var HEX64 = /^[0-9a-f]{64}$/;

  function fail(code) { var error=new Error(code); error.code=code; return error; }
  function safeReason(error,fallback){var text=String(error&&(error.code||error.message)||fallback||'LOCAL_PLANNING_FAILED');var colon=text.indexOf(':');if(colon>=0)text=text.slice(0,colon);return /^[A-Z][A-Z0-9_]{2,95}$/.test(text)?text:(fallback||'LOCAL_PLANNING_FAILED');}
  function hex(value,code){var text=String(value||'').toLowerCase();if(!HEX64.test(text))throw fail(code);return text;}
  function isoDay(value){var text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw fail('LOCAL_PLANNING_AS_OF_INVALID');var d=new Date(text+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==text)throw fail('LOCAL_PLANNING_AS_OF_INVALID');return text;}
  function today(now){var d=now instanceof Date?new Date(now.getTime()):new Date();return d.toISOString().slice(0,10);}
  function addDays(day,count){var d=new Date(isoDay(day)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}

  function validateSource(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||input.schema!==SOURCE_SCHEMA||input.version!==VERSION)throw fail('LOCAL_PLANNING_SOURCE_INVALID');
    var canonical=hex(input.canonical_revision,'LOCAL_PLANNING_CANONICAL_REVISION_INVALID');
    var planning=hex(input.planning_revision,'LOCAL_PLANNING_REVISION_INVALID');
    var currency=String(input.currency||'').toUpperCase();if(!/^[A-Z]{3}$/.test(currency))throw fail('LOCAL_PLANNING_CURRENCY_INVALID');
    ['budget','recurring','commitments','liquidity'].forEach(function(key){if(!input[key]||typeof input[key]!=='object'||Array.isArray(input[key]))throw fail('LOCAL_PLANNING_SECTION_INVALID');});
    if(!Array.isArray(input.budget.plans)||!Array.isArray(input.recurring.plans)||!Array.isArray(input.commitments.items)||!Array.isArray(input.liquidity.observations))throw fail('LOCAL_PLANNING_COLLECTION_INVALID');
    return Object.freeze(input);
  }

  function parseWireEnvelope(wire){
    if(typeof wire!=='string'||!wire)throw fail('LOCAL_PLANNING_WIRE_RESPONSE_INVALID');
    var parsed;try{parsed=JSON.parse(wire);}catch(error){throw fail('LOCAL_PLANNING_WIRE_RESPONSE_INVALID');}
    return validateRemoteEnvelope(parsed);
  }

  function validateRemoteEnvelope(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||input.schema!==RESPONSE_SCHEMA||input.version!==VERSION)throw fail('LOCAL_PLANNING_RESPONSE_INVALID');
    hex(input.canonical_revision,'LOCAL_PLANNING_CANONICAL_REVISION_INVALID');hex(input.planning_revision,'LOCAL_PLANNING_REVISION_INVALID');
    if(input.financial_write_authorized!==false||input.canonical_mutation_performed!==false||input.auto_transaction_creation!==false||input.cash_flow_balance_proxy_used!==false)throw fail('LOCAL_PLANNING_AUTHORITY_VIOLATION');
    if(input.state==='NOOP'){if(Object.prototype.hasOwnProperty.call(input,'source'))throw fail('LOCAL_PLANNING_NOOP_PAYLOAD_INVALID');return Object.freeze(input);}
    if(input.state!=='FULL_SNAPSHOT')throw fail('LOCAL_PLANNING_RESPONSE_STATE_INVALID');
    var source=validateSource(input.source);
    if(source.canonical_revision!==input.canonical_revision||source.planning_revision!==input.planning_revision)throw fail('LOCAL_PLANNING_RESPONSE_BINDING_INVALID');
    return Object.freeze(input);
  }

  function createGoogleScriptTransport(options){
    options=options||{};var runner=options.googleScriptRun||(root&&root.google&&root.google.script&&root.google.script.run);
    if(!runner||typeof runner.withSuccessHandler!=='function')throw fail('LOCAL_PLANNING_TRANSPORT_UNAVAILABLE');
    return Object.freeze({fetchSnapshot:function(request){return new Promise(function(resolve,reject){runner.withSuccessHandler(function(wire){try{resolve(parseWireEnvelope(wire));}catch(error){reject(error);}}).withFailureHandler(function(error){reject(fail(safeReason(error,'LOCAL_PLANNING_TRANSPORT_FAILED')));}).prhPlanningLocalFirstBootstrapWire(request||{});});}});
  }

  function idbRequest(request){return new Promise(function(resolve,reject){request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error||fail('LOCAL_PLANNING_IDB_REQUEST_FAILED'));};});}
  function idbTx(tx){return new Promise(function(resolve,reject){tx.oncomplete=function(){resolve();};tx.onerror=function(){reject(tx.error||fail('LOCAL_PLANNING_IDB_TX_FAILED'));};tx.onabort=function(){reject(tx.error||fail('LOCAL_PLANNING_IDB_TX_ABORTED'));};});}

  function createStore(options){
    options=options||{};var indexedDB=options.indexedDB||(root&&root.indexedDB);var dbName=String(options.name||DB_NAME);var dbPromise=null;
    if(!indexedDB)throw fail('LOCAL_PLANNING_IDB_UNAVAILABLE');
    function open(){if(dbPromise)return dbPromise;dbPromise=new Promise(function(resolve,reject){var req=indexedDB.open(dbName,1);req.onupgradeneeded=function(){var db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){dbPromise=null;reject(req.error||fail('LOCAL_PLANNING_IDB_OPEN_FAILED'));};req.onblocked=function(){dbPromise=null;reject(fail('LOCAL_PLANNING_IDB_BLOCKED'));};});return dbPromise;}
    async function getActive(){var db=await open();var tx=db.transaction([STORE],'readonly');var done=idbTx(tx);var record=await idbRequest(tx.objectStore(STORE).get(ACTIVE_KEY));await done;if(!record||record.key!==ACTIVE_KEY||!record.source)return null;try{return validateSource(record.source);}catch(error){return null;}}
    async function putActive(source){source=validateSource(source);var db=await open();var tx=db.transaction([STORE],'readwrite');var done=idbTx(tx);tx.objectStore(STORE).put({key:ACTIVE_KEY,schema:SCHEMA,version:VERSION,planning_revision:source.planning_revision,canonical_revision:source.canonical_revision,source:source});await done;return source;}
    return Object.freeze({getActive:getActive,putActive:putActive});
  }

  function createRuntime(options){
    options=options||{};var store=options.store;var transport=options.transport||null;var finance=options.financeRuntime;var onState=typeof options.onState==='function'?options.onState:function(){};var now=typeof options.now==='function'?options.now:function(){return new Date();};
    if(!store||typeof store.getActive!=='function'||typeof store.putActive!=='function')throw fail('LOCAL_PLANNING_STORE_INVALID');
    if(!finance||typeof finance.getState!=='function'||typeof finance.runPlanningQuery!=='function')throw fail('LOCAL_PLANNING_FINANCE_RUNTIME_INVALID');
    var state={route:'budget',source:null,sync_status:'IDLE',degraded_reason:null,last_view:null,render_epoch:0};
    function financeRevision(){var s=finance.getState();return s&&HEX64.test(String(s.revision||''))?String(s.revision):null;}
    function publicState(){return Object.freeze({schema:SCHEMA,version:VERSION,route:state.route,planning_revision:state.source?state.source.planning_revision:null,planning_revision_prefix:state.source?state.source.planning_revision.slice(0,12):null,canonical_revision:state.source?state.source.canonical_revision:null,finance_revision:financeRevision(),sync_status:state.sync_status,degraded_reason:state.degraded_reason,view:state.last_view});}
    function emit(){onState(publicState());}
    function querySpec(route){var asOf=today(now());return Object.freeze({schema:QUERY_SCHEMA,version:VERSION,route:route,as_of:asOf,window_end:addDays(asOf,90)});}
    async function renderCurrent(){var epoch=++state.render_epoch;var route=state.route;if(!state.source){state.last_view=Object.freeze({status:'EMPTY',route:route,reason:'PLANNING_LOCAL_SNAPSHOT_EMPTY'});emit();return state.last_view;}var currentRevision=financeRevision();if(!currentRevision||currentRevision!==state.source.canonical_revision){state.last_view=Object.freeze({status:'STALE',route:route,reason:'PLANNING_CANONICAL_REVISION_MISMATCH'});emit();return state.last_view;}state.last_view=Object.freeze({status:'LOADING',route:route});emit();try{var result=await finance.runPlanningQuery(state.source,querySpec(route));if(epoch!==state.render_epoch||route!==state.route)return Object.freeze({status:'STALE_DISCARDED',route:route});if(!result||result.schema!==RESULT_SCHEMA||result.version!==VERSION||result.route!==route||result.canonical_revision!==currentRevision||result.planning_revision!==state.source.planning_revision)throw fail('LOCAL_PLANNING_RESULT_INVALID');state.last_view=Object.freeze({status:'READY',route:route,result:result});emit();return state.last_view;}catch(error){if(epoch!==state.render_epoch)return Object.freeze({status:'STALE_DISCARDED',route:route});state.last_view=Object.freeze({status:'ERROR',route:route,reason:safeReason(error,'LOCAL_PLANNING_RENDER_FAILED')});emit();return state.last_view;}}
    async function backgroundSync(){if(!transport)return null;state.sync_status='SYNCING';state.degraded_reason=null;emit();try{var response=await transport.fetchSnapshot({local_planning_revision:state.source?state.source.planning_revision:'',expected_canonical_revision:financeRevision()||''});if(response.state==='FULL_SNAPSHOT'){state.source=await store.putActive(response.source);}state.sync_status='READY';state.degraded_reason=null;await renderCurrent();return Object.freeze({status:response.state==='FULL_SNAPSHOT'?'UPDATED':'NOOP',planning_revision:response.planning_revision,canonical_revision:response.canonical_revision});}catch(error){state.sync_status=state.source?'DEGRADED':'FAILED';state.degraded_reason=safeReason(error,'LOCAL_PLANNING_SYNC_FAILED');emit();return Object.freeze({status:state.sync_status,reason:state.degraded_reason});}}
    async function start(route){if(route&&ROUTES.indexOf(route)>=0)state.route=route;state.sync_status='LOCAL_OPENING';emit();state.source=await store.getActive();state.sync_status=state.source?'READY':'EMPTY';await renderCurrent();Promise.resolve().then(backgroundSync).catch(function(){});return publicState();}
    async function setRoute(route){if(ROUTES.indexOf(route)<0)throw fail('LOCAL_PLANNING_ROUTE_INVALID');state.route=route;return renderCurrent();}
    return Object.freeze({start:start,setRoute:setRoute,renderCurrent:renderCurrent,backgroundSync:backgroundSync,getState:publicState,routes:ROUTES});
  }

  return Object.freeze({schema:SCHEMA,version:VERSION,sourceSchema:SOURCE_SCHEMA,responseSchema:RESPONSE_SCHEMA,querySchema:QUERY_SCHEMA,resultSchema:RESULT_SCHEMA,routes:ROUTES,parseWireEnvelope:parseWireEnvelope,validateRemoteEnvelope:validateRemoteEnvelope,createGoogleScriptTransport:createGoogleScriptTransport,createStore:createStore,createRuntime:createRuntime});
});
