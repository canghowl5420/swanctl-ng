'use strict';
'require view';
'require ui';
'require dom';
'require strongswan-swanctl.api as api';

function card(label, value, sub) {
	return E('div', { 'class': 'cbi-section' }, [
		E('div', { 'style': 'font-size:1.6em;font-weight:600' }, [ value ?? '-' ]),
		E('div', {}, [ label ]),
		sub ? E('div', { 'class': 'cbi-value-description' }, [ sub ]) : ''
	]);
}

function button(label, style, handler) {
	return E('button', {
		'class': 'btn cbi-button %s'.format(style),
		'click': ui.createHandlerFn(null, handler)
	}, [ label ]);
}

function statusBadge(service) {
	const running = service == 'running';
	return E('span', {
		'class': 'label %s'.format(running ? 'success' : 'warning'),
		'style': 'padding:.2em .6em;border-radius:3px'
	}, [ running ? _('Running') : _('Stopped') ]);
}

function listConnections(conns) {
	const map = {};

	(conns ?? []).forEach(function(item) {
		const name = Object.keys(item)[0];
		if (name)
			map[name] = item[name];
	});

	return map;
}

function stateOf(sa) {
	return sa?.state ?? _('INACTIVE');
}

function renderConnectionTable(conns, sas) {
	const rows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Connection')),
			E('th', { 'class': 'th' }, _('State')),
			E('th', { 'class': 'th' }, _('Local addresses')),
			E('th', { 'class': 'th' }, _('Remote addresses')),
			E('th', { 'class': 'th' }, _('Children'))
		])
	];

	const connMap = listConnections(conns);
	const saMap = listConnections(sas);

	Object.keys(connMap).sort().forEach(function(name) {
		const conn = connMap[name] || {};
		const sa = saMap[name];
		const children = conn.children ? Object.keys(conn.children) : [];
		const local = Array.isArray(conn.local_addrs) ? conn.local_addrs.join(', ') : (conn.local_addrs || '-');
		const remote = Array.isArray(conn.remote_addrs) ? conn.remote_addrs.join(', ') : (conn.remote_addrs || '-');

		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [ name ]),
			E('td', { 'class': 'td' }, [ stateOf(sa) ]),
			E('td', { 'class': 'td' }, [ local ]),
			E('td', { 'class': 'td' }, [ remote ]),
			E('td', { 'class': 'td' }, [ children.length ? children.join(', ') : '-' ])
		]));
	});

	if (rows.length == 1) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'colspan': 5 }, _('No connections are loaded.'))
		]));
	}

	return E('table', { 'class': 'table' }, rows);
}

function handleService(action) {
	return api.service(action).then(api.unwrap).then(function(result) {
		api.notifySuccess(_('Service action "%s" completed.').format(action));
		window.location.reload();
	}).catch(api.notifyError);
}

function handleActivate(name) {
	if (!name)
		return;

	return api.activate(name).then(api.unwrap).then(function(result) {
		api.notifySuccess(_('Activated configuration "%s".').format(name));
		window.location.reload();
	}).catch(api.notifyError);
}

function handleIsolate() {
	if (!window.confirm(_('Move all other conf.d files to conf.d.disabled?')))
		return;

	return api.isolate().then(api.unwrap).then(function(result) {
		api.notifySuccess(_('Moved %d file(s).').format(result.moved.length));
		window.location.reload();
	}).catch(api.notifyError);
}

return view.extend({
	load: function() {
		return api.status().then(api.unwrap);
	},

	render: function(result) {
		const service = result.service;
		const version = result.version || {};
		const stats = result.stats || {};
		const uptime = stats.uptime?.since
			? (Date.now() - new Date(stats.uptime.since).getTime()) / 1000
			: null;
		const profiles = result.profiles || [];
		const active = result.profile || '';
		const conflicts = result.conflicts || [];
		const errors = result.errors || [];

		const select = E('select', { 'class': 'cbi-input-select', 'id': 'active-profile' },
			profiles.map(function(p) {
				return E('option', { 'value': p.name, 'selected': p.name == active ? 'selected' : null }, [
					p.name + (p.active ? ' (' + _('active') + ')' : '')
				]);
			})
		);

		const sections = [
			E('h2', _('IPsec Status')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', [
					_('Service: '),
					statusBadge(service),
					' ',
					E('span', { 'class': 'cbi-value-description' }, [
						_('Active configuration: %s').format(active || _('none'))
					])
				]),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap' }, [
						button(_('Start'), 'cbi-button-positive', function() { return handleService('start'); }),
						button(_('Stop'), 'cbi-button-negative', function() { return handleService('stop'); }),
						button(_('Restart'), 'cbi-button-action', function() { return handleService('restart'); }),
						button(_('Reload configuration'), 'cbi-button-action', function() { return handleService('reload'); })
					])
				])
			]),
			E('div', { 'style': 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1em;margin:1em 0' }, [
				card(_('strongSwan'), version.version || '-', version.daemon || ''),
				card(_('Uptime'), uptime != null ? api.formatTime(uptime) : '-'),
				card(_('IKE SAs'), stats.ikesas?.total ?? '-', _('Half-open: %s').format(stats.ikesas?.['half-open'] ?? '-')),
				card(_('Plugins'), result.plugins?.length ?? 0, result.has_swanmon ? _('swanmon available') : _('text mode'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Active configuration')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('p', _('The selected profile is copied to /etc/swanctl/conf.d/active.conf and the service is reloaded.')),
					E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;align-items:center' }, [
						profiles.length ? select : E('em', _('No configuration profiles yet.')),
						profiles.length ? button(_('Activate'), 'cbi-button-apply', function() {
							return handleActivate(select.value);
						}) : ''
					])
				])
			])
		];

		if (conflicts.length) {
			sections.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', _('These additional conf.d files are also loaded by strongSwan: %s').format(conflicts.join(', '))),
				E('p', _('If they are not intended, move them to conf.d.disabled.')),
				button(_('Disable other conf.d files'), 'cbi-button-negative', handleIsolate)
			]));
		}

		if (result.uci_connections > 0) {
			sections.push(E('div', { 'class': 'alert-message warning' }, [
				E('p', _('The UCI ipsec configuration still contains %d connection(s). They are loaded in addition to the file-based profiles; keep only one source of truth.').format(result.uci_connections))
			]));
		}

		if (errors.length) {
			sections.push(E('div', { 'class': 'alert-message warning' }, [
				E('h4', _('Status query warnings')),
				E('ul', errors.map(function(e) { return E('li', e); }))
			]));
		}

		sections.push(E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Connections')),
			renderConnectionTable(result.conns, result.sas)
		]));

		if (!result.has_swanmon && result.raw_stats) {
			sections.push(E('div', { 'class': 'cbi-section' }, [
				E('h3', _('swanctl --stats')),
				E('pre', { 'style': 'white-space:pre-wrap' }, [ result.raw_stats ])
			]));
		}

		sections.push(E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Installed plugins')),
			E('p', { 'class': 'cbi-value-description' }, [
				_('%d plugin(s) found under /usr/lib/ipsec/plugins.').format(result.plugins?.length ?? 0)
			]),
			E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:.35em' },
				(result.plugins || []).map(function(p) {
					return E('code', { 'style': 'padding:.15em .4em;border:1px solid var(--border-color);border-radius:3px' }, [ p ]);
				})
			)
		]));

		return E('div', sections);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
