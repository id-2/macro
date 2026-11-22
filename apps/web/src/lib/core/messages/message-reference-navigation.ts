import type { ReplyTargetData } from '@rox-one/lexical-core';
import { createContext } from 'solid-js';

/** A message surface can handle a reference locally before durable route navigation. */
export const MessageReferenceNavigation =
  createContext<(target: ReplyTargetData) => boolean>();
