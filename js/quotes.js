/* The inscriptions. Three circles, read from the bottom of the page up:
     inferno    — carved into the stone at the foot of every page
     purgatorio — printed into the page itself, mid-way
     paradiso   — inlaid in the gold plaque at the top
   `short` is the fragment cut into the side rails; keep it under ~34 chars.
   Everything here is public domain (pre-1930, or old translations). */

export const QUOTES = {
  inferno: [
    { text: 'All hope abandon, ye who enter in!', short: 'Abandon all hope', by: 'Dante', work: 'Inferno, III' },
    { text: 'There is no greater sorrow than to be mindful of the happy time in misery.', short: 'No greater sorrow', by: 'Dante', work: 'Inferno, V' },
    { text: 'Hell is empty, and all the devils are here.', short: 'Hell is empty', by: 'Shakespeare', work: 'The Tempest' },
    { text: 'Life’s but a walking shadow, a poor player that struts and frets his hour upon the stage, and then is heard no more.', short: 'Out, out, brief candle', by: 'Shakespeare', work: 'Macbeth' },
    { text: 'It is a tale told by an idiot, full of sound and fury, signifying nothing.', short: 'Signifying nothing', by: 'Shakespeare', work: 'Macbeth' },
    { text: 'Stars, hide your fires; let not light see my black and deep desires.', short: 'Stars, hide your fires', by: 'Shakespeare', work: 'Macbeth' },
    { text: 'What’s done cannot be undone.', short: 'What’s done cannot be undone', by: 'Shakespeare', work: 'Macbeth' },
    { text: 'As flies to wanton boys are we to the gods; they kill us for their sport.', short: 'As flies to wanton boys', by: 'Shakespeare', work: 'King Lear' },
    { text: 'Nothing will come of nothing.', short: 'Nothing will come of nothing', by: 'Shakespeare', work: 'King Lear' },
    { text: 'The rest is silence.', short: 'The rest is silence', by: 'Shakespeare', work: 'Hamlet' },
    { text: 'These violent delights have violent ends.', short: 'Violent delights, violent ends', by: 'Shakespeare', work: 'Romeo and Juliet' },
    { text: 'For never was a story of more woe than this of Juliet and her Romeo.', short: 'A story of more woe', by: 'Shakespeare', work: 'Romeo and Juliet' },
    { text: 'Better to reign in Hell, than serve in Heaven.', short: 'Better to reign in Hell', by: 'Milton', work: 'Paradise Lost' },
    { text: 'Beware; for I am fearless, and therefore powerful.', short: 'Beware; for I am fearless', by: 'Mary Shelley', work: 'Frankenstein' },
    { text: 'I am malicious because I am miserable.', short: 'Malicious because miserable', by: 'Mary Shelley', work: 'Frankenstein' },
    { text: 'I cannot live without my life! I cannot live without my soul!', short: 'I cannot live without my soul', by: 'Emily Brontë', work: 'Wuthering Heights' },
    { text: 'Be with me always—take any form—drive me mad! only do not leave me in this abyss, where I cannot find you!', short: 'Drive me mad', by: 'Emily Brontë', work: 'Wuthering Heights' },
    { text: 'The horror! The horror!', short: 'The horror! The horror!', by: 'Joseph Conrad', work: 'Heart of Darkness' },
    { text: 'Quoth the Raven, “Nevermore.”', short: 'Nevermore', by: 'Edgar Allan Poe', work: 'The Raven' },
    { text: 'Each man kills the thing he loves.', short: 'Each man kills the thing he loves', by: 'Oscar Wilde', work: 'The Ballad of Reading Gaol' },
    { text: 'The only way to get rid of a temptation is to yield to it.', short: 'Yield to it', by: 'Oscar Wilde', work: 'The Picture of Dorian Gray' },
    { text: 'Look on my Works, ye Mighty, and despair!', short: 'Look on my works, and despair', by: 'Percy Bysshe Shelley', work: 'Ozymandias' },
    { text: 'I will show you fear in a handful of dust.', short: 'Fear in a handful of dust', by: 'T. S. Eliot', work: 'The Waste Land' },
    { text: 'This is the way the world ends, not with a bang but a whimper.', short: 'Not with a bang', by: 'T. S. Eliot', work: 'The Hollow Men' },
    { text: 'Things fall apart; the centre cannot hold.', short: 'Things fall apart', by: 'W. B. Yeats', work: 'The Second Coming' },
    { text: 'I felt a Funeral, in my Brain.', short: 'I felt a funeral, in my brain', by: 'Emily Dickinson', work: 'Poem 340' },
    { text: 'I am a sick man. … I am a spiteful man.', short: 'I am a spiteful man', by: 'Dostoevsky', work: 'Notes from Underground' },
    { text: 'Man is sometimes extraordinarily, passionately, in love with suffering.', short: 'In love with suffering', by: 'Dostoevsky', work: 'Notes from Underground' },
    { text: 'Pain and suffering are always inevitable for a large intelligence and a deep heart.', short: 'A large intelligence, a deep heart', by: 'Dostoevsky', work: 'Crime and Punishment' },
    { text: 'Darkling I listen; and, for many a time I have been half in love with easeful Death.', short: 'Half in love with easeful death', by: 'John Keats', work: 'Ode to a Nightingale' },
    { text: 'Hearts are made to be broken.', short: 'Hearts are made to be broken', by: 'Oscar Wilde', work: 'De Profundis' },
    { text: 'Nature, red in tooth and claw.', short: 'Red in tooth and claw', by: 'Tennyson', work: 'In Memoriam A.H.H.' },
  ],

  purgatorio: [
    { text: 'Midway upon the journey of our life I found myself within a forest dark, for the straightforward pathway had been lost.', short: 'Midway upon the journey', by: 'Dante', work: 'Inferno, I' },
    { text: 'We are all in the gutter, but some of us are looking at the stars.', short: 'Looking at the stars', by: 'Oscar Wilde', work: 'Lady Windermere’s Fan' },
    { text: 'The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.', short: 'The mind is its own place', by: 'Milton', work: 'Paradise Lost' },
    { text: 'So we beat on, boats against the current, borne back ceaselessly into the past.', short: 'Boats against the current', by: 'F. Scott Fitzgerald', work: 'The Great Gatsby' },
    { text: 'Do I dare disturb the universe?', short: 'Do I dare disturb the universe?', by: 'T. S. Eliot', work: 'Prufrock' },
    { text: 'For now we see through a glass, darkly.', short: 'Through a glass, darkly', by: 'St Paul', work: '1 Corinthians (KJV)' },
    { text: 'To strive, to seek, to find, and not to yield.', short: 'To strive, to seek, to find', by: 'Tennyson', work: 'Ulysses' },
    { text: 'Though much is taken, much abides.', short: 'Much is taken, much abides', by: 'Tennyson', work: 'Ulysses' },
    { text: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.', short: 'Such stuff as dreams', by: 'Shakespeare', work: 'The Tempest' },
    { text: 'We know what we are, but know not what we may be.', short: 'Know not what we may be', by: 'Shakespeare', work: 'Hamlet' },
    { text: 'There is nothing either good or bad, but thinking makes it so.', short: 'Thinking makes it so', by: 'Shakespeare', work: 'Hamlet' },
    { text: 'The course of true love never did run smooth.', short: 'The course of true love', by: 'Shakespeare', work: 'A Midsummer Night’s Dream' },
    { text: 'Lord, what fools these mortals be!', short: 'What fools these mortals be', by: 'Shakespeare', work: 'A Midsummer Night’s Dream' },
    { text: 'It was the best of times, it was the worst of times.', short: 'The best of times, the worst', by: 'Charles Dickens', work: 'A Tale of Two Cities' },
    { text: 'I am no bird; and no net ensnares me: I am a free human being with an independent will.', short: 'I am no bird', by: 'Charlotte Brontë', work: 'Jane Eyre' },
    { text: 'You pierce my soul. I am half agony, half hope.', short: 'Half agony, half hope', by: 'Jane Austen', work: 'Persuasion' },
    { text: 'I have spread my dreams under your feet; tread softly because you tread on my dreams.', short: 'Tread softly', by: 'W. B. Yeats', work: 'He Wishes for the Cloths of Heaven' },
    { text: 'The woods are lovely, dark and deep, but I have promises to keep.', short: 'Lovely, dark and deep', by: 'Robert Frost', work: 'Stopping by Woods' },
    { text: 'Be not afeard; the isle is full of noises, sounds and sweet airs, that give delight and hurt not.', short: 'Be not afeard', by: 'Shakespeare', work: 'The Tempest' },
    { text: 'I declare after all there is no enjoyment like reading!', short: 'No enjoyment like reading', by: 'Jane Austen', work: 'Pride and Prejudice' },
    { text: 'I am half-sick of shadows.', short: 'Half-sick of shadows', by: 'Tennyson', work: 'The Lady of Shalott' },
  ],

  paradiso: [
    { text: 'The Love which moves the sun and the other stars.', short: 'The love that moves the sun', by: 'Dante', work: 'Paradiso, XXXIII' },
    { text: 'I know a bank where the wild thyme blows, where oxlips and the nodding violet grows.', short: 'Where the wild thyme blows', by: 'Shakespeare', work: 'A Midsummer Night’s Dream' },
    { text: 'And though she be but little, she is fierce.', short: 'Though she be but little', by: 'Shakespeare', work: 'A Midsummer Night’s Dream' },
    { text: 'Love looks not with the eyes, but with the mind, and therefore is winged Cupid painted blind.', short: 'Love looks not with the eyes', by: 'Shakespeare', work: 'A Midsummer Night’s Dream' },
    { text: 'Doubt thou the stars are fire; doubt that the sun doth move; doubt truth to be a liar; but never doubt I love.', short: 'But never doubt I love', by: 'Shakespeare', work: 'Hamlet' },
    { text: 'My bounty is as boundless as the sea, my love as deep; the more I give to thee, the more I have, for both are infinite.', short: 'Boundless as the sea', by: 'Shakespeare', work: 'Romeo and Juliet' },
    { text: 'So long as men can breathe or eyes can see, so long lives this, and this gives life to thee.', short: 'So long lives this', by: 'Shakespeare', work: 'Sonnet 18' },
    { text: 'O brave new world, that has such people in’t!', short: 'O brave new world', by: 'Shakespeare', work: 'The Tempest' },
    { text: 'Whatever our souls are made of, his and mine are the same.', short: 'Whatever our souls are made of', by: 'Emily Brontë', work: 'Wuthering Heights' },
    { text: 'To see a World in a Grain of Sand, and a Heaven in a Wild Flower.', short: 'A heaven in a wild flower', by: 'William Blake', work: 'Auguries of Innocence' },
    { text: '“Hope” is the thing with feathers, that perches in the soul.', short: 'Hope is the thing with feathers', by: 'Emily Dickinson', work: 'Poem 254' },
    { text: 'She walks in beauty, like the night of cloudless climes and starry skies.', short: 'She walks in beauty', by: 'Lord Byron', work: 'She Walks in Beauty' },
    { text: 'Beauty is truth, truth beauty,—that is all ye know on earth, and all ye need to know.', short: 'Beauty is truth, truth beauty', by: 'John Keats', work: 'Ode on a Grecian Urn' },
    { text: 'A thing of beauty is a joy for ever.', short: 'A joy for ever', by: 'John Keats', work: 'Endymion' },
    { text: 'And the light shineth in darkness; and the darkness comprehended it not.', short: 'The light shineth in darkness', by: 'St John', work: 'John 1:5 (KJV)' },
    { text: 'Grow old along with me! The best is yet to be.', short: 'The best is yet to be', by: 'Robert Browning', work: 'Rabbi Ben Ezra' },
    { text: 'How do I love thee? Let me count the ways.', short: 'Let me count the ways', by: 'Elizabeth Barrett Browning', work: 'Sonnet 43' },
    { text: 'I have loved the stars too fondly to be fearful of the night.', short: 'Loved the stars too fondly', by: 'Sarah Williams', work: 'The Old Astronomer' },
    { text: 'There is no charm equal to tenderness of heart.', short: 'Tenderness of heart', by: 'Jane Austen', work: 'Emma' },
  ],
};

let last = {};
/** A random quote from a circle, never the same one twice in a row. */
export function pick(circle) {
  const bank = QUOTES[circle];
  let q;
  do q = bank[Math.floor(Math.random() * bank.length)];
  while (bank.length > 1 && q === last[circle]);
  last[circle] = q;
  return q;
}
