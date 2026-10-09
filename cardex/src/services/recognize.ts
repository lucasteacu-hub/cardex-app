import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { isRecognition, Recognition } from '../../shared/recognition';
export async function recognizeCar(uri: string, signal: AbortSignal): Promise<Recognition> {
  const host = Constants.expoConfig?.hostUri;
  const token = Constants.expoConfig?.extra?.recognitionToken;
  if (!__DEV__ || !host || !token) throw new Error('AI is not connected. Open the development preview on your Mac.');
  let resizedUri: string | undefined;
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: 1600 });
    const rendered = await context.renderAsync();
    const photo = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .75, base64: true });
    resizedUri = photo.uri;
    rendered.release(); context.release();
    if (signal.aborted) throw new Error('Identification cancelled.');
    if (!photo.base64 || photo.base64.length > 5.5 * 1024 * 1024) throw new Error('This photo is too large. Try a smaller image.');
    const protocol = host.includes('.exp.direct') ? 'https' : 'http';
    const response = await fetch(`${protocol}://${host}/api/recognize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: `data:image/jpeg;base64,${photo.base64}` }), signal,
    });
    let data: unknown;
    try { data = await response.json(); } catch { throw new Error('Your Mac needs to restart CarDex before AI can connect.'); }
    if (!response.ok) throw new Error(typeof (data as {error?: unknown})?.error === 'string' ? (data as {error: string}).error : 'AI could not identify this photo. Please try again.');
    if (!isRecognition(data)) throw new Error('AI returned incomplete details. Please try again.');
    return data;
  } finally {
    if (resizedUri && resizedUri !== uri) { try { const file = new File(resizedUri); if (file.exists) file.delete(); } catch { /* Best-effort temporary-file cleanup. */ } }
  }
}
