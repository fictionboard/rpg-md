# Character Sheet

## Attributes
Strength: Number(10, 0-20)
Dexterity: Number(10, 0-20)
Constitution: Number(10, 0-20)
Intelligence: Number(10, 0-20)
Wisdom: Number(10, 0-20)
Charisma: Number(10, 0-20)

## Identity
Name: Text()
Class: Select([Fighter, Mage, Rogue, Cleric, Ranger])
Fighting Style: Select([Heavy armour, Quick hands, Hardy])
Race: Select([Human, Elf, Dwarf, Halfling, Gnome])
Level: Number(1, 1-20)
Background: Text()
Training: MultiSelect([Athletics, Study, Insight, Charm])

## Combat
HP: Number(10, 0-100)
Max HP: Number(10, 0-100)
AC: Number(10, 0-30)
Initiative: Modifier({(@dexterity - 10) / 2})

## Gear
Items: MultiSelect([Dagger, Axe, Sword, Bow, Shield, Leather armor, Chainmail])

## Notes
Description: TextArea(rows 5)
