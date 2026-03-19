export const renderAdminHtml = (): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kovi Operator Control Plane</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0f14;
        --bg-soft: #121a24;
        --panel: #151f2d;
        --panel-2: #1a2638;
        --line: #2a3c54;
        --text: #d9e7ff;
        --muted: #8fa5c8;
        --ok: #34d29d;
        --warn: #f6bf50;
        --bad: #ff6f7f;
        --accent: #5bc0ff;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        font-family: "Segoe UI Variable", "Aptos", "IBM Plex Sans", sans-serif;
        background: radial-gradient(900px 500px at 5% -10%, #1c324e 0%, transparent 45%),
                    radial-gradient(1000px 700px at 105% 10%, #213655 0%, transparent 40%),
                    var(--bg);
        color: var(--text);
      }
      .app {
        display: grid;
        grid-template-columns: 250px 1fr;
        min-height: 100vh;
      }
      .sidebar {
        border-right: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(21,31,45,.94), rgba(11,15,20,.95));
        padding: 16px;
      }
      .brand { color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 8px 0 14px; font-size: 20px; font-weight: 650; }
      .nav { display: grid; gap: 6px; margin-top: 12px; }
      .nav button {
        text-align: left;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--text);
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
      }
      .nav button.active { border-color: var(--accent); background: #193047; }
      .tenant-box, .auth-box {
        border: 1px solid var(--line);
        background: var(--bg-soft);
        border-radius: 12px;
        padding: 10px;
        margin-top: 12px;
      }
      .tenant-box label, .auth-box label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 4px; }
      input, textarea, select {
        width: 100%;
        border: 1px solid var(--line);
        background: #0d141f;
        color: var(--text);
        border-radius: 9px;
        padding: 8px 10px;
      }
      .main { padding: 18px; display: grid; gap: 12px; }
      .toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .toolbar button, .button {
        border: 1px solid #355a85;
        background: #1a2f47;
        color: var(--text);
        border-radius: 9px;
        padding: 8px 11px;
        cursor: pointer;
      }
      .button.warn { border-color: #7f6227; background: #3d3018; }
      .button.bad { border-color: #7f2a37; background: #3a171f; }
      .grid { display: grid; gap: 12px; }
      .cards { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
      .card {
        border: 1px solid var(--line);
        background: linear-gradient(180deg, var(--panel), var(--panel-2));
        border-radius: 12px;
        padding: 12px;
      }
      .k { color: var(--muted); font-size: 12px; }
      .v { font-size: 22px; font-weight: 650; margin-top: 6px; }
      .ok { color: var(--ok); }
      .warn { color: var(--warn); }
      .bad { color: var(--bad); }
      .panel {
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 12px;
        padding: 12px;
      }
      .empty, .error, .loading {
        border: 1px dashed var(--line);
        border-radius: 12px;
        padding: 12px;
      }
      .error { border-color: #6e2835; color: #ffc1cb; }
      .loading { color: var(--muted); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
      th { color: var(--muted); font-weight: 560; }
      pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
      .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .wizard-steps { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .pill {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        color: var(--muted);
      }
      .pill.active { color: var(--text); border-color: var(--accent); }
      .mono { font-family: Consolas, "Cascadia Code", monospace; }
      .muted { color: var(--muted); }
      @media (max-width: 1060px) {
        .app { grid-template-columns: 1fr; }
        .sidebar { border-right: none; border-bottom: 1px solid var(--line); }
        .split { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">Kovi</div>
        <h1>Operator Console</h1>
        <div class="nav" id="nav"></div>

        <div class="tenant-box">
          <label>Tenant Slug</label>
          <input id="tenantSlug" placeholder="default" />
          <label style="margin-top:8px;">Service Token</label>
          <input id="serviceToken" type="password" placeholder="tenant service token" />
          <button style="margin-top:8px; width:100%;" id="saveAuth">Save Credentials</button>
        </div>

        <div class="auth-box">
          <div class="k">Role</div>
          <div id="roleText">-</div>
          <div class="k" style="margin-top:8px;">Tenant</div>
          <div id="tenantText">-</div>
        </div>
      </aside>

      <main class="main">
        <div id="view"></div>
      </main>
    </div>

    <script>
      const NAV_ITEMS = [
        'dashboard', 'sources', 'source-detail', 'runs', 'changes', 'sessions', 'webhooks', 'policies', 'tenants', 'audit-logs', 'diagnostics', 'replay', 'settings'
      ];

      const state = {
        route: 'dashboard',
        selectedSourceId: null,
        bootstrap: null,
        drafts: [],
        lastError: null
      };

      const fmt = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
      };

      const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

      const parseList = (raw) =>
        String(raw ?? '')
          .split(/\r?\n|,/) 
          .map((v) => v.trim())
          .filter(Boolean);

      const auth = {
        get tenant() { return localStorage.getItem('koviTenant') || ''; },
        get token() { return localStorage.getItem('koviToken') || ''; },
        set(tenant, token) {
          localStorage.setItem('koviTenant', tenant || '');
          localStorage.setItem('koviToken', token || '');
        }
      };

      const client = {
        async request(path, options = {}) {
          const tenant = auth.tenant;
          const token = auth.token;
          const res = await fetch(path, {
            ...options,
            headers: {
              'content-type': 'application/json',
              ...(tenant ? { 'x-kovi-tenant': tenant } : {}),
              ...(token ? { 'x-kovi-service-token': token } : {}),
              ...(options.headers || {})
            }
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || payload.message || res.status + ' ' + res.statusText);
          }
          if (res.status === 204) return {};
          return res.json();
        },
        get(path) { return this.request(path); },
        post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) }); },
        patch(path, body) { return this.request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); },
        del(path) { return this.request(path, { method: 'DELETE' }); }
      };

      function setRoute(route) {
        state.route = route;
        location.hash = '#/' + route + (state.selectedSourceId && route === 'source-detail' ? '/' + encodeURIComponent(state.selectedSourceId) : '');
        render();
      }

      function readRouteFromHash() {
        const rawHash = location.hash || '#/dashboard';
        const hash = rawHash.startsWith('#/') ? rawHash.slice(2) : rawHash.replace(/^#/, '');
        const parts = hash.split('/').filter(Boolean);
        state.route = NAV_ITEMS.includes(parts[0]) ? parts[0] : 'dashboard';
        if (parts[0] === 'source-detail' && parts[1]) state.selectedSourceId = decodeURIComponent(parts[1]);
      }

      function renderNav() {
        const nav = document.getElementById('nav');
        nav.innerHTML = NAV_ITEMS.map((item) => {
          const active = item === state.route ? 'active' : '';
          return '<button class="' + active + '" data-route="' + safe(item) + '">' + safe(item.replace('-', ' ')) + '</button>';
        }).join('');
        nav.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => setRoute(button.getAttribute('data-route'))));
      }

      function renderLoading(title) {
        document.getElementById('view').innerHTML = '<div class="loading">' + safe(title || 'Loading...') + '</div>';
      }

      function renderError(error) {
        document.getElementById('view').innerHTML = '<div class="error">' + safe(error.message || String(error)) + '</div>';
      }

      async function loadBootstrap() {
        state.bootstrap = await client.get('/admin/api/bootstrap');
        document.getElementById('roleText').textContent = state.bootstrap.role || '-';
        document.getElementById('tenantText').textContent = state.bootstrap.tenant ? state.bootstrap.tenant.name + ' (' + state.bootstrap.tenant.slug + ')' : '-';
      }

      function card(key, value, klass = '') {
        return '<article class="card"><div class="k">' + safe(key) + '</div><div class="v ' + safe(klass) + '">' + safe(String(value ?? '-')) + '</div></article>';
      }

      async function renderDashboard() {
        renderLoading('Loading dashboard...');
        const data = await client.get('/admin/api/dashboard');
        const o = data.overview || {};
        const d = data.diagnostics || {};

        document.getElementById('view').innerHTML = ''
          + '<div class="toolbar"><button id="refreshDashboard">Refresh</button><button id="newDraft" class="button">New Source Wizard Draft</button></div>'
          + '<section class="grid cards">'
          + card('Sources', o.sourceCount || 0)
          + card('Active Sources', o.activeSourceCount || 0)
          + card('Usage Pages (7d)', o.usagePagesFetched || 0)
          + card('Usage Events (7d)', o.usageEventsPublished || 0)
          + card('Degraded', d.degradedSources || 0, d.degradedSources > 0 ? 'warn' : 'ok')
          + card('Policy Blocked', d.policyBlocked || 0, d.policyBlocked > 0 ? 'bad' : 'ok')
          + card('Auth Failures (24h)', d.authFailures24h || 0, d.authFailures24h > 0 ? 'warn' : 'ok')
          + card('Publish Failures (24h)', d.publishFailures24h || 0, d.publishFailures24h > 0 ? 'bad' : 'ok')
          + '</section>'
          + '<div class="split">'
          + '<section class="panel"><h3>Recent Runs</h3>' + renderRunsTable(data.runs || []) + '</section>'
          + '<section class="panel"><h3>Recent Changes</h3>' + renderChangesTable(data.changes || []) + '</section>'
          + '</div>';

        document.getElementById('refreshDashboard').addEventListener('click', () => renderRoute().catch(renderError));
        document.getElementById('newDraft').addEventListener('click', async () => {
          const name = prompt('Draft name');
          if (!name) return;
          await client.post('/admin/api/onboarding/drafts', { name, draft: {} });
          setRoute('sources');
        });
      }

      function renderRunsTable(rows) {
        if (!rows.length) return '<div class="empty">No runs yet.</div>';
        return '<table><thead><tr><th>Started</th><th>Source</th><th>Type</th><th>Status</th><th>Duration</th><th>Pages</th></tr></thead><tbody>'
          + rows.map((row) => {
            const pages = (row.pagesSucceeded || 0) + (row.pagesFailed || 0) + (row.pagesDeadLetter || 0);
            const duration = row.endedAt ? ((new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime()) / 1000).toFixed(1) + 's' : '-';
            return '<tr><td>' + safe(fmt(row.startedAt)) + '</td><td>' + safe(row.sourceName || row.sourceId) + '</td><td>' + safe(row.runClassification || '-') + '</td><td>' + safe(row.status) + '</td><td>' + safe(duration) + '</td><td>' + safe(String(pages)) + '</td></tr>';
          }).join('') + '</tbody></table>';
      }

      function renderChangesTable(rows) {
        if (!rows.length) return '<div class="empty">No changes found.</div>';
        return '<table><thead><tr><th>Time</th><th>Source</th><th>Entity</th><th>Fields</th></tr></thead><tbody>'
          + rows.map((row) => '<tr><td>' + safe(fmt(row.createdAt)) + '</td><td>' + safe(row.sourceId) + '</td><td>' + safe(row.entityId || '-') + '</td><td><pre class="mono">' + safe(JSON.stringify(row.fieldChanges || [], null, 2)) + '</pre></td></tr>').join('')
          + '</tbody></table>';
      }

      async function renderSources() {
        renderLoading('Loading sources and drafts...');
        const [sourceData, draftData] = await Promise.all([
          client.get('/admin/api/sources'),
          client.get('/admin/api/onboarding/drafts')
        ]);
        state.drafts = draftData.drafts || [];

        document.getElementById('view').innerHTML = ''
          + '<div class="toolbar"><button id="createDraft">Create Draft</button><button id="refreshSources">Refresh</button></div>'
          + '<div class="split">'
          + '<section class="panel"><h3>Sources</h3>' + renderSourceList(sourceData.sources || []) + '</section>'
          + '<section class="panel"><h3>Onboarding Drafts</h3>' + renderDraftsTable(state.drafts) + '</section>'
          + '</div>';

        document.getElementById('refreshSources').addEventListener('click', () => renderRoute().catch(renderError));
        document.getElementById('createDraft').addEventListener('click', async () => {
          const name = prompt('Draft name');
          if (!name) return;
          await client.post('/admin/api/onboarding/drafts', { name, draft: {} });
          await renderRoute();
        });

        document.querySelectorAll('[data-open-source]').forEach((button) => {
          button.addEventListener('click', () => {
            state.selectedSourceId = button.getAttribute('data-open-source');
            setRoute('source-detail');
          });
        });

        document.querySelectorAll('[data-open-draft]').forEach((button) => {
          button.addEventListener('click', () => openDraftWizard(button.getAttribute('data-open-draft')).catch(renderError));
        });
      }

      function renderSourceList(rows) {
        if (!rows.length) return '<div class="empty">No sources. Start from onboarding wizard.</div>';
        return '<table><thead><tr><th>Name</th><th>Status</th><th>Health</th><th>Updated</th><th></th></tr></thead><tbody>'
          + rows.map((row) => '<tr><td>' + safe(row.name) + '</td><td>' + safe(row.operatorState) + '</td><td>' + safe(row.healthStatus) + '</td><td>' + safe(fmt(row.updatedAt)) + '</td><td><button data-open-source="' + safe(row.id) + '">Open</button></td></tr>').join('')
          + '</tbody></table>';
      }

      function renderDraftsTable(rows) {
        if (!rows.length) return '<div class="empty">No drafts saved.</div>';
        return '<table><thead><tr><th>Name</th><th>Status</th><th>Step</th><th>Updated</th><th></th></tr></thead><tbody>'
          + rows.map((row) => '<tr><td>' + safe(row.name) + '</td><td>' + safe(row.status) + '</td><td>' + safe(String(row.stepIndex + 1)) + '/8</td><td>' + safe(fmt(row.updatedAt)) + '</td><td><button data-open-draft="' + safe(row.id) + '">Resume</button></td></tr>').join('')
          + '</tbody></table>';
      }

      async function renderSourceDetail() {
        if (!state.selectedSourceId) {
          document.getElementById('view').innerHTML = '<div class="empty">Select a source first from Sources.</div>';
          return;
        }

        renderLoading('Loading source detail...');
        const [overview, jobs] = await Promise.all([
          client.get('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/overview'),
          client.get('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/jobs')
        ]);

        const source = overview.source || {};
        const status = overview.status || {};
        const session = overview.session || {};

        document.getElementById('view').innerHTML = ''
          + '<div class="toolbar">'
          + '<button data-action="pause" class="button">Pause</button>'
          + '<button data-action="resume" class="button">Resume</button>'
          + '<button data-action="run" class="button warn">Run Now</button>'
          + '<button data-action="dry" class="button warn">Dry Run</button>'
          + '<button data-action="relogin" class="button">Relogin</button>'
          + '<button data-action="clone" class="button">Clone</button>'
          + '<button data-action="replay" class="button">Replay</button>'
          + '<button data-action="backfill" class="button">Backfill</button>'
          + '<button data-action="reprocess" class="button">Reprocess</button>'
          + '</div>'
          + '<section class="grid cards">'
          + card('Source', source.name || '-')
          + card('Policy', status.governanceStatus || '-')
          + card('Health', status.healthStatus || '-')
          + card('Last Run', fmt(status.lastRunStartedAt))
          + card('Last Success/Fail', status.lastRunStatus || '-')
          + card('Session', session.status || 'missing')
          + card('Events Published', overview.deliveryStats ? overview.deliveryStats.published : 0)
          + card('Events Failed', overview.deliveryStats ? overview.deliveryStats.failed : 0, (overview.deliveryStats && overview.deliveryStats.failed > 0) ? 'bad' : 'ok')
          + '</section>'
          + '<div class="split">'
          + '<section class="panel"><h3>Recent Runs</h3>' + renderRunsTable(overview.recentRuns || []) + '</section>'
          + '<section class="panel"><h3>Recent Diffs</h3>' + renderChangesTable(overview.changes || []) + '</section>'
          + '</div>'
          + '<div class="split">'
          + '<section class="panel"><h3>Linked Replay Jobs</h3>' + renderReplayTable(jobs.jobs || []) + '</section>'
          + '<section class="panel"><h3>Selector Sandbox</h3>'
          + '<label>URL (optional)</label><input id="sandboxUrl" placeholder="https://example.com/item/1" />'
          + '<label style="margin-top:8px;">Required Fields (comma/new line)</label><textarea id="sandboxRequired" rows="3" placeholder="id\nname"></textarea>'
          + '<button id="sandboxTest" style="margin-top:8px;">Test Against Latest Snapshot</button>'
          + '<pre id="sandboxOut" class="mono" style="margin-top:8px; min-height:120px; max-height:320px; overflow:auto;"></pre>'
          + '</section>'
          + '</div>';

        document.querySelectorAll('[data-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const action = button.getAttribute('data-action');
            if (action === 'pause') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/pause', {});
            if (action === 'resume') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/resume', {});
            if (action === 'run') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/manual-crawl', {});
            if (action === 'dry') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/dry-run', {});
            if (action === 'relogin') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/rotate-session', {});
            if (action === 'clone') await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/clone', {});
            if (action === 'replay') await client.post('/admin/api/replay-jobs', { sourceId: state.selectedSourceId, jobType: 'replay', dryRun: false, params: {} });
            if (action === 'backfill') await client.post('/admin/api/replay-jobs', { sourceId: state.selectedSourceId, jobType: 'backfill', dryRun: false, params: {} });
            if (action === 'reprocess') await client.post('/admin/api/replay-jobs', { sourceId: state.selectedSourceId, jobType: 'reprocess', dryRun: false, params: {} });
            await renderRoute();
          });
        });

        document.getElementById('sandboxTest').addEventListener('click', async () => {
          const requiredFields = parseList(document.getElementById('sandboxRequired').value);
          const url = document.getElementById('sandboxUrl').value.trim();
          const result = await client.post('/admin/api/sources/' + encodeURIComponent(state.selectedSourceId) + '/selector-sandbox/test', {
            useLatestSnapshot: true,
            ...(url ? { url } : {}),
            requiredFields,
            compareWithCurrent: true
          });
          document.getElementById('sandboxOut').textContent = JSON.stringify(result, null, 2);
        });
      }

      function renderReplayTable(rows) {
        if (!rows.length) return '<div class="empty">No replay/backfill/reprocess jobs.</div>';
        return '<table><thead><tr><th>Created</th><th>Type</th><th>Status</th><th>Dry Run</th></tr></thead><tbody>'
          + rows.map((row) => '<tr><td>' + safe(fmt(row.createdAt)) + '</td><td>' + safe(row.jobType) + '</td><td>' + safe(row.status) + '</td><td>' + safe(String(row.dryRun)) + '</td></tr>').join('')
          + '</tbody></table>';
      }

      async function renderRuns() {
        renderLoading('Loading runs...');
        const data = await client.get('/admin/api/runs?limit=200');
        document.getElementById('view').innerHTML = '<section class="panel"><h3>Runs</h3>' + renderRunsTable(data.runs || []) + '</section>';
      }

      async function renderChanges() {
        renderLoading('Loading changes...');
        const data = await client.get('/admin/api/changes?limit=200');
        document.getElementById('view').innerHTML = '<section class="panel"><h3>Changes</h3>' + renderChangesTable(data.changes || []) + '</section>';
      }

      async function renderSessions() {
        renderLoading('Loading sessions...');
        const data = await client.get('/admin/api/sessions');
        document.getElementById('view').innerHTML = '<section class="panel"><h3>Sessions</h3>' + renderSessionsTable(data.sessions || []) + '</section>';
      }

      function renderSessionsTable(rows) {
        if (!rows.length) return '<div class="empty">No session records.</div>';
        return '<table><thead><tr><th>Source</th><th>Status</th><th>Strategy</th><th>Expires</th><th>Last Validation</th><th>Action</th></tr></thead><tbody>'
          + rows.map((row) => '<tr><td>' + safe(row.sourceName || row.sourceId) + '</td><td>' + safe(row.status) + '</td><td>' + safe(row.strategy) + '</td><td>' + safe(fmt(row.expiresAt)) + '</td><td>' + safe(fmt(row.lastValidatedAt)) + '</td><td><button data-reauth="' + safe(row.sourceId) + '">Re-auth</button></td></tr>').join('')
          + '</tbody></table>';
      }

      async function renderDiagnostics() {
        renderLoading('Loading diagnostics...');
        const data = await client.get('/admin/api/diagnostics');
        const s = data.summary || {};
        document.getElementById('view').innerHTML = ''
          + '<section class="grid cards">'
          + card('Degraded Sources', s.degradedSources || 0, s.degradedSources > 0 ? 'warn' : 'ok')
          + card('Repeated Failures', s.repeatedFailures || 0, s.repeatedFailures > 0 ? 'warn' : 'ok')
          + card('Policy Blocked', s.policyBlocked || 0, s.policyBlocked > 0 ? 'bad' : 'ok')
          + card('Auth Failures (24h)', s.authFailures24h || 0, s.authFailures24h > 0 ? 'warn' : 'ok')
          + card('Publish Failures (24h)', s.publishFailures24h || 0, s.publishFailures24h > 0 ? 'bad' : 'ok')
          + card('Slow Runs (24h)', s.slowRuns24h || 0, s.slowRuns24h > 0 ? 'warn' : 'ok')
          + '</section>'
          + '<div class="split">'
          + '<section class="panel"><h3>Degraded Sources</h3><pre class="mono">' + safe(JSON.stringify(data.degradedSources || [], null, 2)) + '</pre></section>'
          + '<section class="panel"><h3>Triage Queue</h3><pre class="mono">' + safe(JSON.stringify(data.failedRuns || [], null, 2)) + '</pre></section>'
          + '</div>';
      }

      async function renderTenants() {
        renderLoading('Loading tenants...');
        const data = await client.get('/admin/api/tenants');
        const rows = data.tenants || [];
        document.getElementById('view').innerHTML = rows.length
          ? '<section class="panel"><h3>Tenants</h3><table><thead><tr><th>Slug</th><th>Name</th><th>Status</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + safe(r.slug) + '</td><td>' + safe(r.name) + '</td><td>' + safe(r.status) + '</td></tr>').join('') + '</tbody></table></section>'
          : '<div class="empty">No tenant data visible for this role.</div>';
      }

      async function renderWebhooks() {
        renderLoading('Loading webhooks...');
        const data = await client.get('/admin/api/webhooks');
        const rows = data.webhooks || [];
        document.getElementById('view').innerHTML = rows.length
          ? '<section class="panel"><h3>Webhooks</h3><pre class="mono">' + safe(JSON.stringify(rows, null, 2)) + '</pre></section>'
          : '<div class="empty">No webhooks configured.</div>';
      }

      async function renderReplay() {
        renderLoading('Loading replay jobs...');
        const data = await client.get('/admin/api/replay-jobs?limit=200');
        document.getElementById('view').innerHTML = '<section class="panel"><h3>Replay / Backfill / Reprocess</h3>' + renderReplayTable(data.jobs || []) + '</section>';
      }

      function renderSimple(title, text) {
        document.getElementById('view').innerHTML = '<section class="panel"><h3>' + safe(title) + '</h3><div class="muted">' + safe(text) + '</div></section>';
      }

      async function openDraftWizard(draftId) {
        renderLoading('Opening onboarding draft...');
        const data = await client.get('/admin/api/onboarding/drafts/' + encodeURIComponent(draftId));
        const draft = data.draft;
        const model = draft.draftJson || {};

        document.getElementById('view').innerHTML = ''
          + '<section class="panel">'
          + '<h3>Source Onboarding Wizard: ' + safe(draft.name) + '</h3>'
          + '<div class="wizard-steps">' + Array.from({ length: 8 }, (_, i) => '<span class="pill ' + (i === draft.stepIndex ? 'active' : '') + '">Step ' + (i + 1) + '</span>').join('') + '</div>'
          + '<div class="split">'
          + '<div>'
          + '<label>Source Name</label><input id="wSourceName" value="' + safe((model.basic && model.basic.sourceName) || '') + '" />'
          + '<label style="margin-top:8px;">Base URL</label><input id="wBaseUrl" value="' + safe((model.basic && model.basic.baseUrl) || '') + '" />'
          + '<label style="margin-top:8px;">Allowed Domains</label><textarea id="wDomains" rows="3">' + safe(((model.basic && model.basic.allowedDomains) || []).join('\n')) + '</textarea>'
          + '<label style="margin-top:8px;">Schedule Interval</label><input id="wInterval" value="' + safe((model.basic && model.basic.scheduleInterval) || 'PT15M') + '" />'
          + '</div>'
          + '<div>'
          + '<label>Entrypoints</label><textarea id="wEntrypoints" rows="3">' + safe(((model.crawl && model.crawl.entrypoints) || []).join('\n')) + '</textarea>'
          + '<label style="margin-top:8px;">Internal Link Patterns</label><textarea id="wLinks" rows="3">' + safe(((model.crawl && model.crawl.internalLinkPatterns) || []).join('\n')) + '</textarea>'
          + '<label style="margin-top:8px;">Max Depth</label><input id="wDepth" value="' + safe(String((model.crawl && model.crawl.maxDepth) || 2)) + '" />'
          + '<label style="margin-top:8px;">Max Pages Per Run</label><input id="wMaxPages" value="' + safe(String((model.crawl && model.crawl.maxPagesPerRun) || 50)) + '" />'
          + '</div>'
          + '</div>'
          + '<label style="margin-top:8px;">Extraction Fields JSON Array</label><textarea id="wFields" rows="8" class="mono">' + safe(JSON.stringify((model.extraction && model.extraction.fields) || [], null, 2)) + '</textarea>'
          + '<label style="margin-top:8px;">Required Fields</label><textarea id="wRequiredFields" rows="3">' + safe(((model.extraction && model.extraction.requiredFields) || []).join('\n')) + '</textarea>'
          + '<div class="toolbar" style="margin-top:10px;">'
          + '<button id="wizardSave">Save Draft</button>'
          + '<button id="wizardValidate">Validate + Policy Check</button>'
          + '<button id="wizardCreate" class="button warn">Create Source</button>'
          + '</div>'
          + '<pre id="wizardOutput" class="mono" style="margin-top:10px; min-height:120px;"></pre>'
          + '</section>';

        const collectModel = () => ({
          basic: {
            sourceName: document.getElementById('wSourceName').value,
            baseUrl: document.getElementById('wBaseUrl').value,
            allowedDomains: parseList(document.getElementById('wDomains').value),
            scheduleInterval: document.getElementById('wInterval').value
          },
          crawl: {
            entrypoints: parseList(document.getElementById('wEntrypoints').value),
            internalLinkPatterns: parseList(document.getElementById('wLinks').value),
            maxDepth: Number(document.getElementById('wDepth').value || 2),
            maxPagesPerRun: Number(document.getElementById('wMaxPages').value || 50)
          },
          fetch: { mode: 'http-only' },
          authentication: { type: 'none' },
          extraction: {
            fields: JSON.parse(document.getElementById('wFields').value || '[]'),
            requiredFields: parseList(document.getElementById('wRequiredFields').value),
            entityIdentityRule: 'id'
          },
          output: {
            eventTypes: ['entity.changed'],
            retentionDays: 30,
            exportRestrictions: {}
          }
        });

        document.getElementById('wizardSave').addEventListener('click', async () => {
          const nextDraft = collectModel();
          await client.patch('/admin/api/onboarding/drafts/' + encodeURIComponent(draft.id), { draft: nextDraft, stepIndex: draft.stepIndex });
          document.getElementById('wizardOutput').textContent = 'Draft saved at ' + new Date().toISOString();
        });

        document.getElementById('wizardValidate').addEventListener('click', async () => {
          const nextDraft = collectModel();
          const result = await client.post('/admin/api/onboarding/drafts/' + encodeURIComponent(draft.id) + '/validate', { draft: nextDraft, stepIndex: 6 });
          document.getElementById('wizardOutput').textContent = JSON.stringify(result, null, 2);
        });

        document.getElementById('wizardCreate').addEventListener('click', async () => {
          const nextDraft = collectModel();
          await client.patch('/admin/api/onboarding/drafts/' + encodeURIComponent(draft.id), { draft: nextDraft, stepIndex: 7 });
          const result = await client.post('/admin/api/onboarding/drafts/' + encodeURIComponent(draft.id) + '/create-source', {});
          state.selectedSourceId = result.sourceId;
          setRoute('source-detail');
        });
      }

      async function renderRoute() {
        try {
          if (!auth.tenant || !auth.token) {
            renderSimple('Authentication Required', 'Enter tenant slug and service token in the sidebar to access admin APIs.');
            return;
          }

          await loadBootstrap();

          if (state.route === 'dashboard') return renderDashboard();
          if (state.route === 'sources') return renderSources();
          if (state.route === 'source-detail') return renderSourceDetail();
          if (state.route === 'runs') return renderRuns();
          if (state.route === 'changes') return renderChanges();
          if (state.route === 'sessions') return renderSessions();
          if (state.route === 'webhooks') return renderWebhooks();
          if (state.route === 'tenants') return renderTenants();
          if (state.route === 'diagnostics') return renderDiagnostics();
          if (state.route === 'replay') return renderReplay();
          if (state.route === 'policies') return renderSimple('Policies', 'Policy editing and enforcement are available in source detail and onboarding validation.');
          if (state.route === 'audit-logs') return renderSimple('Audit Logs', 'Use source detail and diagnostics for scoped audit traces.');
          if (state.route === 'settings') return renderSimple('Settings', 'Tenant credentials and route deep links are supported. Additional settings can be added without architecture changes.');
          return renderSimple('View Not Found', 'Unknown route.');
        } catch (error) {
          renderError(error);
        }
      }

      function render() {
        renderNav();
        renderRoute();
      }

      document.getElementById('tenantSlug').value = auth.tenant;
      document.getElementById('serviceToken').value = auth.token;

      document.getElementById('saveAuth').addEventListener('click', () => {
        auth.set(document.getElementById('tenantSlug').value.trim(), document.getElementById('serviceToken').value.trim());
        renderRoute();
      });

      window.addEventListener('hashchange', () => {
        readRouteFromHash();
        render();
      });

      readRouteFromHash();
      render();
    </script>
  </body>
</html>
`;
