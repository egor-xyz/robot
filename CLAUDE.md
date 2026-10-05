# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

`robot` is a tiny zsh plugin: an animated ASCII robot screensaver for the
terminal. `↑↓` cycle animations, `→` opens a settings panel (self-update),
`Space` plays a slot machine, `q`/`Esc` quits. It's a toy — keep it whimsical.

It was split out of [`wtclaude`](https://github.com/egor-xyz/wtclaude), which
still embeds the same robot as a picker mascot.

## Layout

```
robot.plugin.zsh      plugin manager entry — sets fpath + autoloads
install.sh            curl one-liner installer (clones to ~/.robot, patches .zshrc)
functions/robot       the TUI: screensaver loop + settings panel
functions/crazy-robot animation component, called per frame by robot
.claude-plugin/       Claude Code plugin + marketplace manifests (repo root = plugin root)
claude-mod/           Claude Code mod: runs functions/crazy-robot, draws frames above the prompt
```

The Claude Code mod reuses `functions/crazy-robot` as is — a new animation shows
up there with no mod change. Check it with `claude plugin validate .` and
`claude plugin test .`.

Function files use zsh autoload convention: file name = function name, no
`function foo()` wrapper, body is the function body. First line is the
`#autoload` marker comment.

## Conventions

- **zsh only.** `emulate -L zsh` at top of every function — isolates options
  from the user's shell.
- **`setopt typeset_silent`** — without it, `local var` (no value) prints the
  variable's current declaration. Keep it.
- **No `print -P`** for content that may contain `\` (eats trailing backslash).
  Robot frames render via raw `printf '\e[...m%s\e[39m\n'`. TUI chrome (footer,
  settings) has no backslashes, so it uses `print -P` for color markup.
- **Frame strings** are `$'...'` quoted, 4 lines unless an animation needs
  vertical motion. Width should align so leading pad applies uniformly.
- **Emoji are 2-column.** Re-render and eyeball alignment in a real terminal.
- **Shared state with the robot** flows through `_robot_*` locals declared in
  `functions/robot` and read/written by `crazy-robot` via dynamic scoping. The
  TUI's own settings/update helpers use the `_rbt_*` prefix to stay clear of
  the `_robot_*` animation state. Don't promote either to globals.

## Adding a new robot animation

A robot state spans **two files and seven locations** — six in
`functions/crazy-robot` plus **one** `robot_order` list in `functions/robot`.
Follow the project skill: **`.claude/skills/add-robot-animation/SKILL.md`**.

## Testing

No test suite — it's a TUI. Smoke-test:

```sh
zsh -fc 'source ./robot.plugin.zsh; whence -w robot crazy-robot'
```

Preview a single robot frame:

```sh
zsh -fc '
  _robot_state=jump _robot_t=0 _robot_dur=10 _robot_pos=0 _robot_dir=1
  fpath=(./functions $fpath); autoload -Uz crazy-robot; crazy-robot 30'
```

## Distribution

Two install paths must keep working:

1. **`install.sh`** — `curl … | bash`. Clones to `~/.robot`, appends a
   `source ...robot.plugin.zsh` line to `~/.zshrc`. Idempotent.
2. **Plugin managers** — antidote, zinit, sheldon, oh-my-zsh. They source
   `*.plugin.zsh`, so `robot.plugin.zsh` is the contract. Keep it minimal.

## What not to do

- Don't reformat the ASCII robot frames — alignment is fragile.
- Don't replace `printf` with `print -P` for frames (see above).
- Don't add `set -e` / `set -u` to the zsh functions; they break things under
  autoload.
- Don't pull in dependencies. The only runtime dep is `zsh` (`git`/`curl` only
  for self-update).

## Git

- Default branch: `main`.

## Releases (semantic-release)

Releases are cut automatically by `.github/workflows/bump-version.yml` on every
push to `main`, using the `conventionalcommits` preset (`.releaserc.json`). The
installer and in-shell updater pin to the latest GitHub Release tag, so a
missing release means users don't get the change.

| Prefix | Bump |
|--------|------|
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` | major |
| `chore:` / `docs:` / `refactor:` / `test:` / `ci:` / `build:` / `style:` | no release |

**The squash-merge subject must carry the prefix** (GitHub uses the PR title).
A PR-title lint workflow (`pr-title.yml`) enforces this. If a release you
expected didn't cut, push an empty `feat:`/`fix:` commit to `main`.
