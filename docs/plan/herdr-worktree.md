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
~/github/meditaion-VR/         the main checkout (branch main). Holds .git, node_modules, everything.

~/.herdr/worktrees/
  meditaion-VR/                Herdr names this folder after the main checkout's folder
    <task>/                    one worktree per task, e.g. hand-menu/
```

The path is always `~/.herdr/worktrees/<repo>/<branch>`. `<repo>` is the name of the folder that
holds `.git`, so for this project it is `meditaion-VR`. Slashes and other special characters in
the branch name become dashes in the folder name.

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
   Herdr runs `git worktree add -b <task> ~/.herdr/worktrees/meditaion-VR/<task> HEAD` and opens the space.
   If the branch already exists, it checks that branch out instead of creating one.
3. In the new space's terminal:

```sh
npm install
ln -s ~/github/meditaion-VR/public/hdri public/hdri   # reuse the downloaded HDRIs (gitignored)
```

The HDRI link must be an absolute path. A relative link does not resolve from
`~/.herdr/worktrees/`.

4. Start the agent in that space (the **+** menu, or `hc run --bg claude` from its terminal).

## See what is running

- Spaces sidebar: each worktree space sits under the repo's main space and shows its branch, ahead/behind and
  uncommitted changes.
- **Open worktree…** lists every checkout of the repo, including ones made outside Herdr, and
  opens or jumps to its space.
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

| Checkout | Branch | State |
|---|---|---|
| `~/github/meditaion-VR` | `main` | the only checkout. Contains the merged hub work. |

Done on 2026-11-16:

- The `hub` worktree (`meditaion-VR/hub`, made by hand with `git worktree add`) is removed and the
  `hub` branch is deleted. It was fully merged into `main`.
- The repo moved up from `meditaion-VR/main/` to `meditaion-VR/`. The `main/` container folder is
  gone, and so is the empty `~/.herdr/worktrees/main/`.
- `hand-menu` and `handmenu` were leftover Herdr branches and are deleted.

In Herdr, the repo has to be opened again from `~/github/meditaion-VR`. The old space pointed at
`meditaion-VR/main`, which no longer exists.

New tasks use Herdr from now on.

## Optional

- **Worktree location.** Herdr 0.1.16 (downloaded, not yet running; 0.1.15 is installed) adds
  `worktrees.directory` in `~/.config/herdr-app/settings.json` to put checkouts somewhere other
  than `~/.herdr/worktrees`. Not needed for this plan.
