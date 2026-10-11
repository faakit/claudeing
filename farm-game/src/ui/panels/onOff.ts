import { t } from '../../i18n';

/** "ON" / "OFF" for a switch's label, in the current language. */
export const onOff = (on: boolean): string => t(on ? 'common.on' : 'common.off');
