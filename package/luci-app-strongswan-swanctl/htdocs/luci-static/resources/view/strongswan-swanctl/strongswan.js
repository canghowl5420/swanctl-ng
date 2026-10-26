'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require tools.widgets as widgets';

function addLogLevel(o) {
	o.value('', _('Use daemon default'));
	o.value('-1', '%s: %s'.format('-1', _('Absolutely silent')));
	o.value('0', '%s: %s'.format('0', _('Very basic auditing logs')));
	o.value('1', '%s: %s'.format('1', _('Generic control flow with errors (default)')));
	o.value('2', '%s: %s'.format('2', _('More detailed debugging control flow')));
	o.value('3', '%s: %s'.format('3', _('Including RAW data dumps in hex')));
	o.value('4', '%s: %s'.format('4', _('Also include sensitive material in dumps, e.g. keys')));
	o.default = '';
}

function profileCheckText(result) {
	if (!result)
		return '';

	const stdout = result.stdout || '';
	const stderr = result.stderr || '';

	return (stdout + stderr).trim();
}

function renderProfileSection(profile, result) {
	const output = E('pre', {
		'style': 'white-space:pre-wrap;margin:.5em 0 0'
	}, profileCheckText(result));
	const message = E('p');
	const alert = E('div', { 'class': 'alert-message' }, [message]);

	function update(result) {
		const ok = result && result.code === 0;

		alert.className = ok ? 'alert-message success' : 'alert-message warning';
		message.textContent = ok
			? _('All required strongSwan packages are installed.')
			: _('Some required packages are missing. See the output below.');
		output.textContent = profileCheckText(result);
	}

	update(result);

	const button = E('button', {
		'class': 'btn cbi-button',
		'click': ui.createHandlerFn(null, function () {
			return fs.exec('/usr/sbin/swanctl-profile-check', [profile]).then(function (result) {
				update(result);
			}).catch(function (e) {
				alert.className = 'alert-message warning';
				message.textContent = e.message;
				output.textContent = '';
			});
		})
	}, _('Check again'));

	return E('div', { 'class': 'cbi-section' }, [
		E('h2', _('Installation profile')),
		E('div', { 'class': 'cbi-section-node' }, [
			E('p', [
				E('strong', _('Profile: ')),
				profile || _('unknown')
			]),
			alert,
			output,
			E('div', { 'style': 'margin-top:.75em' }, [button])
		])
	]);
}

return view.extend({
	load: function () {
		return L.resolveDefault(fs.read('/etc/swanctl.profile'), 'unknown').then(function (profile) {
			profile = (profile || '').trim() || 'unknown';

			return Promise.all([
				uci.load('ipsec').then(function () {
					let save = false;
					if (uci.get('ipsec', 'globals') == null) {
						uci.add('ipsec', 'globals', 'globals');
						save = true;
					}

					if (uci.get('ipsec', 'syslog') == null) {
						uci.add('ipsec', 'syslog', 'syslog');
						save = true;
					}

					if (uci.get('ipsec', 'netlink') == null) {
						uci.add('ipsec', 'netlink', 'netlink');
						save = true;
					}

					if (save)
						uci.save();
				}),
				profile,
				L.resolveDefault(fs.exec('/usr/sbin/swanctl-profile-check', [profile]), null)
			]).then(function (results) {
				return {
					profile: results[1],
					check: results[2]
				};
			});
		});
	},
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('Service configuration'),
			_('On this page, you can configure the IPsec service.'));
		m.tabbed = true;

		// general settings
		s = m.section(form.NamedSection, 'globals', 'globals', _('General Settings'),
			_('Configure global service parameters.'));

		o = s.option(widgets.NetworkSelect, 'interface', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic.') + '<br /> ' +
			_('Select an interface or leave empty for all interfaces.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;

		// syslog plugin settings
		s = m.section(form.NamedSection, 'syslog', 'syslog', _('Syslog Settings'),
			_('Configure how strongswan logs events, errors, and debug information.'));

		o = s.option(form.ListValue, 'app', 'app', _('Applications other than daemons'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'asn', 'asn', _('Low-level encoding/decoding (ASN.1, X.509 etc.)'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'cfg', 'cfg', _('Configuration management and plugins'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'chd', 'chd', _('CHILD_SA/IPsec_SA'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'dmn', 'dmn', _('Main daemon setup/cleanup/signal handling'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'enc', 'enc', _('Packet encoding/decoding encryption/decryption operations'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'esp', 'esp', '%s (%s)'.format(_('Library messages'), 'libipsec'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'ike', 'ike', _('IKE_SA / ISAKMP SA'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'imc', 'imc', _('Integrity Measurement Collector'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'imv', 'imv', _('Integrity Measurement Verifier'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'job', 'job', _('Jobs queuing/processing and thread pool management'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'wch', 'wch', _('File descriptor watcher'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'knl', 'knl', _('IPsec/Networking kernel interface'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'lib', 'lib', '%s (%s)'.format(_('Library messages'), 'libstrongswan'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'mgr', 'mgr', _('IKE_SA manager, handling synchronization for IKE_SA access'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'net', 'net', _('IKE network communication'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'pts', 'pts', _('Platform Trust Service'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'tls', 'tls', '%s (%s)'.format(_('Library messages'), 'libtls'));
		addLogLevel(o);

		o = s.option(form.ListValue, 'tnc', 'tnc', _('Trusted Network Connect'));
		addLogLevel(o);

		// kernel-netlink plugin settings
		s = m.section(form.NamedSection, 'netlink', 'netlink', _('Netlink Settings'),
			_('Configure the kernel-netlink plugin options.'));

		o = s.option(form.Flag, 'install_routes_xfrmi', _('Install routes via XFRM interfaces'),
			_('When this is enabled, the routes for all XFRM interfaces are set automatically.'));
		o.default = '0';

		const profileSection = result
			? renderProfileSection(result.profile, result.check)
			: null;

		return m.render().then(function (node) {
			if (profileSection)
				node.insertBefore(profileSection, node.firstChild);

			return ikev1.prepend(node);
		});
	}
});
