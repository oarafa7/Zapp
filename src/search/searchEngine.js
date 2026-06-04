const normalize = (value = '') =>
  value
    .toString()
    .trim()
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ');

const tokenize = (value) => normalize(value).split(' ').filter(Boolean);

export function createSearchIndex(clips) {
  return clips.map((clip) => {
    const triggerText = clip.triggerTags.join(' ');
    const sourceText = [clip.title, clip.source, clip.archive, ...clip.characterTags].join(' ');
    return {
      clip,
      triggerTokens: new Set(tokenize(triggerText)),
      sourceTokens: new Set(tokenize(sourceText)),
      haystack: normalize([triggerText, sourceText, clip.locale].join(' '))
    };
  });
}

export function searchAudioGifs(query, clips, options = {}) {
  const { limit = 10, locale, season } = options;
  const terms = tokenize(query);
  const normalizedQuery = normalize(query);

  if (!terms.length) {
    return clips
      .slice()
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  return createSearchIndex(clips)
    .map(({ clip, triggerTokens, sourceTokens, haystack }) => {
      let score = 0;
      for (const term of terms) {
        if (triggerTokens.has(term)) score += 6;
        if (sourceTokens.has(term)) score += 4;
        if (haystack.includes(term)) score += 2;
      }
      if (haystack.includes(normalizedQuery)) score += 5;
      if (locale && clip.locale.startsWith(locale)) score += 2;
      if (season && clip.seasonalBoosts.includes(season)) score += 3;
      score += clip.popularity / 100;
      return { clip, score };
    })
    .filter((result) => result.score > 1)
    .sort((a, b) => b.score - a.score || b.clip.popularity - a.clip.popularity)
    .slice(0, limit)
    .map((result) => result.clip);
}

export function groupByDiscoveryRail(clips) {
  return clips.reduce((rails, clip) => {
    const primaryTrigger = clip.triggerTags[0] || 'reaction';
    const sourceRail = `${clip.archive}: ${clip.source}`;
    rails.triggers[primaryTrigger] = [...(rails.triggers[primaryTrigger] || []), clip];
    rails.sources[sourceRail] = [...(rails.sources[sourceRail] || []), clip];
    return rails;
  }, { triggers: {}, sources: {} });
}

export { normalize };
