import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recognition, isRecognition } from './shared/recognition';
import { recognizeCar } from './src/services/recognize';
import { CarDetails } from './src/components/CarDetails';

type Car = { id: string; make: string; model: string; uri: string; caughtAt: string; recognition?: Recognition };
const KEY = 'cardex.collection.v1';
const lime = '#D5FF60';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? .4 : pressed ? .75 : 1 }]}><Text style={[s.buttonText, secondary && { color: '#FFF' }]}>{title}</Text></Pressable>;
}
function CarDex() {
  const [cars, setCars] = useState<Car[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const scanController = useRef<AbortController | null>(null);
  const scanVersion = useRef(0);
  const [search, setSearch] = useState('');
  function cancelScan() {
    scanVersion.current++;
    scanController.current?.abort(); scanController.current = null;
    setScanning(false);
  }
  function closeDraft() { cancelScan(); setDraft(null); }
  useEffect(() => () => { scanController.current?.abort(); }, []);
  async function identify() {
    if (!draft || scanning || scanController.current) return;
    const version = ++scanVersion.current;
    const controller = new AbortController(); scanController.current = controller;
    setScanning(true); setScanError(''); setRecognition(null);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
    try {
      const result = await recognizeCar(draft, controller.signal);
      if (scanVersion.current !== version) return;
      setRecognition(result);
      if (result.status === 'identified' || result.status === 'uncertain') {
        setMake(result.make || ''); setModel(result.model || '');
      } else { setMake(''); setModel(''); }
    } catch (error) {
      if (scanVersion.current !== version) return;
      setScanError(timedOut ? 'Identification took too long. Try again or enter the car details yourself.' : error instanceof TypeError ? 'Could not reach your Mac. Keep CarDex running and check the connection.' : error instanceof Error ? error.message : 'Identification failed. You can still save manually.');
    } finally {
      clearTimeout(timeout);
      if (scanVersion.current === version) { setScanning(false); scanController.current = null; }
    }
  }
  const identityChanged = !!recognition && (make.trim().toLowerCase() !== (recognition.make || '').trim().toLowerCase() || model.trim().toLowerCase() !== (recognition.model || '').trim().toLowerCase());
  const [selected, setSelected] = useState<Car | null>(null);
  function load() {
    return AsyncStorage.getItem(KEY).then(raw => {
      const data: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data) || !data.every(c => c && ['id', 'make', 'model', 'uri', 'caughtAt'].every(k => typeof c[k] === 'string'))) throw new Error('Invalid collection');
      setLoadError(false);
      setCars(data.map(c => ({ ...c, recognition: isRecognition(c.recognition) ? c.recognition : undefined })));
      setReady(true);
    }).catch(() => setLoadError(true));
  }
  useEffect(() => { void load(); }, []);
  async function pick(camera: boolean) {
    if (locked.current || !ready) return;
    locked.current = true; setBusy(true);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph a car. You can also choose an existing photo.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } }]);
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .8, allowsEditing: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) { cancelScan(); setRecognition(null); setScanError(''); setMake(''); setModel(''); setDraft(result.assets[0].uri); }
    } catch { Alert.alert('Could not open the photo', 'Please try again, or choose another photo.'); }
    finally { locked.current = false; setBusy(false); }
  }
  async function save() {
    if (locked.current || scanning || !draft || !make.trim() || !model.trim()) return;
    locked.current = true; setBusy(true);
    let copy: File | undefined;
    try {
      const folder = new Directory(Paths.document, 'cars'); folder.create({ idempotent: true, intermediates: true });
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const source = new File(draft);
      copy = new File(folder, `${id}${source.extension || '.jpg'}`);
      source.copy(copy);
      const car: Car = { id, make: make.trim(), model: model.trim(), uri: copy.uri, caughtAt: new Date().toISOString(), recognition: recognition && !identityChanged && ['identified', 'uncertain'].includes(recognition.status) ? recognition : undefined };
      const next = [car, ...cars];
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      setCars(next); setDraft(null);
    } catch {
      try { if (copy?.exists) copy.delete(); } catch { /* Preserve the save error. */ }
      Alert.alert('Could not save your car', 'Your photo is still here. Check your free storage and try again.');
    } finally { locked.current = false; setBusy(false); }
  }
  function remove(car: Car) {
    Alert.alert('Remove this catch?', `${car.make} ${car.model} will be removed from your collection.`, [{ text: 'Keep it', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => {
      if (locked.current) return;
      locked.current = true; setBusy(true);
      try {
        const next = cars.filter(c => c.id !== car.id);
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        setCars(next); setSelected(null);
        try { const file = new File(car.uri); if (file.exists) file.delete(); } catch { /* Collection removal succeeded. */ }
      } catch { Alert.alert('Could not remove this car', 'Please try again.'); }
      finally { locked.current = false; setBusy(false); }
    } }]);
  }
  const filtered = cars.filter(c => `${c.make} ${c.model}`.toLowerCase().includes(search.trim().toLowerCase()));
  const brands = new Set(cars.map(c => c.make.toLowerCase())).size;
  return <SafeAreaView style={s.root}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View style={s.row}><Text style={s.logo}>car<Text style={{ color: lime }}>dex.</Text></Text><View style={s.pill}><Text style={s.eyebrow}>FIELD TEST / 001</Text></View></View>
      <Text style={s.kicker}>THE STREETS ARE YOUR COLLECTION</Text>
      <Text style={s.hero}>Great cars.{'\n'}Found by you.</Text>
      <Text style={s.body}>Spot something special. Take a photo. Keep the catch.</Text>
      <View style={s.stats}><View><Text style={s.number}>{String(cars.length).padStart(2, '0')}</Text><Text style={s.caption}>CARS CAUGHT</Text></View><View style={s.divider}/><View><Text style={s.number}>{String(brands).padStart(2, '0')}</Text><Text style={s.caption}>BRANDS FOUND</Text></View><Text style={s.star}>✦</Text></View>
      <Button title={busy ? 'One moment…' : '＋  Catch a car'} disabled={!ready || busy} onPress={() => { void pick(true); }} />
      <Button title="Choose from photos" secondary disabled={!ready || busy} onPress={() => { void pick(false); }} />
      <View style={s.note}><Text style={s.noteTitle}>Your first test drive</Text><Text style={s.small}>Photograph a car, ask AI to identify it, then review its details. Your garage keeps your original photo. Unknown specs stay unknown.</Text></View>
      <View style={[s.row, { marginTop: 10 }]}><Text style={s.heading}>Your garage</Text><Text style={s.muted}>{cars.length} catches</Text></View>
      {!ready ? <View style={s.empty}>{loadError ? <><Text style={s.body}>Your collection could not be loaded. Your saved data has not been replaced.</Text><Button title="Try again" onPress={() => { void load(); }}/></> : <ActivityIndicator color={lime}/>}</View> : cars.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>＋</Text><Text style={s.heading}>Every collection starts with one.</Text><Text style={[s.body, { textAlign: 'center' }]}>Your first catch belongs right here.{'\n'}Find a car that makes you look twice.</Text></View> : <>
        <TextInput accessibilityLabel="Search your collection" placeholder="Search make or model" placeholderTextColor="#858F9C" style={s.input} value={search} onChangeText={setSearch}/>
        {filtered.length === 0 && <Text style={s.body}>No cars match that search.</Text>}
        {filtered.map(car => <Pressable accessibilityRole="button" accessibilityLabel={`View ${car.make} ${car.model}`} key={car.id} onPress={() => setSelected(car)} style={s.card}><Image source={{ uri: car.uri }} style={s.cardPhoto}/><View style={s.cardInfo}><Text style={s.kicker}>{car.make.toUpperCase()}</Text><Text style={s.heading}>{car.model}</Text><Text style={s.muted}>Caught {new Date(car.caughtAt).toLocaleDateString()}</Text></View><Text style={s.arrow}>↗</Text></Pressable>)}
      </>}
      <Text style={s.footer}>MADE FOR THE ONES WHO ALWAYS LOOK BACK.</Text>
    </ScrollView>
    <Modal visible={!!draft} animationType="slide" onRequestClose={() => { if (!busy) closeDraft(); }}>
      <SafeAreaView style={s.root}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><Text style={s.kicker}>NEW CATCH</Text><Text style={s.hero}>Make it yours.</Text>{draft && <Image source={{ uri: draft }} style={s.preview}/>}
        <Text style={s.body}>Let AI identify this car, then check the result before saving.</Text>
        <Text style={s.small}>Identify sends a resized copy of this photo to OpenAI. Your original photo stays in your garage.</Text>
        <Button title={scanning ? 'Looking for identifying details…' : recognition || scanError ? 'Try AI again' : 'Identify this car'} disabled={busy || scanning} onPress={() => { void identify(); }}/>
        {scanning && <><ActivityIndicator color={lime}/><Button title="Stop identifying" secondary onPress={cancelScan}/></>}
        {!!scanError && <View style={s.note}><Text accessibilityRole="alert" style={s.small}>{scanError}</Text></View>}
        {recognition && <CarDetails result={recognition}/>}
        {identityChanged && <Text style={s.small}>You changed the car identity. Its AI specifications will not be saved, so they cannot be attached to the wrong model.</Text>}
        <Text style={s.small}>You can correct these names, or enter them yourself.</Text>
        <Text style={s.label}>Make</Text><TextInput accessibilityLabel="Car make" style={s.input} placeholder="e.g. Porsche" placeholderTextColor="#858F9C" value={make} onChangeText={setMake} maxLength={60} editable={!busy && !scanning}/>
        <Text style={s.label}>Model</Text><TextInput accessibilityLabel="Car model" style={s.input} placeholder="e.g. 911 GT3" placeholderTextColor="#858F9C" value={model} onChangeText={setModel} maxLength={80} editable={!busy && !scanning}/>
        <Button title={busy ? 'Saving…' : 'Add to my garage  ↗'} onPress={() => { void save(); }} disabled={busy || scanning || !make.trim() || !model.trim()}/><Button title="Cancel" secondary disabled={busy} onPress={closeDraft}/>
      </ScrollView></KeyboardAvoidingView></SafeAreaView>
    </Modal>
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => { if (!busy) setSelected(null); }}><SafeAreaView style={s.root}>{selected && <ScrollView contentContainerStyle={s.page}><Text style={s.kicker}>IN YOUR COLLECTION</Text><Text style={s.hero}>{selected.make}</Text><Text style={s.heading}>{selected.model}</Text><Image source={{ uri: selected.uri }} style={s.preview} resizeMode="contain"/><Text style={s.body}>Caught on {new Date(selected.caughtAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text><Text style={s.small}>Original photo · {selected.recognition ? 'AI suggested identity' : 'Named by you'} · Saved on this device</Text>{selected.recognition && <CarDetails result={selected.recognition}/>}<Button title="Back to my garage" disabled={busy} onPress={() => setSelected(null)}/><Button title="Remove catch" secondary disabled={busy} onPress={() => remove(selected)}/></ScrollView>}</SafeAreaView></Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><CarDex/></SafeAreaProvider>; }
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101416' }, page: { padding: 24, gap: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  logo: { fontSize: 34, fontWeight: '900', color: '#FFF', letterSpacing: -2 }, pill: { borderWidth: 1, borderColor: '#3B4545', padding: 9, borderRadius: 20 },
  eyebrow: { color: '#C5CDC8', fontSize: 9, fontWeight: '700', letterSpacing: 1 }, kicker: { color: lime, fontSize: 10, letterSpacing: 1.8, fontWeight: '800', marginTop: 10 },
  hero: { fontSize: 45, lineHeight: 48, fontWeight: '800', color: '#F4F5ED', letterSpacing: -1.8 }, body: { color: '#AAB4B3', fontSize: 16, lineHeight: 24 },
  stats: { paddingVertical: 24, flexDirection: 'row', alignItems: 'center', gap: 25, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#303737', marginVertical: 4 },
  number: { fontSize: 34, color: '#F4F5ED', fontWeight: '600' }, caption: { fontSize: 9, color: '#AAB4B3', letterSpacing: 1, marginTop: 5 }, divider: { width: 1, height: 40, backgroundColor: '#303737' }, star: { color: lime, fontSize: 45, marginLeft: 'auto' },
  button: { backgroundColor: lime, borderRadius: 16, padding: 19, alignItems: 'center' }, buttonText: { color: '#171D12', fontWeight: '800', fontSize: 16 }, secondary: { backgroundColor: '#202829', borderWidth: 1, borderColor: '#354041' },
  note: { padding: 18, backgroundColor: '#1B2221', borderRadius: 16, gap: 8 }, noteTitle: { color: '#E4E9DB', fontWeight: '700' }, small: { color: '#ABB7AD', fontSize: 13, lineHeight: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: '#F4F5ED' }, muted: { color: '#96A39E', fontSize: 12 }, empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#3E4943', borderRadius: 22, padding: 24, gap: 16, alignItems: 'center' }, emptyIcon: { color: lime, fontSize: 36 },
  input: { borderWidth: 1, borderColor: '#404B4C', borderRadius: 12, padding: 16, backgroundColor: '#1B2224', color: '#FFF', fontSize: 16 }, label: { color: '#F4F5ED', fontWeight: '600' },
  card: { backgroundColor: '#202729', borderRadius: 20, overflow: 'hidden' }, cardPhoto: { width: '100%', height: 210, backgroundColor: '#2A3333' }, cardInfo: { padding: 18, gap: 8 }, arrow: { position: 'absolute', right: 20, bottom: 28, color: lime, fontSize: 28 },
  preview: { width: '100%', height: 290, borderRadius: 20, backgroundColor: '#202729' }, footer: { color: '#71807A', textAlign: 'center', fontSize: 9, letterSpacing: 1.5, marginTop: 16 },
});
