import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DETAIL_LABELS, DetailKey, Recognition } from '../../shared/recognition';
export function CarDetails({ result }: { result: Recognition }) {
  return <View style={s.box}>
    <Text style={s.title}>AI identification · {result.confidence === 'unknown' ? 'unconfirmed' : `${result.confidence} confidence`}</Text>
    <Text style={s.body}>{result.summary}</Text>
    {!!result.visualClues.length && <Text style={s.body}>Visual clues: {result.visualClues.join(' · ')}</Text>}
    {!!result.alternatives.length && <Text style={s.body}>Other possibilities: {result.alternatives.join(', ')}</Text>}
    <Text style={s.note}>AI suggestions, not verified specifications. Model information may differ for this particular car.</Text>
    {(Object.keys(DETAIL_LABELS) as DetailKey[]).map(key => {
      const detail = result.details[key];
      return <View key={key} style={s.detail}><Text style={s.label}>{DETAIL_LABELS[key]}</Text><Text style={s.value}>{detail.value || 'Unknown'}</Text>{detail.value && <Text style={s.note}>{detail.basis === 'visible' ? 'From photo' : 'Model information'} · {detail.confidence} confidence</Text>}</View>;
    })}
  </View>;
}
const s = StyleSheet.create({ box: { padding: 18, gap: 12, backgroundColor: '#1B2221', borderRadius: 16 }, title: { color: '#D5FF60', fontSize: 15, fontWeight: '700' }, body: { color: '#C5CEC8', fontSize: 14, lineHeight: 21 }, note: { color: '#9AA99F', fontSize: 12, lineHeight: 18 }, detail: { gap: 4, borderTopWidth: 1, borderColor: '#344039', paddingTop: 12 }, label: { color: '#AAB4B3', fontSize: 12 }, value: { color: '#F4F5ED', fontSize: 16, fontWeight: '600' } });
