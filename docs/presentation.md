# Spotlight talk: Parkkiko

Three minutes, week 42. The audience is drivers, not data scientists, so nothing below says
pipeline, parquet, classifier or geospatial. Graded on preparation, so the point of this file is
that three people can rehearse the same thing.

Three speakers, roughly a minute each. **Read it aloud with a timer before you trust it.**

| | Who | Section | Target |
|---|---|---|---|
| 0:00 | Jamila | The moment every driver knows | 0:45 |
| 0:45 | Mai | What Parkkiko does, live on screen | 1:45 |
| 1:45 | Ömer Furkan | Why you can trust it, and what it refuses to say | 2:50 |
| 2:50 | — | Close | 3:00 |

---

## The script

### 1. The problem (Jamila, 0:00–0:45)

> You have found a space on a street in Helsinki. The sign is somewhere behind you. Is parking
> free right now? Until when? Is this spot even for you, or is it a loading bay?
>
> Most of us guess. Last year Helsinki issued **156,383 parking fines**, plus nine thousand
> warnings. Most of those drivers were not being reckless. They misread a sign, or never saw it.
>
> Here is the strange part. Helsinki already publishes every one of these rules, free and open to
> anyone. The problem is that it looks like this.

*Slide 2 shows the raw register: `9-21, (9-18)`, `4 h`, `ei aikarajoitusta`. Let it sit for a
beat. The laugh is the point: nobody can read this at the kerb.*

### 2. The answer (Mai, 0:45–1:45)

> So we turned it into something you can read while you are standing next to your car.
>
> This is Parkkiko. It opens where you are. You tap the stretch of street you parked on, and
> choose which side you are on, because the rules differ between the two sides and your phone
> cannot tell them apart.
>
> And it tells you one thing: **paid until nine, then free until nine tomorrow morning.** Not a
> code. Not a sign to decipher. The answer, and when it changes.
>
> It knows the awkward cases too. This one looks like an ordinary space, and it is reserved for
> an electric scooter. There are about a thousand spaces like that in Helsinki. It knows that a public
> holiday follows Sunday rules, so on Christmas Day it will not tell you to pay.

*Demo live if the connection holds. Otherwise the recorded clip on slide 4. Decide on the day,
and whoever is not speaking opens the fallback before the session starts.*

### 3. The trust (Ömer Furkan, 1:45–2:50)

> Now, the honest part, and it is the reason we would use this ourselves.
>
> The city's own data does not describe every street perfectly. For about one stretch in six,
> the rule is incomplete or contradicts itself.
>
> Most apps would guess. We don't. Where we know, we say so. Where we are unsure, Parkkiko says
> **check the sign**, and shows you what the city actually published, so you can decide.
>
> That sounds like a weakness. It is the whole point. A wrong "you can park here" costs you a
> fine. An honest "I'm not sure" costs you nothing.
>
> Where the city left the hours out, we fill them in from the nearby stretches of the same kind,
> and we tell you that is an estimate. We only do it when we are confident, and we measured that:
> it is right about ninety-seven times in a hundred.

### Close (anyone, 2:50–3:00)

> Parkkiko. It tells you when you can park, and admits when nobody knows.

---

## Slides

Six, no more. Nobody reads a slide and listens at the same time.

1. **Title.** Parkkiko, and the one line: *May I park here, and until when?*
2. **The register as it really looks.** Raw strings, unreadable on purpose.
3. **The map.** Whole city, coloured by what you may do.
4. **The answer card.** One stretch of street, the plain-language answer and the timeline.
5. **Check the sign.** The uncertain state, showing honesty as a feature.
6. **Close.** The one line again, and where to try it.

Use the figures already generated in `docs/figures/` rather than making new ones.

## What not to say

Say the left column. The right column is what we say to each other, and it loses a driver.

| Say | Not |
|---|---|
| stretch of street | parking area, polygon, segment |
| the city's data | the register, the open data portal, WFS |
| we fill in the gaps from nearby streets | nearest-neighbour imputation |
| right about 97 times in 100 | 97.5% accuracy against a 32.9% baseline |
| check the sign | uncertain status, issue code |
| about one stretch in six | 1,363 of 8,754 |

Numbers out loud: say **a hundred and fifty-six thousand fines**, not the exact figure. One
precise number is memorable; four are noise.

## Rehearsal

- Read it aloud alone, with a timer. Three minutes is shorter than it looks.
- Then together, with the slides, at least twice. Hand-offs between speakers cost time.
- Then once with the demo on a phone, on the venue's network if you can.
- If you run over, cut from section 3, not section 1. The opening is what earns attention.

Target 2:50 in rehearsal. A timed talk always runs longer in the room.

## If someone asks

- **How do you know the rules are right?** We use the city's own published data, and we show it.
  When it disagrees with itself, we say so instead of picking one.
- **What if the sign on the street says something different?** Trust the sign. We never claim to
  give permission, only to show what the city published.
- **Does it work everywhere in Helsinki?** The data is best in the centre. Further out, more
  streets come back as unknown, and we would rather say that than invent an answer.
- **Who is it for?** Anyone parking in central Helsinki without a resident's permit, especially
  visitors who have never seen these signs before.

---

*Structure borrowed from the standard elevator-pitch shape: open on the listener's problem, show
the answer, give one reason to believe it, close on a single line. The video linked in the brief
could not be read automatically, so check this against what it actually recommends.*
