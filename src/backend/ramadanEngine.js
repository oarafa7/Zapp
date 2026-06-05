const requiredClipFields = ['id', 'title', 'source', 'archive', 'locale', 'durationMs', 'triggerTags', 'audioUrl', 'previewUrl'];

export function validateClipPayload(payload) {
  const missing = requiredClipFields.filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length) {
    return { valid: false, errors: missing.map((field) => `${field} is required`) };
  }

  const errors = [];
  if (!Array.isArray(payload.triggerTags) || payload.triggerTags.length < 1) {
    errors.push('triggerTags must include at least one conversational trigger');
  }
  if (payload.durationMs > 7000) {
    errors.push('durationMs must stay under 7000ms for instant Audio GIF sharing');
  }
  if (!['UMS', 'Maspero', 'Rotana', 'Viral Culture', 'International'].includes(payload.archive)) {
    errors.push('archive must map to a supported licensing/archive bucket');
  }

  return { valid: errors.length === 0, errors };
}

export class RamadanInjectionQueue {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
    this.queue = [];
  }

  submit(payload, admin) {
    const validation = validateClipPayload(payload);
    if (!validation.valid) {
      return { accepted: false, errors: validation.errors };
    }

    const item = {
      ...payload,
      id: payload.id,
      submittedBy: admin,
      submittedAt: this.now().toISOString(),
      status: payload.rightsStatus === 'licensed' ? 'ready_for_publish' : 'needs_rights_review',
      seasonalBoosts: Array.from(new Set([...(payload.seasonalBoosts || []), 'ramadan'])),
      attribution: payload.attribution || 'Sent via Zapp'
    };
    this.queue.push(item);
    return { accepted: true, item };
  }

  publishReady() {
    const ready = this.queue.filter((item) => item.status === 'ready_for_publish');
    this.queue = this.queue.filter((item) => item.status !== 'ready_for_publish');
    return ready.map((item) => ({ ...item, publishedAt: this.now().toISOString() }));
  }
}
