# Copyright 2021 Nicholas Smith (nicholas@nbembedded.com)
# Copyright (C) 2023 TDT AG <development@tdt.de>
# Copyright (C) 2026 ImmortalWrt swanctl-ng contributors
#
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-strongswan-swanctl
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Nicholas Smith <nicholas@nbembedded.com>, Lukas Voegl <lvoegl@tdt.de>

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-strongswan-swanctl
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for strongSwan via swanctl
  DEPENDS:=+luci-base +strongswan +strongswan-charon +strongswan-swanctl +strongswan-mod-vici +xfrm +luci-proto-xfrm
  PKGARCH:=all
  VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
  URL:=https://github.com/immortalwrt/luci
endef

define Package/luci-app-strongswan-swanctl/description
 Status and configuration for strongSwan based on swanctl.

 This is the UI core. Install exactly one of the -default, -full or -minimal
 profile packages; they provide the charon daemon and the crypto modules.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./htdocs $(PKG_BUILD_DIR)/
	$(CP) ./root $(PKG_BUILD_DIR)/
	$(CP) ./po $(PKG_BUILD_DIR)/
endef

# 编译期把 po/zh_Hans 重新编成 .lmo；没有 po2lmo 时退回仓库里预编译的那份
define Build/Compile
	if [ -x "$(STAGING_DIR_HOST)/bin/po2lmo" ]; then \
		$(STAGING_DIR_HOST)/bin/po2lmo \
			$(PKG_BUILD_DIR)/po/zh_Hans/strongswan-swanctl.po \
			$(PKG_BUILD_DIR)/root/usr/lib/lua/luci/i18n/strongswan-swanctl.zh-cn.lmo; \
	else \
		echo "po2lmo not found, keep prebuilt lmo"; \
	fi
endef

