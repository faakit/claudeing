import { t } from '../../i18n';
/** The Move sheet's line: what comes along when an occupied building is moved. Pure, so tests can fit it. */
export const moveText = (occupants: string | null): string =>
  occupants ? t('move.withOccupants', { occupants }) : t('move.toBag');
