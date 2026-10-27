// Compile collected facts before optimization. This does not verify source truth.
const select = require('./selection.cjs');
const text = x => typeof x === 'string' && x.trim().length > 0;
const states = ['SATISFIED', 'UNSATISFIED', 'UNKNOWN'];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
function check(value, label) {
  if (!value || !states.includes(value.state) || !text(value.source) || !text(value.detail))
    throw new Error('assessment: cited observation required: ' + label);
  return value;
}
function combine(values) {
  return {state: values.some(v => v.state === 'UNSATISFIED') ? 'UNSATISFIED' :
    values.some(v => v.state === 'UNKNOWN') ? 'UNKNOWN' : 'SATISFIED',
    source: values.map(v => v.source).join('\n'), detail: values.map(v => v.detail).join('\n')};
}
const unknown = (source, detail) => ({state: 'UNKNOWN', source, detail});
function compileAssessment(packet) {
  if (!packet || !Array.isArray(packet.candidates) || !Array.isArray(packet.graph_reports))
    throw new Error('assessment: candidates and graph_reports required');
  if (!/^[0-9a-f]{40}$/.test(packet.main_sha || '') ||
      !/^\d{4}-\d\d-\d\dT.*Z$/.test(packet.checked_at || '') || !Number.isFinite(Date.parse(packet.checked_at)))
    throw new Error('assessment: main SHA and UTC observation required');
  const tokens = packet.command || [];
  if (!Array.isArray(tokens)) throw new Error('assessment: command tokens required');
  const localCount = tokens.filter(t => t === '--local-graph').length;
  const pendingNumbers = new Set();
  for (let i = 0; i < tokens.length; i++) if (tokens[i] === '--accept-graph-update') {
    const raw = tokens[++i];
    if (typeof raw !== 'string' || !/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new Error('assessment: positive graph update PR number required');
    pendingNumbers.add(Number(raw));
  }
  if (localCount > 1 || (localCount && pendingNumbers.size))
    throw new Error('assessment: incompatible graph source invocation flags');
  const updates = packet.accepted_graph_updates || [];
  if (!Array.isArray(updates)) throw new Error('assessment: graph update evidence must be an array');
  const candidateProjects = packet.candidates.map(c => c?.project).filter(p => p !== null && p !== undefined);
  const assessedProjects = packet.assessed_project_ids === undefined ? [...new Set(candidateProjects)] : packet.assessed_project_ids;
  if (!Array.isArray(assessedProjects) || assessedProjects.some(p => !uuid.test(p)) ||
      new Set(assessedProjects).size !== assessedProjects.length ||
      candidateProjects.some(p => !assessedProjects.includes(p)))
    throw new Error('assessment: complete canonical assessed project IDs required');
  const byNumber = new Map();
  for (const number of pendingNumbers) {
    const matching = updates.filter(p => p && p.number === number);
    const pr = matching[0];
    if (matching.length !== 1 || pr.state !== 'OPEN' || pr.base !== 'main' ||
        pr.validation_exit !== 0 || ![0, 1].includes(pr.coverage_exit) ||
        pr.coverage_state !== (pr.coverage_exit === 0 ? 'CURRENT' : 'UPDATE_REQUIRED') ||
        !/^[0-9a-f]{40}$/.test(pr.head_sha || '') || pr.reviewed_head_sha !== pr.head_sha ||
        !text(pr.url) || !text(pr.review_source) || !Array.isArray(pr.project_ids) || !pr.project_ids.length ||
        pr.project_ids.some(p => !uuid.test(p)) || new Set(pr.project_ids).size !== pr.project_ids.length)
      throw new Error('assessment: graph update requires exact-head reviewed OPEN PR evidence: ' + number);
    if (!pr.project_ids.some(p => assessedProjects.includes(p)))
      throw new Error('assessment: graph update does not affect an assessed project: ' + number);
    byNumber.set(number, pr);
  }
  const updatesByProject = new Map();
  for (const pr of byNumber.values()) for (const project of pr.project_ids) {
    if (!assessedProjects.includes(project)) continue;
    if (updatesByProject.has(project))
      throw new Error('assessment: multiple accepted graph updates affect project ' + project);
    updatesByProject.set(project, pr);
  }
  const pinFields = ['index_path', 'manifest_path', 'index_digest', 'manifest_digest', 'source_revision'];
  if (packet.graph_sources && (typeof packet.graph_sources !== 'object' || Array.isArray(packet.graph_sources) || packet.graph_source))
    throw new Error('assessment: choose one graph source representation');
  let commonLocal = null;
  function sourceFor(project) {
    // A project-specific source permits published and multiple reviewed PR graphs
    // in the same batch. The prior single source remains valid where unambiguous.
    const source = packet.graph_sources ? packet.graph_sources[project] : packet.graph_source;
    if (!source || !['PUBLISHED', 'ACCEPTED_UPDATE', 'APPROVED_LOCAL'].includes(source.mode))
      throw new Error('assessment: explicit graph_source required for ' + project);
    if ((source.mode === 'APPROVED_LOCAL') !== (localCount === 1))
      throw new Error('assessment: graph source must match exact invocation flags');
    const accepted = updatesByProject.get(project);
    if (accepted && (source.mode !== 'ACCEPTED_UPDATE' || source.pr_number !== accepted.number))
      throw new Error('assessment: assessed project must use its accepted graph update');
    if (source.mode === 'APPROVED_LOCAL') {
      if (pinFields.some(k => !text(source.local_graph?.[k])))
        throw new Error('assessment: complete canonical local graph pins required');
      if (commonLocal && pinFields.some(k => commonLocal[k] !== source.local_graph[k]))
        throw new Error('assessment: all projects must use the same approved local graph');
      commonLocal = source.local_graph;
    } else if (!/^[0-9a-f]{40}$/.test(source.graph_sha || '')) {
      throw new Error('assessment: graph SHA required');
    } else if (source.mode === 'PUBLISHED' && source.graph_sha !== packet.main_sha) {
      throw new Error('assessment: published graph must be pinned main');
    } else if (source.mode === 'ACCEPTED_UPDATE') {
      const pr = byNumber.get(source.pr_number);
      if (!pr || pr.head_sha !== source.graph_sha || !pr.project_ids.includes(project))
        throw new Error('assessment: graph source must match accepted PR head and project');
    }
    return source;
  }

  function graph(candidate, transition) {
    if (candidate.project === null) return check(candidate.graph_exemption, candidate.issue_id + ' graph exemption');
    const source = sourceFor(candidate.project);
    const matches = packet.graph_reports.flatMap(entry => {
      const report = entry.report;
      if (report?.transition !== transition) return [];
      return (report.candidates || []).filter(c => c.issue_id === candidate.issue_uuid &&
        c.identifier === candidate.issue_id && c.project_id === candidate.project).map(c => ({entry, report, c}));
    });
    if (matches.length !== 1) return unknown(packet.snapshot_id,
      candidate.issue_id + ': requires one candidate-specific ' + transition + ' report; found ' + matches.length);
    const {entry, report, c} = matches[0];
    if (!text(entry.source)) throw new Error('assessment: graph report source required');
    const expectedMode = source.mode === 'ACCEPTED_UPDATE' ? 'PUBLISHED' : source.mode;
    const pinsMatch = source.mode === 'APPROVED_LOCAL' ? report.graph_sha === null &&
      pinFields.every(k => report.local_graph?.[k] === source.local_graph[k]) : report.graph_sha === source.graph_sha;
    const modeMatch = c.mode === expectedMode || (expectedMode === 'PUBLISHED' &&
      source.mode === 'PUBLISHED' && c.mode === 'LOCAL_RECONCILIATION' &&
      report.delta?.added_nodes?.length > 0 && report.delta?.repairs?.length > 0);
    if (report.schema_version !== 1 || report.evidence?.issues?.complete !== true ||
        report.evidence?.request?.transition !== transition ||
        !Array.isArray(report.evidence?.request?.selected) ||
        !report.evidence.request.selected.includes(candidate.issue_uuid) ||
        report.main_sha !== packet.main_sha || report.checked_at !== packet.checked_at || !pinsMatch ||
        !modeMatch || !['ELIGIBLE', 'BLOCKED'].includes(c.state) ||
        !Array.isArray(c.unmet) || (c.state === 'ELIGIBLE') !== (c.unmet.length === 0) ||
        !/^sha256:[0-9a-f]{64}$/.test(c.closure_graph_digest || '') ||
        !/^sha256:[0-9a-f]{64}$/.test(c.closure_evidence_digest || ''))
      return unknown(entry.source, candidate.issue_id + ': mismatched or incomplete ' + transition + ' admission pins');
    // A group BLOCKED state and coverage gaps cannot override this candidate.
    return {state: c.state === 'ELIGIBLE' ? 'SATISFIED' :
      c.unmet.some(e => e.state === 'UNSATISFIED') ? 'UNSATISFIED' : 'UNKNOWN',
      source: entry.source, detail: transition + ': ' + c.state + '; unmet=' + JSON.stringify(c.unmet)};
  }
  const candidates = packet.candidates.map(c => {
    if (!uuid.test(c.issue_uuid || '') || (c.project !== null && !uuid.test(c.project || '')))
      throw new Error('assessment: canonical issue/project UUIDs required: ' + c.issue_id);
    if (!c.lifecycle || !['STARTABLE', 'READ_ONLY_ONLY', 'UNKNOWN'].includes(c.lifecycle.state) ||
        !text(c.lifecycle.source) || !text(c.lifecycle.detail))
      throw new Error('assessment: cited lifecycle startability required: ' + c.issue_id);
    const scope = c.scope;
    if (!scope || !Array.isArray(scope.decisions)) throw new Error('assessment: explicit scope decision ledger required: ' + c.issue_id);
    const admission = check(scope.admission, c.issue_id + ' original owner admission');
    const decisionChecks = stage => scope.decisions.filter(d => {
      if (!text(d.id) || !Array.isArray(d.stages) || !d.stages.length ||
          d.stages.some(s => !['plan', 'build', 'merge', 'release'].includes(s)))
        throw new Error('assessment: named decision stages required: ' + c.issue_id);
      check(d, c.issue_id + ' decision ' + d.id);
      return d.stages.includes(stage);
    });
    const native = c.native;
    if (!native || !text(native.source) || !Array.isArray(native.blockers))
      throw new Error('assessment: complete native blocker observation required: ' + c.issue_id);
    const nativeChecks = native.blockers.map(b => check(b, c.issue_id + ' native blocker'));
    if (native.complete !== true) nativeChecks.push(unknown(native.source, 'Native relations incomplete'));
    if (!nativeChecks.length) nativeChecks.push({state: 'SATISFIED', source: native.source, detail: 'Both relation directions checked; no native blockers'});
    const checks = {
      scope_plan: combine([admission, check(scope.plan, c.issue_id + ' plan boundary'), ...decisionChecks('plan')]),
      scope_build: combine([admission, check(scope.build, c.issue_id + ' build boundary'), ...decisionChecks('build')]),
      native: combine(nativeChecks), plan_graph: graph(c, 'plan'), build_graph: graph(c, 'build'),
      foundation: check(c.foundation, c.issue_id + ' foundation')
    };
    const {scope: _s, native: _n, foundation: _f, graph_exemption: _g, checks: _ignored, ...rest} = c;
    return {...rest, checks};
  });
  const {graph_reports: _reports, graph_source: _source, graph_sources: _sources, accepted_graph_updates: _updates, ...snapshot} = packet;
  const input = {...snapshot, lifecycle_contract: 1, candidates};
  return {input, output: select(input)};
}
module.exports = compileAssessment;