define Package/luci-app-strongswan-swanctl/install
	$(INSTALL_DIR) $(1)/www
	$(CP) $(PKG_BUILD_DIR)/htdocs/* $(1)/www/
	$(INSTALL_DIR) $(1)/
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
	$(INSTALL_DIR) $(1)/etc/swanctl/profiles
	$(INSTALL_DIR) $(1)/etc/swanctl/conf.d
	$(INSTALL_DIR) $(1)/etc/swanctl/conf.d.disabled
endef

define Package/luci-app-strongswan-swanctl/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	if [ -f /etc/swanctl/swanctl.conf ] &&
	   ! grep -qE '^[[:space:]]*include[[:space:]]+conf\.d/\*\.conf' /etc/swanctl/swanctl.conf; then
		printf '\ninclude conf.d/*.conf\n' >> /etc/swanctl/swanctl.conf
	fi

	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	/etc/init.d/rpcd reload 2>/dev/null
}
exit 0
endef

# ---------------------------------------------------------------------------
# Installation profiles
#
# opkg/apk cannot prompt for "choose one of three" during installation, so the
# choice is expressed as three mutually exclusive meta packages. The UI core
# above is installed as their common dependency; the profile packages only
# carry the strongSwan dependency set and a marker file.
# ---------------------------------------------------------------------------

define Package/luci-app-strongswan-swanctl-default
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=strongSwan swanctl (default profile)
  DEPENDS:=+luci-app-strongswan-swanctl \
	+strongswan-default \
	+swanmon \
	+strongswan-mod-gcm \
	+strongswan-mod-chapoly \
	+strongswan-mod-curve25519 \
	+strongswan-mod-pkcs8 \
	+strongswan-mod-pkcs12 \
	+strongswan-mod-sha3
  PKGARCH:=all
  VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
endef

define Package/luci-app-strongswan-swanctl-default/description
 Default strongSwan profile for the swanctl LuCI application.

 Includes the upstream strongswan-default meta package plus modern IKEv2
 ciphers (AES-GCM, ChaCha20-Poly1305, X25519) and PKCS#8/PKCS#12 key
 support. This is the recommended profile for routers with enough flash.
endef

define Package/luci-app-strongswan-swanctl-full
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=strongSwan swanctl (full profile)
  DEPENDS:=+luci-app-strongswan-swanctl +strongswan-full +swanmon
  PKGARCH:=all
  VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
endef

define Package/luci-app-strongswan-swanctl-full/description
 Full strongSwan profile for the swanctl LuCI application.

 Installs the upstream strongswan-full meta package, including EAP, PKCS#11,
 SQL/LDAP and the other optional plugins. This is large; make sure the
 overlay has enough free space before installing it.
endef

define Package/luci-app-strongswan-swanctl-minimal
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=strongSwan swanctl (minimal profile)
  DEPENDS:=+luci-app-strongswan-swanctl \
	+strongswan-minimal \
	+strongswan-mod-vici \
	+strongswan-mod-attr \
	+strongswan-mod-pem \
	+strongswan-mod-pkcs1 \
	+strongswan-mod-pkcs8 \
	+strongswan-mod-sha2 \
	+strongswan-mod-kdf \
	+strongswan-mod-gcm
  PKGARCH:=all
  VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
endef

define Package/luci-app-strongswan-swanctl-minimal/description
 Minimal strongSwan profile for the swanctl LuCI application.

 Starts from strongswan-minimal and adds the packages the LuCI app needs:
 swanctl/VICI, attr for pools and virtual IPs, PEM/PKCS key parsing, SHA-2,
 KDF and AES-GCM. swanmon is deliberately not installed because it pulls in
 GLib; the UI falls back to text output on this profile.
endef

# Marker file read by /usr/sbin/swanctl-profile-check and the LuCI UI.
define Package/luci-app-strongswan-swanctl-default/install
	$(INSTALL_DIR) $(1)/etc
	echo default > $(1)/etc/swanctl.profile
endef

define Package/luci-app-strongswan-swanctl-full/install
	$(INSTALL_DIR) $(1)/etc
	echo full > $(1)/etc/swanctl.profile
endef

define Package/luci-app-strongswan-swanctl-minimal/install
	$(INSTALL_DIR) $(1)/etc
	echo minimal > $(1)/etc/swanctl.profile
endef

define Package/luci-app-strongswan-swanctl-default/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -f /etc/swanctl.profile ] || exit 0
current="$$(cat /etc/swanctl.profile 2>/dev/null)"
[ "$$current" = "default" ] && exit 0
echo "Another swanctl profile ('$$current') is installed. Remove it before installing the default profile." >&2
exit 1
endef

define Package/luci-app-strongswan-swanctl-full/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -f /etc/swanctl.profile ] || exit 0
current="$$(cat /etc/swanctl.profile 2>/dev/null)"
[ "$$current" = "full" ] && exit 0
echo "Another swanctl profile ('$$current') is installed. Remove it before installing the full profile." >&2
exit 1
endef

define Package/luci-app-strongswan-swanctl-minimal/preinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ -f /etc/swanctl.profile ] || exit 0
current="$$(cat /etc/swanctl.profile 2>/dev/null)"
[ "$$current" = "minimal" ] && exit 0
echo "Another swanctl profile ('$$current') is installed. Remove it before installing the minimal profile." >&2
exit 1
endef

define Package/luci-app-strongswan-swanctl-default/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ "$$(cat /etc/swanctl.profile 2>/dev/null)" = "default" ] && rm -f /etc/swanctl.profile
exit 0
endef

define Package/luci-app-strongswan-swanctl-full/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ "$$(cat /etc/swanctl.profile 2>/dev/null)" = "full" ] && rm -f /etc/swanctl.profile
exit 0
endef

define Package/luci-app-strongswan-swanctl-minimal/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
[ "$$(cat /etc/swanctl.profile 2>/dev/null)" = "minimal" ] && rm -f /etc/swanctl.profile
exit 0
endef

$(eval $(call BuildPackage,luci-app-strongswan-swanctl))
$(eval $(call BuildPackage,luci-app-strongswan-swanctl-default))
$(eval $(call BuildPackage,luci-app-strongswan-swanctl-full))
$(eval $(call BuildPackage,luci-app-strongswan-swanctl-minimal))
