# Spotlight talk: Parkkiko

Three minutes, week 42. Three speakers, roughly a minute each. Graded on preparation, so the
point of this file is that three people can rehearse the same thing.

**Read it aloud with a timer before you trust it.** 390 spoken words times at 2:35 to 3:00
depending on pace, which leaves the slack for pauses and the hand-off into the demo.

| | Who | Section | Target |
|---|---|---|---|
| 0:00 | Jamila | One sentence, then the moment every driver knows | 0:50 |
| 0:50 | Mai | What Parkkiko does, live on screen | 1:45 |
| 1:45 | Ömer Furkan | Why this, why us, why now | 2:40 |
| 2:40 | Ömer Furkan | The objection, and the close | 3:00 |

---

## The script

### 1. One sentence, then the problem (Jamila, 0:00–0:50)

> **We help drivers in Helsinki avoid parking fines, by turning the city's own parking rules into
> a plain answer on a map.**
>
> Here is why that is needed. You have found a space. The sign is somewhere behind you. Is parking
> free right now? Until when? Is this spot even for you, or is it a loading bay?
>
> Most of us guess. Last year Helsinki issued **156,383 parking fines**. Most of those drivers
> were not being reckless. They misread a sign, or never saw one.
>
> And the strange part: the city already publishes every one of these rules, free, to anyone. The
> problem is that it looks like this.

*Slide 2 shows the raw register: `9-21, (9-18)`, `4 h`, `ei aikarajoitusta`. Let it sit for a
beat. Nobody can read that at the kerb, and that is the whole gap we close.*

### 2. The answer (Mai, 0:50–1:45)

> So we turned it into something you can read while standing next to your car.
>
> This is Parkkiko. It opens where you are. You tap the stretch of street you parked on, and
> choose which side, because the rules differ between the two sides and your phone cannot tell
> them apart.
>
> Then it tells you one thing. **Paid until nine, then free until nine tomorrow morning.** The
> answer, and when it changes.
>
> It knows the awkward cases. This looks like an ordinary space and it is reserved for electric
> scooters; there are about a thousand of those. It knows a public holiday follows Sunday rules,
> so on Christmas Day it will not tell you to pay.

*Demo live if the connection holds, otherwise the recording on slide 4. Decide on the day, and
whoever is not speaking opens the fallback before the session starts.*

### 3. Why this, why us, why now (Ömer Furkan, 1:45–2:40)

> Why does this need more than a lookup? Because the city's data does not describe every street
> perfectly. For about one stretch in six, the rule is incomplete or contradicts itself.
>
> Most apps would guess. We don't. Where the city left the hours out, we predict them from the
> nearby stretches of the same kind, we say that it is an estimate, and we only do it when we are
> confident. We measured that: right about ninety-seven times in a hundred.
>
> Everywhere else we are unsure, Parkkiko says **check the sign**, and shows what the city
> actually published so you can decide. A wrong "you can park here" costs you a fine. An honest
> "I'm not sure" costs you nothing.
>
> And now, because the city opened this data and every one of us is carrying the map in a pocket.

### 4. The objection, and the close (Ömer Furkan, 2:40–3:00)

> You might think this is just looking rules up in a table. The hard part was that the rules are
> written for humans, in three ways of saying four hours, and that a sixth of them do not add up.
> Knowing when not to answer is the work.
>
> Parkkiko. It tells you when you can park, and admits when nobody knows.

---

## Slides

Six, no more. Nobody reads a slide and listens at the same time.

1. **Title**, and the one-sentence pitch written out.
2. **The register as it really looks.** Raw strings, unreadable on purpose.
3. **The map.** Whole city, coloured by what you may do.
4. **The answer card.** One stretch of street, the plain answer and the timeline.
5. **Check the sign.** The uncertain state, honesty as a feature.
6. **Close.** The one line again, and where to try it.

Use the figures already in `docs/figures/` rather than making new ones.

## What not to say

Say the left column. The right is what we say to each other, and it loses a driver.

| Say | Not |
|---|---|
| stretch of street | parking area, polygon, segment |
| the city's data | the register, the open data portal, WFS |
| we predict them from nearby streets | nearest-neighbour imputation |
| right about 97 times in 100 | 97.5% accuracy against a 32.9% baseline |
| check the sign | uncertain status, issue code |
| about one stretch in six | 1,363 of 8,754 |

Say **a hundred and fifty-six thousand fines**, not the exact figure. One precise number is
memorable; four are noise.

## What the grader is listening for

The brief says to address the target group and not be technical, so the script above talks to
drivers. A TA still has to hear competence underneath it. These are already in the script, so
there is nothing extra to say, only things not to cut:

- **Real data wrangling.** The slide of raw strings, and "three ways of saying four hours".
- **A genuine learning task, not a lookup.** The prediction sentence in section 3, and the
  objection in section 4, which name it without jargon.
- **Measured, not claimed.** "We measured that: right about ninety-seven times in a hundred."
- **Added value to a named audience.** The one-sentence pitch at 0:00 and the close.

## Rehearsal

- Read it aloud alone, with a timer. Three minutes is shorter than it looks.
- Then together with the slides, at least twice. Hand-offs cost time.
- Then once with the demo on a phone, on the venue's network if you can.
- If you run over, cut from section 2, not section 1 or 4. The opening earns attention and the
  close is what they remember.

Target 2:50 in rehearsal. A timed talk always runs longer in the room.

## If someone asks

- **Is this not just a database lookup?** The rules are written for people, not machines, and a
  sixth of them are incomplete or contradictory. Deciding when we cannot answer is the work, and
  filling the gaps is a prediction we had to measure.
- **How do you know the rules are right?** It is the city's own published data, and we show it.
  When it disagrees with itself, we say so instead of picking one.
- **What if the sign says something different?** Trust the sign. We never claim to give
  permission, only to show what the city published.
- **Does it work everywhere?** The data is best in the centre. Further out more streets come back
  as unknown, and we would rather say that than invent an answer.
