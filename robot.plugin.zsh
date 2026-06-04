# robot — zsh plugin entry point.
# Compatible with antidote, antigen, zinit, sheldon, oh-my-zsh custom plugins.
0=${(%):-%N}
ROBOT_DIR=${0:A:h}
ROBOT_VERSION=$(git -C "$ROBOT_DIR" describe --tags --abbrev=0 2>/dev/null \
  || git -C "$ROBOT_DIR" describe --tags --always 2>/dev/null)
ROBOT_VERSION=${ROBOT_VERSION#v}
# Backfill tags on shallow clones so future invocations show real version.
if [[ -f $ROBOT_DIR/.git/shallow ]]; then
  ( git -C "$ROBOT_DIR" fetch --unshallow --tags --quiet 2>/dev/null ) &!
fi
# Load persisted settings (overrides env defaults)
_rbt_cfg=${XDG_CONFIG_HOME:-$HOME/.config}/robot/settings
[[ -r $_rbt_cfg ]] && source "$_rbt_cfg"
unset _rbt_cfg
fpath=("$ROBOT_DIR/functions" $fpath)
# Drop any previously cached autoload bodies so re-sourcing this file
# (e.g. after `git pull`) picks up the new function definitions.
unfunction robot crazy-robot 2>/dev/null
autoload -Uz robot crazy-robot
ROBOT_LOADED_AT=$(date +%s)
