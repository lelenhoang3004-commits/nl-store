/**
 * Base model.
 * Domain models can use this helper for controlled object serialization later.
 */
export class BaseModel {
  constructor(attributes = {}) {
    Object.assign(this, attributes);
  }

  toJSON() {
    return { ...this };
  }
}
