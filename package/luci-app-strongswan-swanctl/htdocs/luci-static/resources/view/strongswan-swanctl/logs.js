'use strict';
'require view';
'require ui';
'require poll';
'require strongswan-swanctl.api as api';

function button(label, style, handler) {
	return E('button', {
		'class': 'btn cbi-button %s'.format(style),
		'click': ui.createHandlerFn(null, handler)
	}, [ label ]);
}

return view.extend({
	load: function() {
		return api.logs(200).then(api.unwrap);
	},

	render: function(result) {
		const charon = E('pre', {
			'style': 'white-space:pre-wrap;max-height:45vh;overflow:auto;padding:1em;border:1px solid var(--border-color)'
		}, [ result.charon || _('(no log entries)') ]);
		const swanctl = E('pre', {
			'style': 'white-space:pre-wrap;max-height:30vh;overflow:auto;padding:1em;border:1px solid var(--border-color)'
		}, [ result.swanctl || _('(no log entries)') ]);
		const ipsec = E('pre', {
			'style': 'white-space:pre-wrap;max-height:30vh;overflow:auto;padding:1em;border:1px solid var(--border-color)'
		}, [ result.ipsec || _('(no log entries)') ]);
		const lines = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '100' }, [ '100' ]),
			E('option', { 'value': '200', 'selected': 'selected' }, [ '200' ]),
			E('option', { 'value': '500' }, [ '500' ]),
			E('option', { 'value': '1000' }, [ '1000' ])
		]);
		const auto = E('input', { 'type': 'checkbox', 'checked': 'checked' });

		function refresh() {
			return api.logs(parseInt(lines.value)).then(api.unwrap).then(function(res) {
				charon.textContent = res.charon || _('(no log entries)');
				swanctl.textContent = res.swanctl || _('(no log entries)');
				ipsec.textContent = res.ipsec || _('(no log entries)');
			}).catch(api.notifyError);
		}

		poll.add(function() {
			if (!auto.checked)
				return Promise.resolve();
			return api.logs(parseInt(lines.value)).then(api.unwrap).then(function(res) {
				charon.textContent = res.charon || _('(no log entries)');
				swanctl.textContent = res.swanctl || _('(no log entries)');
				ipsec.textContent = res.ipsec || _('(no log entries)');
			}).catch(function() {});
		}, 5);

		return E('div', [
			E('h2', _('Logs')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('Runtime logs for charon and swanctl, read with logread.')),
				E('div', { 'style': 'display:flex;gap:.75em;flex-wrap:wrap;align-items:center' }, [
					E('label', [ _('Lines: '), lines ]),
					E('label', [ auto, ' ', _('Auto refresh (5 s)') ]),
					button(_('Refresh now'), 'cbi-button', refresh)
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('charon')),
				charon
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('swanctl')),
				swanctl
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('ipsec')),
				ipsec
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
