<div align="center">

<a href="docs/media/egor-xyz-robot-demo.mp4"><img width="800" alt="The robot chills above the Claude Code prompt" src="docs/media/egor-xyz-robot-demo.gif" /></a>



# robot 🤖

### A little robot lives above your Claude Code prompt. It walks, dances, and goes fishing while Claude works.

**🌐 [egor-xyz.github.io/robot](https://egor-xyz.github.io/robot/)** — see it move

[![Claude Code mod](https://img.shields.io/badge/Claude%20Code-mod-d97757.svg)](#-install-in-claude-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![zsh](https://img.shields.io/badge/terminal-zsh-89e051.svg)](https://www.zsh.org/)
[![Website](https://img.shields.io/badge/website-egor--xyz.github.io%2Frobot-ff9d3c.svg)](https://egor-xyz.github.io/robot/)

</div>

---

A [Claude Code](https://claude.com/claude-code) mod with an ASCII robot mascot.
It walks the full width of the band above your prompt, blinks, waves, naps under
the moon, shoots hoops, goes fishing, plants a garden, puts on a cape to zap targets with eye lasers and gets abducted by a UFO.

It also follows what Claude Code does:

- 🔥 **Context too big?** Its head catches fire.
- 🧊 **Cache gone cold?** Ice cubes gather around it.
- 📦 **Compacting?** Robots and WALL-Es ride a factory line into boxes.
- 🙈 **Claude asks you something?** It steps aside.
- ✅ **Git commit or push?** It cheers.
- 👯 **Subagents running?** Little WALL-E friends roll in, one per agent.

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

The robot appears above the prompt. No restart needed.

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

- 🤖 **25+ hand-drawn animations.** Walk, dance, jump, sleep, campfire, garden, concert, photoshoot…
- 🦸 **A caped hero.** Now and then it powers up with an S on the chest, puts on a cape, flies and zaps three targets with slow eye lasers.
- 🛸 **A UFO movie.** A 🐄 walks deep into the woods, hides behind the trees and stops in a random gap. The 🛸 glides in, beams it up and zooms off while the robot panics.
- ↔️ **Full width.** The robot walks from edge to edge and follows you when you resize the window.
- 🎨 **Colour per mood.** Each animation has its own colour; dance and jump cycle a rainbow.
- 🙈 **Out of the way.** `/robot` hides it; it steps aside by itself when Claude asks you something, and while a subagent's transcript is in view. `/robot calm` slows it down and keeps only its quiet acts.
- 🎲 **Plays on command.** `/robot play` pulls the slot machine, `/robot dice` turns it into a die, `/robot coin` flips a coin. The reply tells you the result. `/robot animate ufo` plays any animation by name.
- 🔥 **Feels the heat.** Past 25% context its head catches fire — [see below](#-context-on-fire).
- 🧊 **Freezes when the cache goes cold.** After a break, ice cubes gather around it and the status line says `❄ cache cold` — [see below](#-cache-cold).
- 📦 **Runs a factory line while compacting.** During `/compact`, robots and WALL-Es pack themselves into boxes on a conveyor belt, under the spinner's "Compacting" text — [see below](#-compacting).
- 🚀 **Cheers your git.** A ✅ on every commit and a 🚀 on every push.
- 👯 **Brings friends.** Each running subagent is a small WALL-E robot that rolls in behind it, looks around, and rolls away when the agent ends. They hop when the robot cheers a commit, and now and then they high-five it or creep up and get dug back. Past three, a `+1`, `+2`… shows how many more run.
- 📊 **Custom status line.** Under the prompt: account, model, effort, branch, usage limits, cost and context — [see below](#-status-line).
- 📂 **Changed files and your PR.** One line counts the files you changed. Click it for a panel with each file and its diff; with a PR open, the files come in two groups, and the title links to the PR — [see below](#-status-line).
- 🙋 **Needs you.** When Claude ends its turn with a question, the robot dances and says _"need a human"_ in a comic bubble.
- 💬 **Robot spinner words.** One robot word per turn: _"Beaming…"_, _"Recharging…"_.
- ⚙️ **Every part has a switch.** Turn each act on or off — [see settings](#settings).
- 🪶 **Tiny.** No daemon, no network, nothing to install.

---

## 👀 It follows Claude Code

The robot listens to Claude Code events and acts on them:

| When Claude Code…                              | The robot…                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| fills the context past 25%                     | catches fire and asks you to `/compact` — [more](#-context-on-fire)    |
| compacts the conversation (`/compact` or auto) | runs a box factory line until it ends — [more](#-compacting)           |
| asks you a question or shows a survey          | steps aside so it does not get in the way                              |
| clears or compacts a hot context               | cools down and goes back to play                                       |
| commits or pushes with git                     | stamps a ✅ or waves off a 🚀 for 3 seconds                              |
| runs subagents                                 | rolls in a WALL-E friend per agent — [more](#-subagent-friends)          |
| ends its turn with a question for you          | dances and says "need a human" until you answer                        |

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

**Change when it catches fire:** set **Fire at (% context)** to any value from 1 to 100, or switch
**Context on fire** off — [how to change settings](#settings).

---

## 🧊 Cache cold

Claude keeps your chat in a short-term cache. After 1 hour with no request
(5 minutes on some accounts), the cache expires. The robot freezes:

```text
   🧊·.-----.🧊   ╭───────────────╮
      [o   o]    <  b-b-brr…      │
     */|━━━|\·    │ cache frozen! │
   🧊  o   o 🧊   ╰───────────────╯
>
 ctx 58% | opus | ❄ cache cold · 117k
```

- 🧊 **Ice cubes gather.** The robot stands still and turns blue all over. Ice
  cubes sit by its head and its feet, snow twinkles and its eyes chatter.
  Every 30 seconds it says _"b-b-brr… cache frozen!"_.
- ❄ **The status line says so.** `❄ cache cold · 117k` sits at the end of the
  line. `117k` is the context your next message re-reads.
- 💸 **The next message costs more.** It re-reads the whole context at full
  price, about 10-20 times a cache read. Only that one message pays. Then the
  cache is warm again, and the ice and the `❄` part go away.

What to do:

- Same task? Just send.
- Switching topics? `/clear` first.
- Big context you still need? `/compact` first, so the re-read is small.

The robot does not ping Claude and spends no tokens. It does not read the cache
time from Claude Code. It counts the minutes since Claude's last request. **Cache TTL** is `1h` by default. Is your cache 5 minutes (for example, an API
key)? Set it to `5m`. With `auto`, the robot assumes 5 minutes, and switches to
1 hour, also for later chats, once a chat shows a cache that lived longer. When the head is also on fire, the ice wins.

**Switch it off:** set **Cache cold** to `false` — [how to change settings](#settings).

---

## 📦 Compacting

While the conversation compacts — your `/compact`, or Claude Code's own
auto-compact — the band turns into a factory line. No text, just the belt:

```text
            .-----.
            [o   o]  │       │
            /|━━━|\  │ o   o │
                     └───────┘====>=====>=====>=====>=====>===
```

- 🤖 **One at a time, at the left.** A unit walks in from the left edge to the station, under the spinner's "Compacting" text. A robot and a WALL-E take turns; who goes first is random.
- 📦 **A new box drops in**, and the unit packs itself part by part: legs or treads first, then the body, then the head or eyes. The lid closes and the box shakes.
- ➡️ **The closed box hops onto a short belt** and rides to its end, where it drops out of sight. The belt shows only while a box is on it. Only then the next unit walks in — a loop for as long as the compaction runs.
- 🗜️ **The status line squeezes too.** Arrows push in on `ctx 25%` (`ctx ▸ 25% ◂`) until the compaction ends.
- When the compaction ends, the robot goes back to what it did before.

---

## 👯 Subagent friends

When Claude runs subagents, each one is a small WALL-E robot at the right edge of the band:

```text
                           .-----.
   (o)(o) (-)(-) (O)(o)    [o   o]
   =[##]= =[##]= =[##]=    /|━━━|\
+2 (oooo) (oooo) (oooo)     o   o
```

- 🛞 **They roll in** from the right edge when an agent starts and wait there in fixed slots. Their wheels pulse, the same as the robot's. Now and then they all step one cell left or right together.
- 👀 **They are alive.** They blink, look around and stretch their necks up now and then.
- 🎉 **They hop** when the robot cheers a git commit or push.
- 🙌 **A high five.** Now and then, with the friends settled, the robot walks over to the nearest one. Both raise a hand, slap with a spark, and all the friends hop. Then the robot walks away.
- 🚜 **An excavator.** Rarely, the friends creep toward the robot. It frowns, shakes its fists and turns into an excavator, part by part. It pushes them back to their slots, pops back into the robot with its arms up, and walks away.
- 🔥 **They panic too.** When the context is on fire, their eyes go wide.
- ➕ **Three at most.** With more agents, a `+1`, `+2`… shows how many more run.
- 👋 **They roll away** when their agent ends.

The robot walks left of their zone, so they never block the fishing rod or the
balloon. They sit out the cat act. In calm mode there are no visits.

Under the status line, each running subagent also gets its own line: its task, type, model and effort,
tokens and time. Up to 3 lines show, then `+N more`. They go away when the agents end.

```text
TegoAI Team | Opus 5.5 [high] | robot | feat/login | 7d 27% (1d) | 5h 30% (2h) | $32.68 | ctx 21%
↳ List mod settings | egor-xyz-scout | Haiku 5.5 [low] | 16k tok | 0:06
↳ Count robot animations | egor-xyz-scout | Haiku 5.5 [low] | 21k tok | 0:14
```

---

## 📊 Status line

Under the prompt, the robot draws a custom status line. Claude Code's own hint line stays under it.

<img width="800" alt="The robot status line: calm in grey, and with limits, cost and context that need attention in yellow and red" src="docs/media/statusline.svg" />

```text
Acme Team | Opus 5.5 [high] | my-app | feat/login | 7d 25% (2d) | 5h 15% (4h) | $21.97 | ctx 12%
```

| Part | Shows | Color |
| --- | --- | --- |
| `Acme Team` | your account | grey |
| `Opus 5.5` | the model | 🟠 Opus · 🔵 Sonnet · 🟢 Haiku · 🩷 Fable |
| `[high]` | the effort | grey up to `medium`, then `high` / `xhigh` yellow → `max` red |
| `my-app` | the project folder | teal |
| `feat/login` | the git branch | blue. A worktree folder named like its branch shows once. |
| `↑2` | commits not pushed yet, after the branch | 🟡 yellow. Shows only after the branch's first push, with at least 1 commit to push. |
| `7d 25% (2d)` `5h 15% (4h)` | usage limits and the time until they reset | grey → 🟡 at 50% → 🔴 at 80% |
| `$21.97` | session cost | grey → 🟡 above $100 |
| `ctx 12%` | context used | grey → 🔴 at the **Fire at** setting (25%) |
| `❄ cache cold · 117k` | the prompt cache expired; the context your next message re-reads. Shows only while cold, at the end of the line. | 🔵 blue |

**Grey means calm.** A part gets a color only when it needs your attention.

**The PR line.** With a PR open on the branch, one more line shows its checks, what needs you, and whether auto-merge is on. The changed files follow on the same line:

```text
#7: ✗ lint, test | ◌ 2 | ✓ 5 | conflicts | 💬 4 | auto merge | 10 files changed | +550 | -126
```

The number links to the PR on GitHub. A part shows only when it applies. With nothing to show, the files have the line to themselves. On a narrow screen the files part is cut first.

| Part | Meaning | Color |
|------|---------|-------|
| `✗ lint, test` | the failed checks. With more than 3, a count: `✗ 4 checks`. | 🔴 red |
| `◌ 2` | checks still running | 🟡 yellow |
| `✓ 5` | checks passed | 🟢 green |
| `conflicts` | the branch conflicts with its base branch | 🔴 red |
| `💬 4` | unresolved review threads | 🟡 yellow |
| `auto merge` | auto-merge is on: GitHub merges the PR when it can | 🟢 green |

A check from a run that a newer run cancelled is not counted as failed.

A new problem pops up once as a toast, for about 8 seconds: a new conflict, a newly failed check, more unresolved threads, or auto-merge turned off (by GitHub or by you). For example `PR #7: failing: lint`. It does not fire when you reload. The **PR and files line** setting turns the line and the toast off.

The line needs `gh`, signed in. It looks for the PR at once after `git push`, `gh pr …` or a branch switch. Then it looks every 15 seconds while checks run or in the minute after a push, and every 2 minutes when things are calm. A branch with no PR is checked every 5 minutes. It never looks on the default branch or a detached HEAD.

**The branch shimmers.** When the branch changes, or after a git commit or push, a bright band sweeps across the branch name for 3 seconds: blue → purple → pink → orange → yellow.

**Subagents get their own lines.** Each running subagent gets one line under the status line and the PR and files line: its task, type, model and effort, tokens and time. Up to 3 lines show, then `+N more`. Agents that already run when you reload plugins or update get their lines back within a second. Tokens spent before the reload are not counted, and the model shows from the agent's definition file until its next request. Open an agent from the tasks list and the status line shows that agent's model, effort, tokens and time instead of the session's model, cost and ctx; the agent lines hide, and the robot steps aside while the transcript is in view. Click `+N more`, or run `/robot agents`, and a panel lists every running subagent.

```text
Acme Team | Opus 5.5 [high] | my-app | feat/login | 7d 25% (2d) | 5h 15% (4h) | $21.97 | ctx 12%
↳ Find the login form | Explore | Haiku 5.5 [low] | 16k tok | 0:06
↳ Review the diff | tech-lead | Opus 5.5 [high] | 42k tok | 1:12
```

**Changed files get one line.** Under it all, one line counts the files git would commit, with the lines added and removed:

```text
Acme Team | Opus 5.5 [high] | my-app | feat/login | 7d 25% (2d) | 5h 15% (4h) | $21.97 | ctx 12%
5 files changed | +249 | -24
```

With a PR open (found with `gh`), the line counts all the PR's files, committed or not.

Under the mouse, the line shimmers. **Click it, or run `/robot files`, for the list.** A panel opens with each file, as editors list changes: the name, its folder (dim), `+N -N`, and a colored letter: `M` modified, `A` added, `D` deleted.

With a PR open, the panel title links to the PR in the browser, and the files come in two groups:

```text
PR #42 · 14 files changed
Not committed · 2
  SECURITY.md                 +1 M
  notes.txt                   +1 A
In PR · 12
  register.tsx claude-mod +206 -22 M
```

- 📚 Big PRs work too: the panel lists hundreds of files.
- 🔎 Type in the search box to find a file.
- ✨ The file under the mouse gets a soft background, and its name shimmers.
- ⌨️ `↓` from the search box walks the files, and `Enter` opens the file's diff, in color. A mouse click works too: click once to select, click again to open.
- ↗ In the diff, `↗ open` opens the file in its default app. `← files` goes back.
- `Esc` or **Close** closes the panel.

Turn them off with the **Branch wave**, **Subagent lines** and **PR and files line** settings.

**Your theme decides the exact colors.** The line uses Claude Code's theme colors (warning, error, …), not fixed ones. It reads well in dark, light and color-blind themes. With a `-ansi` theme in `/theme`, it uses your terminal's own color scheme.

---

## 🎮 Use it

| Command | Action |
| ------- | ------ |
| `/robot` | Hide or show the robot (saved) |
| `/robot status` | Hide or show the status line (saved) |
| `/robot changes` | Hide or show the PR and files line (saved) |
| `/robot calm` | Turn calm mode on or off (saved) |
| `/robot play` | The robot plays the slot machine |
| `/robot dice` | The robot turns into a die, rolls from the left to the middle, and lands on 1–6. With the robot hidden, the reply says the number, e.g. `🎲 You rolled 4.` |
| `/robot coin` | The robot flips a coin that lands on YES or NO. With the robot hidden, the reply says `🪙 Yes.` or `🪙 No.` |
| `/robot animate <name>` | The robot plays that animation now, e.g. `/robot animate ufo`. `/robot animate` alone lists the names. |
| `/robot files` | Open the changed-files panel |
| `/robot agents` | Open the panel with every running subagent |

Each toggle flips its setting on every run, and the setting is saved, so it lasts across sessions. Play, dice, coin and animate also work in calm mode.

### Settings

Every act has a switch. To change one:

1. In Claude Code, type `/plugin`.
2. Open **Installed**, pick **robot**, then choose **Configure**.
3. Change a value and save.

The change applies at once; the plugin reloads by itself.

| Setting | Default | What it does |
| --- | --- | --- |
| Robot | `true` | `false` hides the robot above the prompt. Each `/robot` flips it. |
| Calm | `false` | A calmer robot: half speed, only its quiet acts, no git cheer, compacting factory line, branch wave or friend visits. Fire, ice, "need a human" and friends still show. Each `/robot calm` flips it. |
| Status line | `true` | `false` hides the [status line](#-status-line) under the prompt. Each `/robot status` flips it. |
| Context on fire | `true` | `false` turns the [burning head](#-context-on-fire) off. |
| Fire at (% context) | `25` | Context % where the head catches fire and `ctx` turns red. |
| Cache cold | `true` | `false` turns the [ice cubes](#-cache-cold) and the status line's `❄ cache cold` part off. |
| Cache TTL | `1h` | How long the prompt cache lives: `1h`, `5m`, or `auto` (5m until a chat shows a 1-hour cache). |
| Compacting factory line | `true` | `false` turns the [factory line](#-compacting) off. |
| Git cheer | `true` | `false` stops the ✅ / 🚀 on commit and push. |
| Subagent friends | `true` | `false` hides the [WALL-E friends](#-subagent-friends). |
| Limits shown | `both` | Which limits the status line shows: `both`, `5h` or `7d`. |
| Limits from (% used) | `0` | A limit shows only from this %. `0` shows it always. |
| Needs you | `true` | `false` stops the "need a human" bubble. |
| Robot spinner words | `true` | `false` keeps Claude Code's own spinner words. |
| Branch wave | `true` | A bright band shimmers across the branch name for 3 seconds when the branch changes, and after a git commit or push. `false` keeps it still. |
| Subagent lines | `true` | One line for each running subagent under the status line: task, type, model, tokens and time. `false` hides them. |
| PR and files line | `true` | One line under the status line: how many files git would commit (with a PR open, all the PR's files, with the lines added and removed), and the open PR's checks, conflicts, unresolved review threads and auto-merge. A toast says when something new needs you. Click it, or run `/robot files`, for the list. Uses `gh`. Each `/robot changes` flips it. `false` hides the line and the toast. |
| Update toast | `true` | A toast when a new robot version is out, with the commands to update. Checks GitHub every 6 hours at most. `false` turns it off. |
| Reset all settings to default | `false` | Set to `true` and save: every setting goes back to its default, and this switch goes back to `false`. |

`/robot`, `/robot status`, `/robot changes` and `/robot calm` flip the Robot, Status line, PR and files line and Calm settings. They save, so they last across sessions.

### Update or remove

```text
/plugin marketplace update robot     # get the newest robot; it reloads by itself
/plugin uninstall robot@robot        # remove it
```

The mod tells you when a newer robot is out: one toast per version, with these commands. Turn it off with the **Update toast** setting.

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
| `Space`     | 🎰 Slot machine (in Claude Code: `/robot play`) |
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
