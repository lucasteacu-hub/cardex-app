const DETAIL_LABELS = {
  generation: 'Generation', years: 'Possible model years', trim: 'Trim / variant',
  bodyStyle: 'Body style', color: 'Colour', engine: 'Engine', power: 'Power',
  torque: 'Torque', transmission: 'Transmission', drivetrain: 'Drivetrain',
  fuelType: 'Fuel / power source', acceleration: '0–100 km/h', topSpeed: 'Top speed',
};
const fieldSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    value: { type: ['string', 'null'] },
    basis: { type: 'string', enum: ['visible', 'model_knowledge', 'unknown'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
  }, required: ['value', 'basis', 'confidence'],
};
const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['identified', 'uncertain', 'no_car', 'multiple_cars'] },
    make: { type: ['string', 'null'] }, model: { type: ['string', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
    summary: { type: 'string' },
    visualClues: { type: 'array', items: { type: 'string' } },
    alternatives: { type: 'array', items: { type: 'string' } },
    details: { type: 'object', additionalProperties: false, properties: Object.fromEntries(Object.keys(DETAIL_LABELS).map(k => [k, fieldSchema])), required: Object.keys(DETAIL_LABELS) },
  }, required: ['status', 'make', 'model', 'confidence', 'summary', 'visualClues', 'alternatives', 'details'],
};
function isRecognition(r) {
  const str = (s, n) => typeof s === 'string' && s.length <= n;
  const nullable = s => s === null || (str(s, 160) && !!s.trim());
  const list = a => Array.isArray(a) && a.length <= 8 && a.every(s => str(s, 350));
  if (!r || !['identified', 'uncertain', 'no_car', 'multiple_cars'].includes(r.status) ||
      !nullable(r.make) || !nullable(r.model) ||
      !['high', 'medium', 'low', 'unknown'].includes(r.confidence) ||
      !str(r.summary, 1200) || !list(r.visualClues) || !list(r.alternatives) || !r.details) return false;
  if (r.status === 'identified' && (!r.make || !r.model)) return false;
  if (['no_car', 'multiple_cars'].includes(r.status) && (r.make !== null || r.model !== null)) return false;
  return Object.keys(DETAIL_LABELS).every(k => {
    const f = r.details[k];
    if (!f || !nullable(f.value) || !['visible', 'model_knowledge', 'unknown'].includes(f.basis) || !['high', 'medium', 'low', 'unknown'].includes(f.confidence)) return false;
    return f.value === null ? f.basis === 'unknown' && f.confidence === 'unknown' : f.basis !== 'unknown' && f.confidence !== 'unknown';
  });
}
module.exports = { DETAIL_LABELS, schema, isRecognition };
