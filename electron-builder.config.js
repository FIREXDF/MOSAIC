const { version, build } = require('./package.json');

const channel = ['alpha', 'beta'].find((name) => version.includes(name));

if (!channel) {
  module.exports = build;
} else {
  module.exports = {
    ...build,
    win: { ...build.win, icon: `assets/app-icons/${channel}/icon.ico` },
    mac: { ...build.mac, icon: `assets/app-icons/${channel}/icon.png` },
    linux: { ...build.linux, icon: `assets/app-icons/${channel}/icon.png` },
  };
}
