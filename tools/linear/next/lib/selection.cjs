// Pure, bounded selection. The Workflow sandbox embeds this function verbatim.
function selectCandidates(input) {
  const fail = message => { throw new Error('selection: ' + message); };
  const text = x => typeof x === 'string' && x.trim().length > 0;
  const positive = x => Number.isSafeInteger(x) && x > 0;
  const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const states = ['SATISFIED','UNSATISFIED','UNKNOWN'];
  const checks = ['scope_plan','scope_build','native','plan_graph','build_graph','foundation'];
  const planChecks = ['scope_plan','native','plan_graph'];
  if (input?.lifecycle_contract !== undefined && input.lifecycle_contract !== 1)
    fail('unsupported lifecycle contract');
  const lifecycleAware = input?.lifecycle_contract === 1;
  if (!input || input.schema_version !== 2 || input.complete !== true)
    fail('version 2 and a complete considered pool are required');
  if (!text(input.snapshot_id) || !/^[0-9a-f]{40}$/.test(input.source_revision || '') ||
      !Array.isArray(input.command) || input.command.some(x => !text(x)))
    fail('snapshot, skill revision and exact command tokens are required');
  const limit = input.limit ?? 12, budget = input.search_budget ?? 100000;
  if (!positive(input.requested) || !positive(limit) || input.requested > limit)
    fail('requested must be positive and no greater than the explicit selection limit ' + limit);
  if (!positive(budget) || budget > 1000000) fail('search_budget must be 1..1000000');
  if (!Array.isArray(input.candidates) || input.candidates.length > 1000 || !Array.isArray(input.pairs))
    fail('candidates (at most 1000) and pairs are required; never truncate the pool');
  const seen = new Set();
  const candidates = input.candidates.map(c => {
    if (!c || !text(c.issue_id) || seen.has(c.issue_id)) fail('unique issue ids required');
    seen.add(c.issue_id);
    if (![null,'string'].includes(c.project === null ? null : typeof c.project) ||
        !text(c.milestone) || !Number.isSafeInteger(c.priority) || c.priority < 0 ||
        typeof c.active_release !== 'boolean') fail(c.issue_id + ': project, milestone and rank required');
    if (!c.ownership || !['ACTIVE','INACTIVE','UNKNOWN'].includes(c.ownership.state) ||
        !text(c.ownership.source)) fail(c.issue_id + ': cited ownership required');
    if (lifecycleAware && (!c.lifecycle ||
        !['STARTABLE','READ_ONLY_ONLY','UNKNOWN'].includes(c.lifecycle.state) ||
        !text(c.lifecycle.source) || !text(c.lifecycle.detail)))
      fail(c.issue_id + ': cited lifecycle startability required');
    for (const key of checks) {
      const check = c.checks?.[key];
      if (!check || !states.includes(check.state) || !text(check.source) || !text(check.detail))
        fail(c.issue_id + ': cited check required: ' + key);
    }
    if (c.file_scope !== null && (!Array.isArray(c.file_scope) || c.file_scope.some(f => !text(f))))
      fail(c.issue_id + ': file_scope must be paths or null');
    if (!Array.isArray(c.external_overlaps) || c.external_overlaps.some(o =>
      !text(o.source) || !text(o.work) || !Array.isArray(o.files) || o.files.some(f => !text(f))))
      fail(c.issue_id + ': cited external overlaps required (empty when verified absent)');
    const reasons = keys => keys.filter(k => c.checks[k].state !== 'SATISFIED').map(k =>
      ({code:k.toUpperCase(), ...c.checks[k]}));
    const planReasons = reasons(planChecks), buildReasons = reasons(checks);
    if (c.ownership.state !== 'INACTIVE') {
      const r = {code:'OWNERSHIP',state:c.ownership.state === 'ACTIVE' ? 'UNSATISFIED' : 'UNKNOWN',
        source:c.ownership.source,detail:c.ownership.state === 'ACTIVE' ? 'Resume existing work' : 'Verify writer ownership'};
      planReasons.push(r); buildReasons.push(r);
    }
    const dispatchReasons = [...planReasons];
    if (lifecycleAware && c.lifecycle.state !== 'STARTABLE') {
      const r = {code:'LIFECYCLE',state:c.lifecycle.state === 'UNKNOWN' ? 'UNKNOWN' : 'UNSATISFIED',
        source:c.lifecycle.source,detail:c.lifecycle.detail};
      buildReasons.push(r); dispatchReasons.push(r);
    }
    if (!c.file_scope?.length) buildReasons.push({code:'FILE_SCOPE',state:'UNKNOWN',
      source:input.snapshot_id,detail:'Read-only scope mapping required before implementation selection'});
    const state = rs => rs.some(r => r.state === 'UNSATISFIED') ? 'BLOCKED' : rs.length ? 'UNKNOWN' : 'ELIGIBLE';
    return {...c,plan:{state:state(planReasons),reasons:planReasons},
      build:{state:state(buildReasons),reasons:buildReasons},
      ...(lifecycleAware ? {dispatch:{state:state(dispatchReasons),reasons:dispatchReasons}} : {}),
      warnings:[...c.external_overlaps]};
  }).sort((a,b) => Number(b.active_release)-Number(a.active_release) || a.priority-b.priority || compare(a.issue_id,b.issue_id));
  const pairs = new Map(), key = (a,b) => JSON.stringify([a,b].sort(compare));
  for (const p of input.pairs) {
    if (!seen.has(p.a) || !seen.has(p.b) || p.a === p.b || pairs.has(key(p.a,p.b)) ||
        !['INDEPENDENT','DEPENDENCY','INCOMPATIBLE','UNKNOWN'].includes(p.relation) || !text(p.source) || !text(p.detail))
      fail('unique, cited candidate pair assessments required');
    pairs.set(key(p.a,p.b),p);
  }
  for (let i=0;i<candidates.length;i++) for (let j=i+1;j<candidates.length;j++) {
    const a=candidates[i],b=candidates[j];
    const files=(a.file_scope || []).filter(f => b.file_scope?.includes(f));
    if (files.length) {
      a.warnings.push({work:b.issue_id,files,source:input.snapshot_id});
      b.warnings.push({work:a.issue_id,files,source:input.snapshot_id});
    }
  }
  const pool=candidates.filter(c => c.build.state === 'ELIGIBLE');
  const conflicts=pool.map(() => new Set());
  for (let i=0;i<pool.length;i++) for (let j=i+1;j<pool.length;j++) {
    const p=pairs.get(key(pool[i].issue_id,pool[j].issue_id));
    if (!p) fail('missing pair assessment: '+pool[i].issue_id+' / '+pool[j].issue_id);
    if (p.relation !== 'INDEPENDENT') { conflicts[i].add(j); conflicts[j].add(i); }
  }
  const activeCount = indices => indices.filter(i => pool[i].active_release).length;
  const better = (a,b) => {
    if (a.length !== b.length) return a.length > b.length;
    if (activeCount(a) !== activeCount(b)) return activeCount(a) > activeCount(b);
    for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  const target=Math.min(input.requested,pool.length);
  let best=[],visited=0;
  for (let i=0;i<pool.length && best.length<target;i++)
    if (best.every(j => !conflicts[i].has(j))) best.push(i);
  // The first N ranked candidates, when compatible, are the exact best tie too.
  const triviallyOptimal=best.length===target && best.every((n,i) => n===i);
  const pending=triviallyOptimal ? [] : [{chosen:[],remaining:pool.map((_c,i) => i)}];
  while (pending.length && visited<budget) {
    const {chosen,remaining}=pending.pop(); visited++;
    if (better(chosen,best)) best=chosen;
    if (chosen.length===target || chosen.length+remaining.length<best.length || !remaining.length) continue;
    const [next,...rest]=remaining;
    // LIFO explores the preferred include branch first. No clock-dependent result.
    pending.push({chosen,remaining:rest});
    pending.push({chosen:[...chosen,next],remaining:rest.filter(i => !conflicts[next].has(i))});
  }
  const selected=best.map(i => pool[i].issue_id), optimal=pending.length===0;
  const upper=optimal ? best.length : Math.max(best.length,...pending.map(n => Math.min(target,n.chosen.length+n.remaining.length)));
  const planning=candidates.filter(c => c.plan.state==='ELIGIBLE' && c.build.state!=='ELIGIBLE' &&
    (!lifecycleAware || c.dispatch.state==='ELIGIBLE'));
  const advisory=lifecycleAware ? candidates.filter(c => c.plan.state==='ELIGIBLE' &&
    c.lifecycle.state==='READ_ONLY_ONLY') : [];
  const planningIds=planning.slice(0,input.requested).map(c => c.issue_id);
  const outcomes=candidates.map(c => {
    let disposition=selected.includes(c.issue_id) ? 'SELECTED' :
      c.ownership.state==='ACTIVE' ? 'ACTIVE' : planningIds.includes(c.issue_id) ? 'PLANNING' :
      planning.includes(c) ? 'PLANNING_QUEUED' : advisory.includes(c) ? 'READ_ONLY_PLANNING' :
      c.build.state==='ELIGIBLE' ? 'SEQUENCED' :
      c.plan.state==='BLOCKED' ? 'BLOCKED' : 'UNKNOWN';
    const constraints=selected.filter(id => id!==c.issue_id).map(id => pairs.get(key(id,c.issue_id)))
      .filter(p => p && p.relation!=='INDEPENDENT');
    const reason=disposition==='SEQUENCED' ? (constraints.length ? 'PAIR_CONSTRAINT' :
      selected.length===input.requested ? 'CAPACITY_OR_PRIORITY' : 'SEARCH_BUDGET') : disposition;
    return {issue_id:c.issue_id,project:c.project,milestone:c.milestone,disposition,reason,
      plan:c.plan,build:c.build,...(lifecycleAware ? {dispatch:c.dispatch,lifecycle:c.lifecycle} : {}),
      constraints,warnings:c.warnings};
  });
  return {schema_version:2,snapshot_id:input.snapshot_id,command:input.command,source_revision:input.source_revision,
    selected_ids:selected,planning_ids:planningIds,
    ...(lifecycleAware ? {read_only_planning_ids:advisory.map(c=>c.issue_id)} : {}),outcomes,
    capacity:{requested:input.requested,limit,selected:selected.length,planning:planningIds.length,
      unfilled:input.requested-selected.length,eligible:pool.length,considered:candidates.length,
      ...(lifecycleAware ? {read_only_planning:advisory.length} : {}),
      optimal,upper_bound:upper,search_visits:visited,
      reason:selected.length===input.requested ? 'FILLED' : !optimal ? 'SEARCH_BUDGET' :
        pool.length<input.requested ? 'INSUFFICIENT_BUILD_CANDIDATES' : 'PAIR_CONSTRAINTS'}};
}
module.exports = selectCandidates;
