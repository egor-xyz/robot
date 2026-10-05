<div align="center">

<img width="800" height="197" alt="CleanShot 2026-06-04 at 17 50 43" src="https://github.com/user-attachments/assets/dd10b07b-96f8-4d6f-824d-78947dfc4b27" />



# robot 🤖

### A little robot lives above your Claude Code prompt. It walks, dances, and goes fishing while Claude works.

[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)](#-install-in-claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![zsh](https://img.shields.io/badge/terminal-zsh-89e051.svg)](https://www.zsh.org/)

</div>

---

A [Claude Code](https://claude.com/claude-code) mod with an ASCII robot mascot.
It walks the full width of the band above your prompt, blinks, waves, naps under
the moon, shoots hoops, goes fishing, plants a garden and gets abducted by a UFO.

It also follows what Claude Code does. When the context gets too big, its head
catches fire. When the conversation compacts, it packs itself into a box. When
Claude asks you something, it steps aside. When Claude commits or pushes with
git, it cheers. When Claude runs subagents, it brings little WALL-E friends: one small robot per subagent.

```text
  .-----.  🐟
  [^   ^]━━/✨
  /|━━━|
   o   o  ~~~~~
```

---

## 🚀 Install in Claude Code

Type these two lines in the Claude Code prompt — that's it:

```text
/plugin marketplace add egor-xyz/robot
/plugin install robot@robot
```

Restart Claude Code and the robot appears above the prompt.

<details>
<summary>Other ways to install</summary>

**From your shell** — one line:

```sh
claude plugin marketplace add egor-xyz/robot && claude plugin install robot@robot
```

**Or just ask Claude:** _"install the robot plugin from egor-xyz/robot"_.

</details>

Works on macOS, Linux and Windows — nothing else to install.

---

## ✨ What it does

- 🤖 **20+ hand-drawn animations.** Walk, dance, jump, sleep, campfire, garden, concert, photoshoot…
- ↔️ **Full width.** The robot walks from edge to edge and follows you when you resize the window.
- 🎨 **Colour per mood.** Each animation has its own colour; dance and jump cycle a rainbow.
- 🙈 **Out of the way.** `/robot` hides it; it steps aside by itself when Claude asks you something.
- 🔥 **Feels the heat.** Past 25% context its head catches fire — [see below](#-context-on-fire).
- 📦 **Packs itself while compacting.** During `/compact` it puts itself into a box, part by part — [see below](#-compacting).
- 🚀 **Cheers your git.** A ✅ on every commit and a 🚀 on every push.
- 👯 **Brings friends.** Each running subagent is a small WALL-E robot that rolls in behind it, looks around, and rolls away when the agent ends. They hop when the robot cheers a commit. Past three, a `+1`, `+2`… shows how many more run.
- 🪶 **Tiny.** No daemon, no network, nothing to install.

---

## 👀 It follows Claude Code

The robot listens to Claude Code events and acts on them:

| When Claude Code…                              | The robot…                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| fills the context past 25%                     | catches fire and asks you to `/compact` — [more](#-context-on-fire)    |
| compacts the conversation (`/compact` or auto) | packs itself into a box until it ends — [more](#-compacting)           |
| asks you a question or shows a survey          | steps aside so it does not get in the way                              |
| clears or compacts a hot context               | cools down and goes back to play                                       |
| commits or pushes with git                     | stamps a ✅ or waves off a 🚀 for 3 seconds                              |
| runs subagents                                 | rolls in a small WALL-E friend per agent, and rolls it away at the end |

---

## 🔥 Context on fire

The robot watches your session's context window — the same number as the
status line. Once it passes **25%**, the robot drops whatever it was doing:

```text
    .🔥-🔥.
    [O   O]    context 31%
    /|━━━|\    /compact me!
     o   o
```

- 🔥 **Its head catches fire.** The head turns red, flames burn inside it and
  sparks pop beside it.
- 😱 **It panics.** Its eyes flick between `O O` and `> <`.
- 🚶 **It paces.** It walks slowly back and forth with its head on fire,
  stopping now and then to catch its breath.
- 🙌 **It talks to you — every 30 seconds.** It stops, waves its arms and types
  the live context percentage, letter by letter: _"/compact me!"_ No nagging
  in between.

Run `/compact` (or `/clear`) and it cools down at once and goes back to its
normal animations.

**Change when it catches fire:** open `/plugin` → **Installed** → **robot** → **Configure**, and set **Fire at (% context, default 25)**
to any value from 1 to 100. To turn the fire off, switch **Context on fire** off there.

---

## 📦 Compacting

While the conversation compacts — your `/compact`, or Claude Code's own
auto-compact — the robot steps to the middle and packs itself into a box, one part a second:

```text
    .-----.
    [o   o]  │       │          .-----.
    /|━━━|\  │ o   o │   →→    │[^   ^]│   →→   ┌───────┐
             └───────┘         │o|━━━|o│        │ robot │
                               └───────┘        │ ↑ ↑ ↑ │
                                                └───────┘
```

- 🦵 **Legs first**, then 🦾 **its body**, then its 🙂 **head hops in**.
- 📦 **The lid closes**, the box shakes, then it climbs back out and packs again — a loop for as long as the compaction runs, while it says _"compacting… hold on!"_
- When the compaction ends, it jumps out and goes back to what it did before.

---

## 🎮 Use it

| Command  | Action                 |
| -------- | ---------------------- |
| `/robot` | Hide or show the robot |

### Settings

Open `/plugin` → **Installed** → **robot** → **Configure**.

| Setting               | Default | Effect                                                         |
| --------------------- | ------- | -------------------------------------------------------------- |
| Context on fire (default on)    | on      | Off turns the [context-on-fire](#-context-on-fire) act off completely. |
| Fire at (% context, default 25) | `25`    | Context usage at which the head catches fire. |

### Update or remove

```text
/plugin marketplace update robot     # fetch the newest robot
/plugin update robot@robot           # switch to it
/plugin uninstall robot@robot        # remove it
```

---

## 🔧 How it works

A Claude Code mod is a small plugin that can draw inside Claude Code. This one
lives in [`claude-mod/`](claude-mod/):

1. The mod computes its frames itself, in plain TypeScript — no shell, no
   `zsh`, no other program. [`claude-mod/robot.ts`](claude-mod/robot.ts) is a
   TypeScript twin of [`functions/crazy-robot`](functions/crazy-robot): the
   same animations, timings and colours.
2. It steps one frame per tick, 4 frames a second, in the band above the
   prompt, sized to your window.
3. When you resize the window, the next frame just uses the new width.

A parity test (`claude plugin test .`) holds the twin to the real zsh frames,
tick by tick, so the two stay in step. A new animation needs the same change in
both files.

---

## 🖥️ Bonus: the robot in your terminal

The same robot also runs as a full-screen terminal toy, in the spirit of
[`cmatrix`](https://github.com/abishekvashok/cmatrix) and `sl` — with a
slot-machine easter egg. 🎰

```sh
curl -fsSL https://raw.githubusercontent.com/egor-xyz/robot/main/install.sh | bash
robot
```

Re-run the install line later to update — it pins your local copy to the latest
[GitHub Release](https://github.com/egor-xyz/robot/releases) tag.

| Key         | Action                            |
| ----------- | --------------------------------- |
| `↑` / `↓`   | Cycle animations (also `k` / `j`) |
| `→`         | Open settings                     |
| `←`         | Back to the robot (from settings) |
| `Space`     | 🎰 Slot machine                   |
| `q` / `Esc` | Quit                              |

<details>
<summary><b>Install with a zsh plugin manager</b></summary>

**antidote / antibody**

```zsh
antidote bundle egor-xyz/robot
```

**zinit**

```zsh
zinit light egor-xyz/robot
```

**sheldon** — `~/.config/sheldon/plugins.toml`:

```toml
[plugins.robot]
github = "egor-xyz/robot"
```

**oh-my-zsh** (custom plugin)

```sh
git clone https://github.com/egor-xyz/robot.git \
  ~/.oh-my-zsh/custom/plugins/robot
```

Then add `robot` to your `plugins=(...)` line.

**Manual**

```sh
git clone https://github.com/egor-xyz/robot.git ~/.robot
echo 'source ~/.robot/robot.plugin.zsh' >> ~/.zshrc
```

</details>

<details>
<summary><b>Terminal settings</b></summary>

Open the settings panel with `→`, or set the variable in `~/.zshrc` before
sourcing the plugin.

| Variable            | Default | Effect                                                                                                                |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `ROBOT_TIPS`        | `1`     | `0` hides the hint line under the robot for a cleaner screensaver.                                                    |
| `ROBOT_AUTO_UPDATE` | `0`     | `1` fetches tags and checks out the latest GitHub Release in the background, once per launch. Visible on next launch. |

Settings toggled in the panel persist to `~/.config/robot/settings`. The
terminal toy needs `zsh` ≥ 5.0, plus `git` + `curl` only for the optional
self-update.

</details>

---

## 📦 Versioning

Versions follow [Semantic Versioning](https://semver.org/) and are derived from
the closest tag. The installer and the in-shell updater pin to the latest
published [GitHub Release](https://github.com/egor-xyz/robot/releases) — never
the tip of `main`. Releases are cut automatically by `semantic-release` from
[Conventional Commits](https://www.conventionalcommits.org/) PR titles.

---

<div align="center">

Made with 🤖 by [@egor-xyz](https://github.com/egor-xyz) · MIT

</div>
