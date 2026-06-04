---
name: add-robot-animation
description: Use when adding, editing, or removing a robot animation or state — a new pose, scene, or emoji prop for the screensaver mascot. Covers every wiring touchpoint so the state is reachable, correctly timed, and aligned. Symptoms it prevents: new animation never plays, is unreachable by ↑↓ stepping, wraps the line, or cuts mid-loop.
---

# Adding a robot animation

## Overview

A robot "state" (e.g. `photo`, `basketball`) is wired across **two files** and
**seven locations**. The frames live in `functions/crazy-robot`; the state must
also be registered in the single `robot_order` list in `functions/robot` or it
plays in the random rotation but is unreachable by manual ↑↓ stepping. Missing a
touchpoint is the #1 bug — work the checklist top to bottom.

## The 7 touchpoints

All are mandatory **except #3** (`_w`), which is conditional. Reference by code
anchor, not line number. First, pick a state name not already in `states=(…)`
— collisions silently reuse frames.

### `functions/crazy-robot`
1. **Frames** — append `$'...'` frames to `idle_frames` (or `walk_frames`).
   4 lines each unless the scene needs vertical motion. Note the 1-based index
   of your first new frame.
2. **`states=(…)` array** — add your state name. This is the random idle
   rotation. Omit and it never auto-plays.
3. **`_w` width-clamp `case`** — add `yourstate) _w=N ;;` **only if** the scene
   is wider than a plain robot (~10 cols incl. a side prop). `N` = total render
   width. Omit when needed → the prop wraps at the right edge.
4. **`_robot_dur` `case`** — add a per-state duration. Make it a **whole number
   of cycles** so it never cuts mid-loop. Use `999` for scenes that end
   dynamically (prop leaves screen).
5. **`color` `case`** — add `yourstate) color=NNN ;;` (256-color code). There is
   **no `*)` default** — forget this and the accent escape breaks.
6. **Render `case $_robot_state in`** — add a branch that sets `raw` for
   `_robot_t`. New branches go **before `slot)`** (the trailing easter egg).

### `functions/robot`
7. **`robot_order` list** — the single list the screensaver ↑↓ steps through.
   Insert your state in the position you want, **before `slot`** (slot must
   stay last — Space-triggered jackpot).

> Note: in wtclaude this state lived across *two* `robot_order` lists. In this
> repo there is only **one** (in `functions/robot`).

## Conventions

- **`emulate -L zsh`** at top; no `set -e`/`-u`; no `print -P` for frames (eats
  trailing `\`). Frames render via raw `printf` ANSI.
- **Body bar is `━` (U+2501)**, not `===`/`---` (ligature avoidance).
- **Emoji are 2 display cols** but 1 codepoint. Pad to align.
- **Left/right variant:** roll `(( _robot_t == 0 )) && _robot_mirror=$(( RANDOM % 2 ))`,
  author a second frame set, and pick base off `_robot_mirror`.
- **Shared `_robot_*` vars** flow via dynamic scope from `functions/robot`.

## Testing

Sweep every tick of your cycle and eyeball alignment in a real terminal:

```sh
for t in $(seq 0 7); do echo "--- t=$t ---"; zsh -fc "
  _robot_state=photo _robot_t=$t _robot_dur=99 _robot_pos=2 _robot_dir=1 _robot_mirror=0
  fpath=(./functions \$fpath); autoload -Uz crazy-robot; crazy-robot 40
"; done
```

Run once per orientation (`_robot_mirror=0` and `=1`). Then
`zsh -n functions/crazy-robot && zsh -n functions/robot`.

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Plays randomly but ↑↓ skips it | Missed the `robot_order` list | Touchpoint 7 |
| Never plays at all | Not in `states=(…)` | Touchpoint 2 |
| Prop wraps / pushes off right edge | No `_w` clamp | Touchpoint 3 |
| Animation cuts mid-pose | `_robot_dur` not a whole cycle | Touchpoint 4 |
| Eyes not colored / garbled escape | Missing `color` case (no default) | Touchpoint 5 |

## Release note

Ship via a PR whose **title** starts with `feat:` (semantic-release reads the
squash subject). See CLAUDE.md → Releases.
