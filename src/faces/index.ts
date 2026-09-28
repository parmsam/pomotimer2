import { blobFace } from './blob';
import { hamsterFace } from './hamster';
import { handheldFace } from './handheld';
import { hourglassFace } from './hourglass';
import { plantFace } from './plant';
import { potionFace } from './potion';
import { ringFace } from './ring';
import { robotFace } from './robot';
import { spaceshipFace } from './spaceship';
import { tamagotchiFace } from './tamagotchi';
import { tetrisFace } from './tetris';
import { tomatoFace } from './tomato';
import type { Face, FaceId } from './types';

export const FACES: Record<FaceId, () => Face> = {
  ring: ringFace,
  tomato: tomatoFace,
  tamagotchi: tamagotchiFace,
  hourglass: hourglassFace,
  plant: plantFace,
  robot: robotFace,
  handheld: handheldFace,
  potion: potionFace,
  tetris: tetrisFace,
  blob: blobFace,
  spaceship: spaceshipFace,
  hamster: hamsterFace,
};

export const FACE_LIST: { id: FaceId; label: string; preview: string }[] = (Object.keys(FACES) as FaceId[]).map((id) => {
  const f = FACES[id]();
  return { id, label: f.label, preview: f.preview };
});

export type { Face, FaceContext, FaceEvent, FaceId } from './types';
