/**
 * Options > Cloud save: who is signed in, when the cloud last matched this phone, and the one or two buttons that
 * matter now (Sign in; Sync now and Turn off; Choose a save). Laid out like the Controls page: text from the top,
 * buttons from the bottom of the tab area up, where the thumb is. Shown only where cloud save is usable.
 */
import { cloudSync } from '../../game/cloudWiring';
import { getState } from '../../state/store';
import { gameEvents } from '../../systems/events';
import { t } from '../../i18n';
import { fitRow } from '../font';
import { C } from '../theme';
import type { MenuTabContext } from './MenuPanel';
import { agoText } from './cloudText';

/** Whether Options shows the cloud page (kept while the menu is reopened, until Back). */
export const cloudPage = { open: false };

export function buildCloudPage(c: MenuTabContext, back: () => void): void {
  const st = cloudSync.status;
  const half = 92;
  // the button used most sits on the holding thumb's side (mirrored for the left hand)
  const thumbX = getState().settings.leftHanded ? 8 : 100;
  const farX = getState().settings.leftHanded ? 100 : 8;
  let y = c.bottom - 26;
  c.button(8, y, c.width - 16, 22, t('common.back'), back, { textColor: C.creamDim });
  y -= 26;
  const signedIn = st.account !== null;
  const rebuildAfter = (p: Promise<unknown>) => void p.finally(() => c.rebuild());
  if (st.state === 'off' || st.state === 'signedOut' || st.state === 'signingIn') {
    c.button(8, y, c.width - 16, 22, t('cloud.signIn'), () => rebuildAfter(cloudSync.signIn()), {
      textColor: C.gold,
    }).setEnabled(st.state !== 'signingIn');
  } else {
    const left = st.state === 'conflict';
    c.button(
      thumbX,
      y,
      half,
      22,
      left ? t('cloud.choose') : t('cloud.syncNow'),
      () => {
        if (left) {
          // the dialog opens once the menu has closed (UIScene)
          c.close();
          gameEvents.emit('cloudConflict', undefined);
        } else rebuildAfter(cloudSync.save('manual'));
      },
      { textColor: C.gold },
    ).setEnabled(st.state !== 'newer' && st.state !== 'syncing');
    c.button(farX, y, half, 22, t('cloud.turnOff'), () => rebuildAfter(cloudSync.signOut()));
  }

  // Text, top down.
  let ty = c.top + 4;
  const line = (text: string, color: number = C.cream, wrap = false): void => {
    const l = c.label(
      8,
      ty,
      wrap ? text : fitRow(text, 184),
      color,
      1,
      'left',
      wrap ? 184 : undefined,
    );
    ty += Math.max(11, Math.round(l.textHeight) + 4);
  };
  line(t('cloud.title'), C.gold);
  if (st.state === 'off') line(t('cloud.off'), C.creamDim, true);
  else if (!signedIn) line(t('cloud.notSignedIn'), C.creamDim);
  else line(st.account ? t('cloud.signedInAs', { name: st.account }) : t('cloud.signedIn'));
  if (st.state !== 'off')
    line(
      st.lastSync !== null
        ? t('cloud.lastSynced', { ago: agoText(st.lastSync, Date.now()) })
        : t('cloud.neverSynced'),
      C.creamDim,
    );
  if (st.state === 'newer') line(t('cloud.newer'), C.warn, true);
  ty += 4;
  line(t('cloud.privacy'), C.creamDim, true);
  line(`${t('opts.autosave1')} ${t('opts.autosave2')}`, C.creamDim, true);
}
