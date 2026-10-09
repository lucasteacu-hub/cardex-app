export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type DetailKey = 'generation' | 'years' | 'trim' | 'bodyStyle' | 'color' | 'engine' | 'power' | 'torque' | 'transmission' | 'drivetrain' | 'fuelType' | 'acceleration' | 'topSpeed';
export type Recognition = {
  status: 'identified' | 'uncertain' | 'no_car' | 'multiple_cars';
  make: string | null; model: string | null; confidence: Confidence; summary: string;
  visualClues: string[]; alternatives: string[];
  details: Record<DetailKey, { value: string | null; basis: 'visible' | 'model_knowledge' | 'unknown'; confidence: Confidence }>;
};
export const DETAIL_LABELS: Record<DetailKey, string>;
export function isRecognition(value: unknown): value is Recognition;
export const schema: object;
