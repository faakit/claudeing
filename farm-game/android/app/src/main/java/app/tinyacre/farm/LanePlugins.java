package app.tinyacre.farm;

import app.tinyacre.farm.plugins.PlayGamesSavesPlugin;
import com.getcapacitor.BridgeActivity;

/**
 * The app's own Capacitor plugins (custom Java under plugins/), registered before the bridge starts.
 * npm-installed plugins register themselves through `cap sync` and are not listed here.
 * One line per plugin, so each lane's merge touches only its own line.
 */
final class LanePlugins {

    private LanePlugins() {}

    static void register(BridgeActivity activity) {
        // Cloud save (release/cloud-save): Play Games Saved Games. Inert without a game_services_project_id.
        activity.registerPlugin(PlayGamesSavesPlugin.class);
    }
}
