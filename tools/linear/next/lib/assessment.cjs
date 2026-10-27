// Compile collected facts before optimization. This does not verify source truth.
const select = require('./selection.cjs');
const text = x => typeof x === 'string' && x.trim().length > 0;
const states = ['SATISFIED', 'UNSATISFIED', 'UNKNOWN'];
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
  const source = packet.graph_source;
  if (!source || !['PUBLISHED', 'ACCEPTED_UPDATE', 'APPROVED_LOCAL'].includes(source.mode))
    throw new Error('assessment: explicit graph_source required');
  const tokens = packet.command || [];
  const localCount = tokens.filter(t => t === '--local-graph').length;
  const pending = tokens.includes('--accept-graph-update');
  if (localCount > 1 || (localCount && pending) ||
      (source.mode === 'APPROVED_LOCAL') !== (localCount === 1) ||
      (source.mode === 'ACCEPTED_UPDATE') !== pending)
    throw new Error('assessment: graph source must match exact invocation flags');
  const pinFields = ['index_path', 'manifest_path', 'index_digest', 'manifest_digest', 'source_revision'];
  if (source.mode === 'APPROVED_LOCAL' && pinFields.some(k => !text(source.local_graph?.[k])))
    throw new Error('assessment: complete canonical local graph pins required');
  if (source.mode !== 'APPROVED_LOCAL' && !/^[0-9a-f]{40}$/.test(source.graph_sha || ''))
    throw new Error('assessment: graph SHA required');
  if (source.mode === 'PUBLISHED' && source.graph_sha !== packet.main_sha)
    throw new Error('assessment: published graph must be pinned main');

  function graph(candidate, transition) {
    if (candidate.project === null) return check(candidate.graph_exemption, candidate.issue_id + ' graph exemption');
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
    const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
    if (!uuid.test(c.issue_uuid || '') || (c.project !== null && !uuid.test(c.project || '')))
      throw new Error('assessment: canonical issue/project UUIDs required: ' + c.issue_id);
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
  const {graph_reports: _reports, graph_source: _source, ...snapshot} = packet;
  const input = {...snapshot, candidates};
  return {input, output: select(input)};
}
module.exports = compileAssessment;
