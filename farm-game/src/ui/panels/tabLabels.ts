import { t, type Key } from '../../i18n';

/** The built-in menu tabs, in order. Their labels live in the dictionaries (`tab.<id>`) and must fit a 48 px tab. */
export const TAB_IDS = ['bag', 'goals', 'craft', 'skills', 'book', 'opts'] as const;
export type TabId = (typeof TAB_IDS)[number];

/** A built-in tab's label in the current language (tests prove each fits its button in every language). */
export const tabLabel = (id: TabId): string => t(`tab.${id}` as Key);
