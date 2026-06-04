<div align="center">

# robot 🤖

### A little robot lives in your terminal. It walks, dances, and plays slots.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![zsh](https://img.shields.io/badge/shell-zsh-89e051.svg)](https://www.zsh.org/)
[![Plugin managers](https://img.shields.io/badge/plugin-antidote%20%7C%20zinit%20%7C%20sheldon%20%7C%20omz-purple.svg)](#plugin-manager)

</div>

---

A terminal toy in the spirit of [`cmatrix`](https://github.com/abishekvashok/cmatrix)
and `sl` — except it's an ASCII robot mascot. It walks back and forth, blinks,
waves, naps under the moon, shoots hoops, goes fishing, gets abducted by a UFO,
and — if you press `Space` — pulls a slot-machine lever. 🎰

```sh
robot
```

---

## ✨ What it does

- 🤖 **20+ hand-drawn animations.** Walk, dance, jump, sleep, campfire, garden, concert, photoshoot…
- ⬆️⬇️ **Cycle on demand.** Step through every animation with the arrow keys.
- 🎰 **Slot-machine easter egg.** `Space` pulls the lever — three 7s is the jackpot.
- ⚙️ **Settings panel.** `→` opens settings; check for updates or enable auto-update.
- 🪶 **Pure zsh.** No daemon, no cache, no dependencies beyond `zsh`.

---

## 🚀 Install

### One-liner

```sh
curl -fsSL https://raw.githubusercontent.com/egor-xyz/robot/main/install.sh | bash
```

Re-run the same line later to update — the installer pins your local copy to the
latest [GitHub Release](https://github.com/egor-xyz/robot/releases) tag.

### Plugin manager

<details>
<summary><b>antidote / antibody</b></summary>

```zsh
antidote bundle egor-xyz/robot
```
</details>

<details>
<summary><b>zinit</b></summary>

```zsh
zinit light egor-xyz/robot
```
</details>

<details>
<summary><b>sheldon</b></summary>

`~/.config/sheldon/plugins.toml`:

```toml
[plugins.robot]
github = "egor-xyz/robot"
```
</details>

<details>
<summary><b>oh-my-zsh</b> (custom plugin)</summary>

```sh
git clone https://github.com/egor-xyz/robot.git \
  ~/.oh-my-zsh/custom/plugins/robot
```

Then add `robot` to your `plugins=(...)` line.
</details>

<details>
<summary><b>Manual</b></summary>

```sh
git clone https://github.com/egor-xyz/robot.git ~/.robot
echo 'source ~/.robot/robot.plugin.zsh' >> ~/.zshrc
```
</details>

---

## 🎮 Controls

| Key         | Action                              |
| ----------- | ----------------------------------- |
| `↑` / `↓`   | Cycle animations (also `k` / `j`)   |
| `→`         | Open settings                       |
| `←`         | Back to the robot (from settings)   |
| `Space`     | 🎰 Slot machine                     |
| `q` / `Esc` | Quit                                |

---

## 📋 Requirements

- `zsh` ≥ 5.0
- `git` + `curl` — only for the optional self-update

---

## ⚙️ Settings

Open the settings panel with `→`, or set the variable in `~/.zshrc` before
sourcing the plugin.

| Variable             | Default | Effect                                                              |
| -------------------- | ------- | ------------------------------------------------------------------- |
| `ROBOT_AUTO_UPDATE`  | `0`     | `1` fetches tags and checks out the latest GitHub Release in the background, once per launch. Visible on next launch. |

Settings toggled in the panel persist to `~/.config/robot/settings`.

## 📦 Versioning

Versions follow [Semantic Versioning](https://semver.org/) and are derived from
the closest tag at plugin load. Both the installer and the in-shell updater pin
to the latest published [GitHub Release](https://github.com/egor-xyz/robot/releases)
— never the tip of `main`. Releases are cut automatically by `semantic-release`
from [Conventional Commits](https://www.conventionalcommits.org/) PR titles.

---

<div align="center">

Made with 🤖 by [@egor-xyz](https://github.com/egor-xyz) · MIT

</div>
