import type { SelfControlsRecord } from '../readers/self-controls.reader';

export const SELF_CONTROLS_WRITER = Symbol('SelfControlsWriter');

export interface SelfControlsWriter {
  upsert(record: SelfControlsRecord): Promise<SelfControlsRecord>;
}
