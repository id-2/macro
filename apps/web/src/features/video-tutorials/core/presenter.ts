import sergeyPhoto from '../assets/121413592.png';
import igorPhoto from '../assets/cerebrass.webp';
import mariaPhoto from '../assets/fcks.webp';
import alekseyPhoto from '../assets/gens.webp';
import pavelPhoto from '../assets/macs.webp';
import { TUTORIAL_IDS, type TutorialId } from './tutorial-id';

/** A person named under a tutorial. Names stay as written; they are not translated. */
export type TutorialStaff = {
  name: string;
  role: string;
  photo: string;
};

export const TUTORIAL_STAFF = [
  {
    name: 'Алексей Морозов',
    role: 'руководитель',
    photo: alekseyPhoto,
  },
  {
    name: 'Мария Соколова',
    role: 'поддержка',
    photo: mariaPhoto,
  },
  {
    name: 'Игорь Белов',
    role: 'технический директор',
    photo: igorPhoto,
  },
  {
    name: 'Павел Орлов',
    role: 'поддержка',
    photo: pavelPhoto,
  },
  {
    name: 'Сергей Волков',
    role: 'поддержка',
    photo: sergeyPhoto,
  },
] as const satisfies readonly TutorialStaff[];

/** The person named under this lesson, with their portrait. */
export function tutorialStaff(id: TutorialId): TutorialStaff {
  const index = TUTORIAL_IDS.indexOf(id);
  return TUTORIAL_STAFF[(index < 0 ? 0 : index) % TUTORIAL_STAFF.length];
}

/** The first byline, for a surface that names one person. */
export const TUTORIAL_PRESENTER = TUTORIAL_STAFF[0].name;
