import { ringFace } from './ring';
import { tamagotchiFace } from './tamagotchi';
import { tomatoFace } from './tomato';
import type { Face, FaceId } from './types';

export const FACES: Record<FaceId, () => Face> = {
  ring: ringFace,
  tomato: tomatoFace,
  tamagotchi: tamagotchiFace,
};

export const FACE_LIST: { id: FaceId; label: string; preview: string }[] = (Object.keys(FACES) as FaceId[]).map((id) => {
  const f = FACES[id]();
  return { id, label: f.label, preview: f.preview };
});

export type { Face, FaceContext, FaceEvent, FaceId } from './types';
