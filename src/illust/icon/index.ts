import type { IllustGroup } from '../types';
import { home } from './home';
import { listen } from './listen';
import { hint } from './hint';
import { undo } from './undo';
import { rotate } from './rotate';
import { eraser } from './eraser';
import { go } from './go';
import { look } from './look';
import { done } from './done';
import { next } from './next';
import { lock } from './lock';
import { heart } from './heart';
import { heartOn } from './heart-on';
import { notebook } from './notebook';
import { recount } from './recount';
import { picture } from './picture';
import { register } from './register';
import { again } from './again';
import { house } from './house';
import { speakerOff } from './speaker-off';

export const iconIllust: IllustGroup = {
  home: home,
  listen: listen,
  hint: hint,
  undo: undo,
  rotate: rotate,
  eraser: eraser,
  go: go,
  look: look,
  done: done,
  next: next,
  lock: lock,
  heart: heart,
  'heart-on': heartOn,
  notebook: notebook,
  recount: recount,
  picture: picture,
  register: register,
  again: again,
  house: house,
  'speaker-off': speakerOff,
};
