import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { clipCatalog } from '../src/data/clips.js';
import { groupByDiscoveryRail, searchAudioGifs } from '../src/search/searchEngine.js';

export default function ZappApp() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchAudioGifs(query, clipCatalog, { season: 'ramadan' }), [query]);
  const rails = useMemo(() => groupByDiscoveryRail(clipCatalog), []);

  const sendClip = (clip) => {
    // Native bridge contract: preview immediately, copy/share the encoded clip, and append attribution.
    globalThis.ZappNativeBridge?.sendAudioGif({
      id: clip.id,
      audioUrl: clip.audioUrl,
      previewUrl: clip.previewUrl,
      caption: clip.attribution
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#130f1f' }}>
      <View style={{ padding: 20, gap: 16 }}>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>Zapp</Text>
        <Text style={{ color: '#b9a9ff', fontSize: 16 }}>
          Search → Tap → Sent. Audio GIFs for the sound already in your head.
        </Text>
        <TextInput
          accessibilityLabel="Search Audio GIFs by trigger or source"
          placeholder="brb, cringe, I got a bonus…"
          placeholderTextColor="#8f86a8"
          value={query}
          onChangeText={setQuery}
          style={{ backgroundColor: '#251d3f', color: '#fff', borderRadius: 18, padding: 16 }}
        />
        {!query && (
          <Text style={{ color: '#f9d66d' }}>
            Trending trigger rails: {Object.keys(rails.triggers).slice(0, 3).join(' • ')}
          </Text>
        )}
      </View>
      <FlatList
        data={results}
        keyExtractor={(clip) => clip.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send ${item.title} Audio GIF`}
            onPress={() => sendClip(item)}
            style={{ backgroundColor: '#201833', borderRadius: 22, padding: 16, flexDirection: 'row', gap: 14 }}
          >
            <Text style={{ fontSize: 34 }}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: '#bdb3d6' }}>{item.source} · {item.durationMs / 1000}s</Text>
              <Text style={{ color: '#8779aa', marginTop: 4 }}>{item.attribution}</Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
