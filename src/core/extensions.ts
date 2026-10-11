import { ALL_EXTENSIONS } from 'virtual:molstar-extensions';

export { ALL_EXTENSIONS };

const alternation = [...ALL_EXTENSIONS].join('|');

// For URLs: extension must end the path or be followed by a query/hash.
export const EXT_REGEX = new RegExp(`\\.(${alternation})(?:[?#&]|$)`, 'i');

// For free text (table rows, page headers): same as the old inline regex.
export const TEXT_EXT_REGEX = new RegExp(`\\.(${alternation})\\b`, 'i');
