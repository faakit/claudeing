import { registerStatWatcher } from '../systems/goals';
import { toast } from '../systems/events';
import { digWorms } from '../systems/fishing';
import { t } from '../i18n';

// The free bait: tilling and clearing weeds turns up worms now and then (fishing needs bait; owner, bait round).
registerStatWatcher('bait:worms', (state) => {
  const n = digWorms(state);
  if (n > 0) toast(t('fishing.dugWorms', { n }), 'good');
});
