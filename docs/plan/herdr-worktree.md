# Herdr worktree plan

One file per task. One task = one branch = one Herdr worktree space = one agent.

```
docs/plan/
  herdr-worktree.md  this file: how tasks, branches and worktrees are laid out
  <task>.md          one plan per task, e.g. hub-scene.md
```

Herdr's worktrees are ordinary git worktrees. What changes is who creates them and where they
live: Herdr's **New worktree** dialog makes the checkout, puts it under `~/.herdr/worktrees/`, and
opens it as a space nested under the repo in the Spaces sidebar.

## Folder layout

```
~/github/meditaion-VR/
  main/                        the main checkout (branch main). Holds .git, node_modules, everything.
  hub/                         old-style worktree made by hand with git. Stays until hub is merged.

~/.herdr/worktrees/
  main/                        Herdr names this folder after the main checkout's folder, which is "main"
    <task>/                    one worktree per task, e.g. hand-menu/
```

The path is always `~/.herdr/worktrees/<repo>/<branch>`. `<repo>` is the name of the folder that
holds `.git`, so for this project it is `main`, not `meditaion-VR`. Slashes and other special
characters in the branch name become dashes in the folder name.

## Rules

1. Start a task only from a clean, committed `main`. A worktree cannot see uncommitted work.
2. Start it from the **main** space. Herdr branches from the HEAD of the space you are in, so a
   worktree started from another task's space branches from that task, not from `main`.
3. One agent per worktree space. Open the agent in that space and stay inside its folder.
4. Each plan lists the files it will change. Two tasks that change the same file do not run at the
   same time.
5. Before merging: rebase on `main`, then `npm run typecheck` and `npm test`.
6. Merge one branch at a time, then remove its worktree.
7. Commit or discard everything before **Remove worktree**. Herdr warns once about uncommitted
   changes and then removes the folder with `--force`.

## Start a task

1. In Herdr, select the **main** space.
2. Space menu or the **+** menu → **New worktree…** → type `<task>` as the branch name.
   Herdr runs `git worktree add -b <task> ~/.herdr/worktrees/main/<task> HEAD` and opens the space.
   If the branch already exists, it checks that branch out instead of creating one.
3. In the new space's terminal:

```sh
npm install
ln -s ~/github/meditaion-VR/main/public/hdri public/hdri   # reuse the downloaded HDRIs (gitignored)
```

The HDRI link must be an absolute path. The relative `../../main/public/hdri` link used in
`meditaion-VR/hub` does not resolve from `~/.herdr/worktrees/`.

4. Start the agent in that space (the **+** menu, or `hc run --bg claude` from its terminal).

## See what is running

- Spaces sidebar: each worktree space sits under `main` and shows its branch, ahead/behind and
  uncommitted changes.
- **Open worktree…** lists every checkout of the repo, including ones made outside Herdr such as
  `meditaion-VR/hub`, and opens or jumps to its space.
- `git worktree list` from any checkout, and `hc ls` for the terminals and agents.

## Finish a task

```sh
# in the task space
git rebase main
npm run typecheck && npm test

# in the main space
git merge <task>
```

Then, in the task space: space menu → **Remove worktree**. Herdr closes the space's terminals and
removes the checkout. It does not delete the branch, so finish in the main space with:

```sh
git branch -d <task>
```

Only one dev server at a time unless you change the port: `vite.config.ts` asks for 8081.

## Plan file

Start each `<task>.md` with:

```
Branch: <task>
Status: todo | in progress | done
Files:  the paths this task changes
```

Then the goal, the steps, and how to check it is done.

## Current state (2026-11-16)

| Checkout | Branch | Made with | State |
|---|---|---|---|
| `~/github/meditaion-VR/main` | `main` | — | keep. Contains the merged hub work. |
| `~/github/meditaion-VR/hub` | `hub` | `git worktree add` | merged into `main` (fast-forward). An agent terminal is still open in it. When it is closed, in Herdr use **Open worktree…** → `hub` → **Remove worktree**, then `git branch -d hub` in the main space. |

`hand-menu` and `handmenu` were leftover Herdr branches and are deleted.

New tasks use Herdr from now on. Nothing has to be moved.

## Optional

- **Folder name.** The `meditaion-VR/main/` container was made for side-by-side git worktrees and
  is no longer needed, but it is why Herdr's folder is called `main`. Moving the repo back up to
  `meditaion-VR/` would give `~/.herdr/worktrees/meditaion-VR/<task>`. Only worth doing when no
  worktree and no agent is open, followed by `git worktree repair`.
- **Worktree location.** Herdr 0.1.16 (downloaded, not yet running; 0.1.15 is installed) adds
  `worktrees.directory` in `~/.config/herdr-app/settings.json` to put checkouts somewhere other
  than `~/.herdr/worktrees`. Not needed for this plan.
