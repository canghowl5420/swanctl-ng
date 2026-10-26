'use strict';
'require view';
'require ui';
'require strongswan-swanctl.api as api';

function field(label, input, description) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, [ label ]),
		E('div', { 'class': 'cbi-value-field' }, [
			input,
			description ? E('div', { 'class': 'cbi-value-description' }, [ description ]) : ''
		])
	]);
}

function textInput(id, value, placeholder) {
	return E('input', {
		'type': 'text',
		'id': id,
		'class': 'cbi-input-text',
		'value': value ?? '',
		'placeholder': placeholder ?? ''
	});
}

function selectInput(id, values, selected) {
	return E('select', { 'id': id, 'class': 'cbi-input-select' },
		values.map(function(v) {
			return E('option', { 'value': v[0], 'selected': v[0] == selected ? 'selected' : null }, [ v[1] ]);
		})
	);
}

function button(label, style, handler) {
	return E('button', {
		'class': 'btn cbi-button %s'.format(style),
		'click': ui.createHandlerFn(null, handler)
	}, [ label ]);
}

function quote(value) {
	return '"' + String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function splitList(value) {
	return String(value ?? '').split(/[\s,]+/).filter(function(v) { return v.length > 0; }).join(', ');
}

function buildConfig(f) {
	const lines = [];
	const version = f.ike.value == 'ikev1' ? '1' : '2';
	const conn = f.conn.value.trim();
	const child = f.child.value.trim();

	lines.push('connections {');
	lines.push('  ' + conn + ' {');
	lines.push('    version = ' + version);
	if (f.localAddr.value.trim())
		lines.push('    local_addrs = ' + splitList(f.localAddr.value));
	lines.push('    remote_addrs = ' + splitList(f.remoteAddr.value));
	lines.push('    proposals = ' + f.ikeProposal.value.trim());
	lines.push('    dpd_delay = 30s');
	lines.push('    mobike = yes');
	lines.push('');
	lines.push('    local {');
	lines.push('      auth = ' + f.auth.value);
	if (f.localId.value.trim())
		lines.push('      id = ' + quote(f.localId.value.trim()));
	if (f.auth.value == 'pubkey' && f.localCert.value.trim())
		lines.push('      certs = ' + f.localCert.value.trim());
	lines.push('    }');
	lines.push('');
	lines.push('    remote {');
	lines.push('      auth = ' + f.auth.value);
	lines.push('      id = ' + quote(f.remoteId.value.trim() || f.remoteAddr.value.trim()));
	if (f.auth.value == 'pubkey' && f.caCert.value.trim())
		lines.push('      cacerts = ' + f.caCert.value.trim());
	lines.push('    }');
	lines.push('');
	lines.push('    children {');
	lines.push('      ' + child + ' {');
	lines.push('        local_ts = ' + splitList(f.localTs.value));
	lines.push('        remote_ts = ' + splitList(f.remoteTs.value));
	lines.push('        esp_proposals = ' + f.espProposal.value.trim());
	if (f.startAction.value != 'none')
		lines.push('        start_action = ' + f.startAction.value);
	lines.push('      }');
	lines.push('    }');
	lines.push('  }');
	lines.push('}');

	if (f.auth.value == 'psk') {
		lines.push('');
		lines.push('secrets {');
		lines.push('  ike-' + conn + ' {');
		if (f.localId.value.trim())
			lines.push('    id-1 = ' + quote(f.localId.value.trim()));
		lines.push('    secret = ' + quote(f.psk.value));
		lines.push('  }');
		lines.push('}');
	}

	return lines.join('\n') + '\n';
}

return view.extend({
	load: function() {
		return api.profiles().then(api.unwrap).then(function(result) {
			return result;
		}).catch(function() {
			return { profiles: [] };
		});
	},

	render: function(result) {
		const profiles = result.profiles || [];
		const f = {
			name: textInput('gen-name', 'site-to-site', 'profile-name'),
			conn: textInput('gen-conn', 'site', 'connection-name'),
			child: textInput('gen-child', 'site-child', 'child-name'),
			ike: selectInput('gen-ike', [ [ 'ikev2', 'IKEv2' ], [ 'ikev1', 'IKEv1' ] ], 'ikev2'),
			auth: selectInput('gen-auth', [ [ 'psk', _('Pre-shared key') ], [ 'pubkey', _('Certificate / public key') ] ], 'psk'),
			remoteAddr: textInput('gen-remote', '', '203.0.113.10'),
			localAddr: textInput('gen-local', '', _('optional')),
			localId: textInput('gen-local-id', '', _('optional')),
			remoteId: textInput('gen-remote-id', '', _('optional')),
			psk: E('input', { 'type': 'password', 'id': 'gen-psk', 'class': 'cbi-input-text' }),
			localCert: textInput('gen-local-cert', '', 'site.crt'),
			caCert: textInput('gen-ca-cert', '', 'ca.crt'),
			localTs: textInput('gen-local-ts', '192.168.10.0/24', '192.168.10.0/24'),
			remoteTs: textInput('gen-remote-ts', '192.168.20.0/24', '192.168.20.0/24'),
			ikeProposal: textInput('gen-ike-proposal', 'aes256gcm16-prfsha256-ecp256', ''),
			espProposal: textInput('gen-esp-proposal', 'aes256gcm16-ecp256', ''),
			startAction: selectInput('gen-start', [ [ 'trap', 'trap' ], [ 'start', 'start' ], [ 'none', 'none' ] ], 'trap')
		};

		const preview = E('pre', {
			'style': 'white-space:pre-wrap;min-height:12em;padding:1em;border:1px solid var(--border-color);background:var(--background-color-high)'
		}, [ '' ]);

		function validate() {
			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(f.name.value.trim()))
				return _('Invalid profile name.');
			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(f.conn.value.trim()))
				return _('Invalid connection name.');
			if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(f.child.value.trim()))
				return _('Invalid child name.');
			if (!f.remoteAddr.value.trim())
				return _('Remote address is required.');
			if (!f.localTs.value.trim() || !f.remoteTs.value.trim())
				return _('Local and remote traffic selectors are required.');
			if (!f.ikeProposal.value.trim() || !f.espProposal.value.trim())
				return _('IKE and ESP proposals are required.');
			if (f.auth.value == 'psk' && !f.psk.value)
				return _('Pre-shared key is required.');
			return null;
		}

		function updatePreview() {
			const error = validate();
			preview.textContent = error ? error : buildConfig(f);
		}

		function save(activate) {
			const error = validate();
			if (error)
				return api.notifyError(new Error(error));

			const name = f.name.value.trim();
			if (profiles.some(function(p) { return p.name == name; }) &&
			    !window.confirm(_('Configuration "%s" already exists. Overwrite it?').format(name)))
				return;

			return api.write(name, buildConfig(f), activate).then(api.unwrap).then(function() {
				api.notifySuccess(activate
					? _('Configuration "%s" saved and activated.').format(name)
					: _('Configuration "%s" saved.').format(name));
				if (activate)
					window.location.href = L.url('admin/vpn/strongswan-swanctl/overview');
			}).catch(api.notifyError);
		}

		[ f.name, f.conn, f.child, f.remoteAddr, f.localAddr, f.localId, f.remoteId,
		  f.psk, f.localCert, f.caCert, f.localTs, f.remoteTs, f.ikeProposal,
		  f.espProposal ].forEach(function(input) {
			input.addEventListener('input', updatePreview);
		});
		f.ike.addEventListener('change', updatePreview);
		f.startAction.addEventListener('change', updatePreview);

		const content = [
			E('h2', _('Generate Configuration')),
			E('p', _('Generate a swanctl.conf snippet and save it as a named profile.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Connection')),
				field(_('Profile name'), f.name, _('Saved under /etc/swanctl/profiles.')),
				field(_('Connection name'), f.conn),
				field(_('Child name'), f.child),
				field(_('IKE version'), f.ike),
				field(_('Authentication'), f.auth),
				field(_('Remote address'), f.remoteAddr, _('IP address or DNS name.')),
				field(_('Local address'), f.localAddr, _('Optional; leave empty for %any.')),
				field(_('Local ID'), f.localId, _('Optional.')),
				field(_('Remote ID'), f.remoteId, _('Optional; defaults to the remote address.')),
				field(_('Pre-shared key'), f.psk, _('Only used for PSK authentication.')),
				field(_('Local certificate'), f.localCert, _('Relative to /etc/swanctl/x509.')),
				field(_('CA certificate'), f.caCert, _('Relative to /etc/swanctl/x509ca.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Traffic selectors and proposals')),
				field(_('Local traffic selectors'), f.localTs, _('Comma or space separated CIDRs.')),
				field(_('Remote traffic selectors'), f.remoteTs, _('Comma or space separated CIDRs.')),
				field(_('IKE proposals'), f.ikeProposal),
				field(_('ESP proposals'), f.espProposal),
				field(_('Start action'), f.startAction)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Preview')),
				preview,
				E('div', { 'style': 'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.75em' }, [
					button(_('Refresh preview'), 'cbi-button', updatePreview),
					button(_('Save'), 'cbi-button-apply', function() { return save(false); }),
					button(_('Save and activate'), 'cbi-button-apply', function() { return save(true); })
				])
			])
		];

		const viewNode = E('div', content);
		const authChange = function() {
			const psk = f.auth.value == 'psk';
			f.psk.closest('.cbi-value').style.display = psk ? '' : 'none';
			f.localCert.closest('.cbi-value').style.display = psk ? 'none' : '';
			f.caCert.closest('.cbi-value').style.display = psk ? 'none' : '';
			updatePreview();
		};
		f.auth.addEventListener('change', authChange);
		authChange();

		return viewNode;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
