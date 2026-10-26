'use strict';
'require view';
'require ui';
'require strongswan-swanctl.api as api';

function button(label, style, handler) {
	return E('button', {
		'class': 'btn cbi-button %s'.format(style),
		'click': ui.createHandlerFn(null, handler)
	}, [ label ]);
}

function readFile(file) {
	return new Promise(function(resolve, reject) {
		const reader = new FileReader();
		reader.onload = function() { resolve(reader.result); };
		reader.onerror = function() { reject(new Error(_('Failed to read the file.'))); };
		reader.readAsText(file);
	});
}

function activate(name) {
	return api.activate(name).then(api.unwrap).then(function() {
		api.notifySuccess(_('Activated configuration "%s".').format(name));
		window.location.reload();
	}).catch(api.notifyError);
}

function remove(name) {
	if (!window.confirm(_('Delete configuration "%s"?').format(name)))
		return;

	return api.remove(name).then(api.unwrap).then(function() {
		api.notifySuccess(_('Deleted configuration "%s".').format(name));
		window.location.reload();
	}).catch(api.notifyError);
}

function edit(name) {
	window.location.href = L.url('admin/vpn/strongswan-swanctl/editor') +
		'?name=' + encodeURIComponent(name);
}

function renderTable(profiles) {
	const rows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Name')),
			E('th', { 'class': 'th' }, _('Size')),
			E('th', { 'class': 'th' }, _('Modified')),
			E('th', { 'class': 'th' }, _('State')),
			E('th', { 'class': 'th' }, _('Actions'))
		])
	];

	profiles.forEach(function(p) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [ p.name ]),
			E('td', { 'class': 'td' }, [ api.formatBytes(p.size) ]),
			E('td', { 'class': 'td' }, [ api.formatDate(p.mtime) ]),
			E('td', { 'class': 'td' }, [ p.active ? _('Active') : _('Inactive') ]),
			E('td', { 'class': 'td' }, [
				p.active ? '' : button(_('Activate'), 'cbi-button-positive', function() { return activate(p.name); }),
				' ',
				button(_('Edit'), 'cbi-button-action', function() { edit(p.name); }),
				' ',
				p.active ? '' : button(_('Delete'), 'cbi-button-negative', function() { return remove(p.name); })
			])
		]));
	});

	if (!profiles.length) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'colspan': 5 }, _('No configuration profiles yet. Upload one or generate one.'))
		]));
	}

	return E('table', { 'class': 'table' }, rows);
}

return view.extend({
	load: function() {
		return api.profiles().then(api.unwrap);
	},

	render: function(result) {
		const profiles = result.profiles || [];
		const conflicts = result.conflicts || [];
		const input = E('input', {
			'type': 'file',
			'id': 'config-file',
			'accept': '.conf,text/plain',
			'class': 'cbi-input-file'
		});
		const nameInput = E('input', {
			'type': 'text',
			'id': 'config-name',
			'class': 'cbi-input-text',
			'placeholder': _('Profile name (without .conf)')
		});
		const activateInput = E('input', {
			'type': 'checkbox',
			'id': 'config-activate',
			'checked': 'checked'
		});

		function handleUpload() {
			const file = input.files?.[0];
			if (!file)
				return api.notifyError(new Error(_('Please select a configuration file.')));
			if (file.size > 256 * 1024)
				return api.notifyError(new Error(_('The file is larger than 256 KiB.')));

			let name = nameInput.value.trim();
			if (!name) {
				name = file.name.replace(/\.conf$/i, '');
				name = name.replace(/[^A-Za-z0-9_.-]/g, '-');
				nameInput.value = name;
			}

			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(name))
				return api.notifyError(new Error(_('Invalid profile name.')));

			if (profiles.some(function(p) { return p.name == name; }) &&
			    !window.confirm(_('Configuration "%s" already exists. Overwrite it?').format(name)))
				return;

			return readFile(file).then(function(content) {
				return api.write(name, content, activateInput.checked);
			}).then(api.unwrap).then(function() {
				api.notifySuccess(_('Configuration "%s" saved.').format(name));
				window.location.reload();
			}).catch(api.notifyError);
		}

		function handleIsolate() {
			if (!window.confirm(_('Move all other conf.d files to conf.d.disabled?')))
				return;

			return api.isolate().then(api.unwrap).then(function(res) {
				api.notifySuccess(_('Moved %d file(s).').format(res.moved.length));
				window.location.reload();
			}).catch(api.notifyError);
		}

		const content = [
			E('h2', _('Configuration Files')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('Profiles are stored in /etc/swanctl/profiles. The active profile is copied to /etc/swanctl/conf.d/active.conf.')),
				renderTable(profiles)
			]),
			conflicts.length ? E('div', { 'class': 'alert-message warning' }, [
				E('p', _('Other conf.d files are also loaded: %s').format(conflicts.join(', '))),
				button(_('Disable other conf.d files'), 'cbi-button-negative', handleIsolate)
			]) : '',
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Upload configuration')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Configuration file')),
						E('div', { 'class': 'cbi-value-field' }, [ input ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Profile name')),
						E('div', { 'class': 'cbi-value-field' }, [ nameInput ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Activate after upload')),
						E('div', { 'class': 'cbi-value-field' }, [ activateInput ])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('div', { 'class': 'cbi-value-field' }, [
							button(_('Upload'), 'cbi-button-apply', handleUpload)
						])
					])
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('p', [
					_('Need a new configuration? '),
					E('a', { 'href': L.url('admin/vpn/strongswan-swanctl/generate') }, [ _('Use the generator') ])
				])
			])
		];

		return E('div', content);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
