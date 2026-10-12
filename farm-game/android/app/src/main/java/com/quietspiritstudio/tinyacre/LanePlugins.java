package com.quietspiritstudio.tinyacre;

import com.quietspiritstudio.tinyacre.plugins.PlayGamesSavesPlugin;
import com.getcapacitor.BridgeActivity;

/**
 * The app's own Capacitor plugins (custom Java under plugins/), registered before the bridge starts.
 * npm-installed plugins register themselves through `cap sync` and are not listed here.
 * One line per plugin (and its import), so each lane's merge touches only its own line.
 */
final class LanePlugins {

    private LanePlugins() {}

    static void register(BridgeActivity activity) {
        // Cloud save (content owned by release/cloud-save): Play Games Saved Games. Inert without a project id.
        activity.registerPlugin(PlayGamesSavesPlugin.class);
    }
}
