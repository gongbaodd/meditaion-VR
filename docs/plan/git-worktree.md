# Git worktree plan

One file per task. One task = one branch = one git worktree = one agent.

```
docs/plan/
  git-worktree.md  this file: how tasks, branches and worktrees are laid out
  <task>.md        one plan per task, e.g. hub-scene.md
```

## Folder layout

Every checkout lives inside `meditaion-VR/`. The folder itself is only a container.

```
meditaion-VR/
  main/            the main checkout (branch main). Holds .git, node_modules, everything.
  <task>/          one worktree per task, e.g. hub-polish/
```

## Rules

1. Start a task only from a clean, committed `main`. A worktree cannot see uncommitted work.
2. One agent per worktree. Open the agent in its own folder and stay inside it.
3. Each plan lists the files it will change. Two tasks that change the same file do not run at the
   same time.
4. Before merging: rebase on `main`, then `npm run typecheck` and `npm test`.
5. Merge one branch at a time, then remove its worktree.

## Commands

Run from `meditaion-VR/main`.

```sh
# start
git worktree add ../<task> -b <task> main
cd ../<task>
npm install
ln -s ../../main/public/hdri public/hdri    # reuse the downloaded HDRIs (gitignored)

# see what is running
git worktree list

# finish (from the task folder, then from main)
git rebase main
cd ../main && git merge <task>
git worktree remove ../<task>
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

## One-time move into `main/`

Not done yet. Do it when nothing is running in the repo (no dev server, no agent). There is no need
to commit first: uncommitted files move along with everything else.

```sh
cd meditaion-VR
npx @iwsdk/cli dev down
mkdir main
find . -mindepth 1 -maxdepth 1 ! -name main -exec mv -t main {} +
cd main && git status          # same as before the move
```

Afterwards open editors and agents in `meditaion-VR/main`, not `meditaion-VR`.
