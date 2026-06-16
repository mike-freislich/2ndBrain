---
tags:
  - levelup
  - fl2d
  - training
---

- [[Flight Level 2 Simulator]] Debrief
# Running Sim
---
## Round 1
- After 2 minutes
	- Capture WIP
	- add red item
	- make a copy of the sim!!
- Run for **6 minutes** 0 ... 5
## Round 2
- After 2 minutes
	- Capture WIP
	- add red item
- finish the minute in which the red diamond is created.

# Debrief
---

## Short version
1. How did the rounds *feel* different
2. Which round made more *money*
3. THROUGHPUT
	1. Calc throughput (economic value €1000) per diamond
4. CYCLE TIME
	1. PULL SYSTEM : Calc cycle time (pull first - because push didn't finish red)
	2. end time = (60s / num items in minuteSlot) * position + minuteSlotIndex
	3. PUSH SYSTEM  (incomplete RED):
		1. total diamonds delivered = DR
		2. remaining until red = DD
		3. total time + DD * throughput
5. System Stability
6. Work Size and Stability
7. 

## Throughput - economic value (€1000 per diamond)
good representation of **economic value** (€1000 per diamond)
- **Calculate throughput**
	- Push and Pull
	- **Count diamonds** per minute, and **average** (without first and last samples)
### Review results
- earned less in the first round because **overhead** in the system e.g. **meetings** per diamond
	- ignore the overhead, then both rounds are the same
- the **bottleneck** governs the throughput
	- in **pull** systems, bottleneck causes **upstream idle time**
		- we could **help the bottleneck**, increasing the throughput
		- **improve** the process
	- in **push** systems we won't help the bottleneck, and **throughput will decline**
		- this sub-optimizes the system
	- **There will always be a bottleneck** because we can't distribute the work perfectly
		- in knowledge work, the **bottleneck moves** over time due to variation in complexity
## Cycle Time - calc pull first!
- **A measurement of speed or duration from start to finish** : :  cycle time = end - start
- **Pull system cycle time**
	- **end time** =  = 60 / (num diamonds) + minute
	- **start time** = 2 minutes
	- **cycle time** = (start time) - (end time)
- **Push System cycle time**
	- **start time** = 2 minutes
	- **Red item endTime** - a little more tricky
		- **total items finished** = count the items
		- **items remaining until red** = (red seq number) - (total items finished)
		- **time to complete** =  (items remaining) / (throughput)
		- **time to complete mm:ss** = mm : (time to complete decimal) * 60
		- **end time** = (sim runtime) + (time to complete mm:ss)
		- **cycle time** = endTime - startTime
## System Stability - wip unstable in push - longer
- why was cycle time so much faster in the Pull?
- wip of push vs. wip of pull
	- push round red item waits in queue
	- pull round no real waiting
	- Refer to final state of push board
		- what would the cycle time be if we started a red item now? Or after an hour? MUCH HIGHER
	- Compare to final state of pull board .... cycle time stable
- Unstable push work system
	- not everything is bad .... when will this work be finished? we don't have to estimate, because there isn't a way to know when it will be done...
	- don't even try to answer
- Stable focused pull system
	- we can just look at the stats
## Work Size and Stability - The tiny star is blocked
- many organisations try to slice all the items to the same size
	- a lot of effort and workshops to do this
	- size has very little to do with system stability
	- in our example, everything is the same size
- Push/unstable systems and blockers
	- all items take 2 weeks... but I add an item that takes 2 days
	- the item enters, and on day 1 there is a blocker
	- we ignore the blocker and carry on working on all the other items
	- all items take 2 weeks
	- but the star has now been waiting for 3 weeks
	- so the size of the work has less impact speed of resolving blockers
- Same type of work is important
	- tasks vs projects, yes ... this is a problem
	- but we don't need identically sized items
	- much more important to transition to a stable pull system
## Prioritization - Unhappy customer jumps the Q
- unfocused push system after 10 minutes ... much more items in the system.. OVERLOADED
- red order maybe takes an hour... and is likely in a queue like "this" ... e.g. team 3
- number 1 enemy of delivery .... the customer
	- after 45 minutes, my order is only 80% done! escalate!!! The customer first!
	- expedite!!! Jump the queue! Priority 1 item
	- drop all other stuff, and work on P1 item
	- cycle time of P1 goes down
	- cycle time of non P1 items goes up
- customer has learned to complain and escalate
	- news just in: some companies have more than one customer!
	- every customer behaves the same .... more P1's
	- P1's now take longer
	- non-P1's take even longer --- Dangerous! Negative feedback loop!
	- play game for long enough, P1's became standard, and yellow items are never done.
	- P1+!!! Task Teams! just another priority class
## Late Commitment - need a green diamond
- PUSH - completely overloaded work system
	- Customer arrives and says... green is the new yellow!
	- probably need to throw out their order and start a green item and make it a P1 to catch up
- PULL - 45 minutes
	- customer changes order to green
	- where is the customer order? probably in the pool of new ideas.
	- Yes sure ... we can make it green... maybe cost a little more
		- maybe we leave out the fact that we haven't started it yet.
- Changes can be made much more easily in the pull system
	- Late Commitment
- Online shopping.... often misses this point
	- as soon as you click "buy", the order is committed.. it's difficult to make changes to the order, even though it hasn't actually been started yet.
## Team Agility and Team Performance
- Overloaded system - unhappy with the performance
- We must go Agile!
	- team 1 scrum
	- team 2 kanban and so on
- So we introduce a backlog / options pool
	- limit wip / sprint planning
	- move idle work to backlog
- Now we're agile.... but ... nothing has changed
	- ready work from T1 moves to backlog of T2
- If we want to see a real improvement
	- we need to move all this work back to the front
	- end to end value - stop emphasizing team agility, and zoom out to FL2 and create focus there
	- this is why FL2 is a powerful tool for system performance
	- otherwise we spend lots of money on individual teams, sprinting and slicing and so on, but it has zero impact on the whole system
	- PS I love scrum and kanban at team level, but, we need to work at FL2 first, and then have targeted improvements
	- So yes, we need to do this, but please let the teams work! we need to do some homework first, rather than interrupting the team all the time saying... we need to do some Agile stuff now.
## Final Review
- What was the fundamental difference between the 2 rounds
- xfunc teams? reorg? scrum, kanban, safe? NOPE
- we created focus
- This is really what we want to do with Flight Levels - understand how work systems work - find the levers and put them in motion
	- exactly what FL2 does
	- build a focused pull system and put it to work
