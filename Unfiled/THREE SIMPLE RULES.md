0. if the rule isn't working, change it (together)
1. **PR Review in Discord**
2. **Pre-review+fix LD Validation**
3. **Approved Games are protected**

(validated)
**Develop** <-- >1 PR per game against develop

(G1 -- playtest in June --> LD-Validated) -- commit hash
G2 -- lofi/hifi-in process
G3 -- clanker lofi

VVVVVVVVVVVVVVVV
**Staging** (validated ->  hotfix ->  Approved)


VVVVVVVVVVVVVVVV
Stable (approved)




Agent -> (INIT BRANCH) PR-dev

Human pulls the PR ... and branches off it ----- hifi


the current plan is:
1. keep dev'ing as we are in develop
2. promote a game that is ready for review to Staging (cherry-picked)
	1. deal with hotfixes required and back-merge to dev
	2. Approve
3. promote the game to Stable (cherry-picked)
4. Stable is clean ... promote the whole of stable to main as and when needed



















