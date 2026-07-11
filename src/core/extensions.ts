import { ALL_EXTENSIONS } from 'virtual:molstar-extensions';

export { ALL_EXTENSIONS };
export const EXT_REGEX = new RegExp(`\\.(${[...ALL_EXTENSIONS].join('|')})(?:[?#&]|$)`, 'i');
