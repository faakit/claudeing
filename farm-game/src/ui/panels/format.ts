import { fmtNum } from '../../i18n';

export const SHOP_ID = 'town_general_store';
/** A whole number in the current language's style (1,234 or 1.234). */
export const fmt = (n: number): string => fmtNum(n);
