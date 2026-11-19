---
title: Sampler
# A made-up game that touches every component type and section pattern once or more.
tags: [test, sampler]
---
## Banner

![Sampler banner](/images/system/sampler/banner.svg)

\[-Field Record-\]

**A sheet for a game that does not exist**

## Who (#identity)

Portrait: Media(category="portrait")
Name: Text
Moniker: Text()
Hometown: Text("Nowhere in particular")
Age: Number (30, 12-90)
Calling: Select

- Not chosen
- Cartographer
- Lamplighter
- Ferryman
- Beekeeper

Temper: Radio([Calm, *Restless, Fierce])
Upbringing: Pips([Village, Road, Harbour])
Quirks: MultiSelect([Hums, *Fidgets, Collects buttons, Talks to birds])
Habits: Choices([Early riser, Night owl])
Path: Select(#paths)
Själv-bild: Text
Look: Description

## Paths

### Wanderer

You never sleep in the same place twice. Take one extra step on every journey.

### Keeper

You hold things for others. Once per session, produce a small item you were minding.

## Traits

Grit: Stat(2, min 0, max 5)
Knack: Stat (1, 0-5)
Poise: Ability(1, 0-5)
Spark: Score(0, 0-5)
Luck: Number
Total: Computed({@traits__grit + @traits__knack + @traits__poise + @traits__spark})
Edge: Modifier({(@traits__grit - 2) * 2})

## Talents

### Hands

Rating: Number(2, 0-6) #hands_rating
Target: Formula({12 - @hands__hands_rating}) #hands_target
Mending: Skill (0, 0-10)
Whittling: Skill (0, 0-10)
Media: Skill (0, 0-10)

### Feet

Rating: Number(2, 0-6) #feet_rating
Target: Formula({12 - @feet__feet_rating}) #feet_target
Rowing: Skill (0, 0-10)
Zero-G: Skill (0, 0-10)

### Head

Rating: Number(2, 0-6) #head_rating
Target: Formula({12 - @head__head_rating}) #head_target
Mech. Repair: Skill (0, 0-10)
A.I.: Skill (0, 0-10)

## Common Lore (.lore)

Stargazing: Checks(1/1)
Tidewatching: Checks(0/1)
Knots: Checks(0/1)

## Rare Lore (.lore)

Old Tongues: Checks(0/1)
Weather Signs: Checks(0/1)

## Deep Lore (.lore .faded)

Unnamed Things: Checks(0/1)

## Strain & Rest

Strain: Checks(0/9)
Scars: Checks(0/4)
Spent: Checks(0/1)
Sore: Checks(0/1)
Rest Clock: Checks(2/6) #rest_clock
Ledger: Checks(0/40)
Rule: Value("Rest one night (or two, if the road was cruel) to clear 1 strain.")
Warning: Display("Mark the last box and you are out of the scene.")

## Bonds

Bond: Actor
Bond: Actor
Bond: Actor
Rival: Actor
Note: Text
Note: Text
Note: Text

## Satchel

Item: Text
Item: Text
Item: Text
Item: Text
Coins: Number(0, 0-999)
Pack: Resource([filter gear])
Spare: Equipment()

## Tools

### Tool 1

Name: Text
Bonus: Number
Reach: Select

- -
- Close
- Near
- Far

Wear: Checks(0/2)

### Tool 2

Name: Text
Bonus: Number
Reach: Select

- -
- Close
- Near
- Far

Wear: Checks(0/2)

### Tool 3

Name: Text
Bonus: Number
Reach: Select

- -
- Close
- Near
- Far

## Dice

Check: Dice(2d6)
Damage: Dice(1d8+1)
Oracle: Dice(d66)
Push: Roll({@traits__grit}d6)
Ask: Action("roll oracle")
Once: Button("spend luck", once)

## Oracle

| d6 | Answer |
|----|--------|
| 1-2 | No, and |
| 3-4 | Yes, but |
| 5-6 | Yes, and |

- A crow lands nearby.
- The road forks.
- Someone is singing.

## Notes

### Session

Notes: TextArea(rows 6)

### Campaign

Notes: Note(rows 4)
Seal: Image("seal.png", width 64, height 64)
Badge: Avatar(circular)
