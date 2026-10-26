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

return view.extend({
	load: function() {
		const params = new URLSearchParams(window.location.search);
		const wanted = params.get('name');

		return api.profiles().then(api.unwrap).then(function(result) {
			const profiles = result.profiles || [];
			let selected = wanted;

			if (!selected || !profiles.some(function(p) { return p.name == selected; }))
				selected = result.profile || (profiles[0]?.name ?? '');

			if (!selected)
				return { profiles: profiles, selected: '', content: '', active: result.profile };

			return api.read(selected).then(api.unwrap).then(function(read) {
				return {
					profiles: profiles,
					selected: selected,
					content: read.content,
					active: result.profile
				};
			});
		});
	},

	render: function(result) {
		const profiles = result.profiles || [];
		let selected = result.selected || '';
		let active = result.active || '';
		let dirty = false;

		const select = E('select', { 'class': 'cbi-input-select', 'id': 'editor-profile' },
			profiles.map(function(p) {
				return E('option', { 'value': p.name, 'selected': p.name == selected ? 'selected' : null }, [
					p.name + (p.name == active ? ' (' + _('active') + ')' : '')
				]);
			})
		);

		const textarea = E('textarea', {
			'id': 'editor-content',
			'class': 'cbi-input-textarea',
			'spellcheck': 'false',
			'style': 'width:100%;min-height:60vh;font-family:monospace;white-space:pre;tab-size:4'
		}, [ result.content || '' ]);

		const status = E('span', { 'class': 'cbi-value-description' }, [
			selected ? _('Editing %s').format(selected) : _('No profile selected')
		]);

		textarea.addEventListener('input', function() { dirty = true; });

		function loadProfile(name) {
			if (!name)
				return;

			return api.read(name).then(api.unwrap).then(function(read) {
				selected = name;
				textarea.value = read.content;
				dirty = false;
				status.textContent = _('Editing %s').format(name);
			}).catch(api.notifyError);
		}

		function save(activate) {
			if (!selected)
				return api.notifyError(new Error(_('No profile selected.')));
			if (!textarea.value.trim())
				return api.notifyError(new Error(_('Configuration is empty.')));

			return api.write(selected, textarea.value, activate).then(api.unwrap).then(function() {
				dirty = false;
				api.notifySuccess(activate
					? _('Configuration "%s" saved and activated.').format(selected)
					: _('Configuration "%s" saved.').format(selected));
				if (activate)
					window.location.href = L.url('admin/vpn/strongswan-swanctl/overview');
			}).catch(api.notifyError);
		}

		select.addEventListener('change', function() {
			const name = select.value;

			if (dirty && !window.confirm(_('Discard unsaved changes?'))) {
				select.value = selected;
				return;
			}

			return loadProfile(name);
		});

		const content = [
			E('h2', _('Editor')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', status),
				E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;align-items:center;margin-bottom:.75em' }, [
					profiles.length ? select : E('em', _('No configuration profiles yet.')),
					button(_('Reload from disk'), 'cbi-button', function() { return loadProfile(selected); }),
					button(_('Save'), 'cbi-button-apply', function() { return save(false); }),
					button(_('Save and activate'), 'cbi-button-apply', function() { return save(true); })
				]),
				textarea,
				E('p', { 'class': 'cbi-value-description' }, [
					_('The active profile is copied to /etc/swanctl/conf.d/active.conf. Saving does not reload strongSwan until you activate or use the Reload button on the status page.')
				])
			]),
			!profiles.length ? E('div', { 'class': 'cbi-section' }, [
				E('p', [
					E('a', { 'href': L.url('admin/vpn/strongswan-swanctl/generate') }, [ _('Generate a configuration') ]),
					' ',
					_('or upload one first.')
				])
			]) : ''
		];

		return E('div', content);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
