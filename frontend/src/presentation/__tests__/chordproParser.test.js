import { describe, it, expect } from 'vitest';
import { parseChordProBlocks } from '../chordproParser';

describe('parseChordProBlocks', () => {
  it('correctly parses song with indented chorus before Verse 1 (Song 6138)', () => {
    const text = `#NZSSOT 2023-2024
#The Church

  I see [F]Christ in [C]you, as [Dm]He is in [G]me
  Re[F]flecting the [C]Lord so [Dm]radiant[G]ly

1
The [C]Church is deep [F]within God's heart

2
The Church is not a physical building`;

    const blocks = parseChordProBlocks(text);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toEqual('chorus');
    expect(blocks[0].label).toEqual('Chorus');
    expect(blocks[1].type).toEqual('verse');
    expect(blocks[1].label).toEqual('Verse 1');
    expect(blocks[2].type).toEqual('verse');
    expect(blocks[2].label).toEqual('Verse 2');
  });

  it('correctly handles songs without any section headers (Song 12085)', () => {
    const text = `And [C]day by day (day by day)
continuing steadfastly

Praising God and
having grace with all the people`;

    const blocks = parseChordProBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].label).toEqual('');
    expect(blocks[1].label).toEqual('');
  });

  it('ignores comment lines starting with # in songs without explicit section headers (Song 4)', () => {
    const text = `#Capo 3

[G]Oh what a [D]mystery! [Em]Christ in you, [C]Christ in me!
[G]Oh what a [D]victory! [Em]Christ in you, [C]Christ in me!

[G]Christ is in [D]you,
though the [Em]body’s dead be[C]cause of sin.
[G]The spirit’s [D]life because of [Em]righteousness[C].
#Romans 8:10`;

    const blocks = parseChordProBlocks(text);
    expect(blocks).toHaveLength(2);
    const allLyrics = blocks.flatMap(b => b.lines.map(l => l.lyric));
    expect(allLyrics).not.toContain('#Capo 3');
    expect(allLyrics).not.toContain('#Romans 8:10');
  });
});
