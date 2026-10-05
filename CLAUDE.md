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
claude-mod/           Claude Code mod: draws frames above the prompt in pure TypeScript
claude-mod/robot.ts   TypeScript twin of functions/crazy-robot (no zsh needed)
scripts/gen-parity-fixture.mjs  records the real zsh frames for the parity test
```

The Claude Code mod does not run zsh: `claude-mod/robot.ts` is a TypeScript twin
of `functions/crazy-robot`. A new animation needs the same change in
`claude-mod/robot.ts`. Then run `node scripts/gen-parity-fixture.mjs` (records
the real zsh frames into `claude-mod/parity.fixture.ts`), and check with
`claude plugin validate .` and `claude plugin test .` — the test checks parity.

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

The zsh TUI has no test suite. Smoke-test:

```sh
zsh -fc 'source ./robot.plugin.zsh; whence -w robot crazy-robot'
```

Preview a single robot frame:

```sh
zsh -fc '
  _robot_state=jump _robot_t=0 _robot_dur=10 _robot_pos=0 _robot_dir=1
  fpath=(./functions $fpath); autoload -Uz crazy-robot; crazy-robot 30'
```

### Test the Claude Code mod live

Unit tests are not enough for the mod. Look at it in a real Claude Code
session before you push:

1. Run the checks: `claude plugin validate .` and `claude plugin test .`.
2. Load the `plugin-authoring` skill (Skill tool). This starts the engine's
   watch on the session's dev-mods folder:
   `~/.claude/dev-mods/<session-id>/`.
3. Turn off the installed robot, or you see two robots:
   `claude plugin disable robot@robot`.
4. Copy the mod into the dev-mods folder:

   ```sh
   D=~/.claude/dev-mods/<session-id>/robot
   mkdir -p "$D/.claude-plugin"
   cp -R claude-mod "$D/"
   cp .claude-plugin/plugin.json "$D/.claude-plugin/"
   ```

5. The first write asks the user "Enable hot reloading for this session?".
   The user picks **Enable for this session**. The mod loads when the turn
   ends. Each later copy reloads it when that turn ends.
6. Make the act happen and ask the user to look. For example:
   - context fire: set `hotAt` low in `/plugin` → robot → Configure.
   - compacting: `/compact`.
   - git cheer: run a `git commit` or `git push` through the Bash tool.
   - subagent friends: start 2–3 background agents.
   - allow wait: run a tool that needs permission.
   Check both the terminal and the desktop app (the desktop draws an `Svg`,
   because its `Text` font is proportional).
7. Clean up after the test. The permission check blocks `rm -rf` for
   Claude, so the user runs it with `!`:

   ```sh
   rm -rf ~/.claude/dev-mods/<session-id>/robot && claude plugin enable robot@robot
   ```

8. After the push and the release, the user updates the installed copy:
   `/plugin marketplace update robot`, `/plugin update robot@robot`,
   `/reload-plugins`.

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

**Bump `version` in `.claude-plugin/plugin.json` with every mod change.**
Claude Code compares that field, not the release tag: if it stays the same,
`/plugin update` keeps the old cached copy.

**The squash-merge subject must carry the prefix** (GitHub uses the PR title).
A PR-title lint workflow (`pr-title.yml`) enforces this. If a release you
expected didn't cut, push an empty `feat:`/`fix:` commit to `main`.
