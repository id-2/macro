#!/bin/sh
# The repository root is bind-mounted at /app, so the container sees the host's
# macOS node_modules. workerd and esbuild pick their platform package from that
# host install (@cloudflare/workerd-darwin-arm64, @esbuild/darwin-arm64) and
# refuse to start on Linux.
#
# The image therefore carries Linux copies of those two platform packages under
# /opt/linux-platform, which NODE_PATH puts on the resolution path after
# /app/node_modules. Refresh them whenever the mounted version no longer
# matches, so a dependency bump on the host does not resurrect the platform
# error.
set -eu

case "$(uname -m)" in
	aarch64 | arm64) linux_arch=arm64 ;;
	x86_64 | amd64) linux_arch=64 ;;
	*)
		echo "ai-editing-worker: unsupported architecture $(uname -m)" >&2
		exit 1
		;;
esac

# install_linux_package <mounted manifest> <install prefix> <linux package name>
# Installs the Linux package at the exact version the mounted one reports.
install_linux_package() {
	mounted_manifest=$1
	prefix=$2
	package=$3
	[ -f "$mounted_manifest" ] || return 0
	wanted=$(node -p "require('$mounted_manifest').version")
	installed_manifest="$prefix/node_modules/$package/package.json"
	installed=""
	if [ -f "$installed_manifest" ]; then
		installed=$(node -p "require('$installed_manifest').version" 2>/dev/null || true)
	fi
	if [ "$installed" != "$wanted" ]; then
		echo "ai-editing-worker: installing $package@$wanted" >&2
		npm install --prefix "$prefix" --no-save --no-package-lock \
			"$package@$wanted" >&2
	fi
}

install_linux_package /app/node_modules/workerd/package.json \
	/opt/linux-platform/workerd "@cloudflare/workerd-linux-$linux_arch"
install_linux_package /app/node_modules/wrangler/node_modules/esbuild/package.json \
	/opt/linux-platform/esbuild "@esbuild/linux-$linux_arch"

exec "$@"
