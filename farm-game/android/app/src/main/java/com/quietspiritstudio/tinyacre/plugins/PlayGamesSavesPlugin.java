package com.quietspiritstudio.tinyacre.plugins;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.games.GamesClientStatusCodes;
import com.google.android.gms.games.PlayGames;
import com.google.android.gms.games.PlayGamesSdk;
import com.google.android.gms.games.SnapshotsClient;
import com.google.android.gms.games.snapshot.Snapshot;
import com.google.android.gms.games.snapshot.SnapshotMetadata;
import com.google.android.gms.games.snapshot.SnapshotMetadataChange;
import java.nio.charset.StandardCharsets;

/**
 * Tiny Acre cloud save: Play Games Services v2 Saved Games, one snapshot holding the same JSON the game keeps
 * locally. The JS side is src/platform/cloudsave/playGames.ts; the rules (conflicts, queueing) live in JS.
 *
 * Never touches the Games SDK unless a numeric `game_services_project_id` is configured (resValue from
 * TINY_ACRE_PGS_PROJECT_ID or android/local.properties `pgs.projectId`) and Google Play services is present,
 * so a build without config behaves exactly as before: available() is false and the game hides cloud save.
 *
 * Rejection codes the JS maps: UNAVAILABLE, SIGNED_OUT, OFFLINE, CONFLICT, FAILED.
 */
@CapacitorPlugin(name = "PlayGamesSaves")
public class PlayGamesSavesPlugin extends Plugin {

    private boolean ready = false;

    @Override
    public void load() {
        Context ctx = getContext();
        int res = ctx.getResources().getIdentifier("game_services_project_id", "string", ctx.getPackageName());
        String projectId = res == 0 ? "" : ctx.getString(res).trim();
        if (!projectId.matches("\\d{6,}")) return;
        try {
            if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(ctx) != ConnectionResult.SUCCESS) return;
            PlayGamesSdk.initialize(ctx);
            ready = true;
        } catch (RuntimeException e) {
            ready = false;
        }
    }

    @PluginMethod
    public void available(PluginCall call) {
        JSObject out = new JSObject();
        out.put("available", ready);
        call.resolve(out);
    }

    /** Silent: is the automatic Play Games sign-in done, and the player's Play Games display name (a gamer name). */
    @PluginMethod
    public void status(PluginCall call) {
        if (!guard(call)) return;
        PlayGames.getGamesSignInClient(getActivity())
            .isAuthenticated()
            .addOnCompleteListener(t -> {
                boolean signedIn = t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated();
                resolvePlayer(call, signedIn);
            });
    }

    /** The manual sign-in (shows the Play Games sheet). */
    @PluginMethod
    public void signIn(PluginCall call) {
        if (!guard(call)) return;
        PlayGames.getGamesSignInClient(getActivity())
            .signIn()
            .addOnCompleteListener(t -> {
                boolean signedIn = t.isSuccessful() && t.getResult() != null && t.getResult().isAuthenticated();
                resolvePlayer(call, signedIn);
            });
    }

    private void resolvePlayer(PluginCall call, boolean signedIn) {
        JSObject out = new JSObject();
        out.put("signedIn", signedIn);
        if (!signedIn) {
            call.resolve(out);
            return;
        }
        PlayGames.getPlayersClient(getActivity())
            .getCurrentPlayer()
            .addOnCompleteListener(p -> {
                if (p.isSuccessful() && p.getResult() != null) out.put("player", p.getResult().getDisplayName());
                call.resolve(out);
            });
    }

    /** Read the snapshot: { data: string | null, modified: number }. An empty snapshot reads as null. */
    @PluginMethod
    public void load(PluginCall call) {
        if (!guard(call)) return;
        String name = call.getString("name", "farm");
        SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
        client
            .open(name, true, SnapshotsClient.RESOLUTION_POLICY_HIGHEST_PROGRESS)
            .addOnCompleteListener(t -> {
                if (!t.isSuccessful()) {
                    reject(call, t.getException());
                    return;
                }
                SnapshotsClient.DataOrConflict<Snapshot> r = t.getResult();
                if (r.isConflict()) {
                    call.reject("conflict", "CONFLICT");
                    return;
                }
                Snapshot snap = r.getData();
                try {
                    byte[] bytes = snap.getSnapshotContents().readFully();
                    JSObject out = new JSObject();
                    out.put("data", bytes == null || bytes.length == 0 ? null : new String(bytes, StandardCharsets.UTF_8));
                    out.put("modified", snap.getMetadata().getLastModifiedTimestamp());
                    call.resolve(out);
                } catch (Exception e) {
                    call.reject("read failed", "FAILED");
                } finally {
                    client.discardAndClose(snap);
                }
            });
    }

    /**
     * Write the snapshot: { name, data, description, playedTimeMillis, progressValue } -> { modified }.
     * Offline, Play Games caches the commit and uploads it on reconnect (so OFFLINE is rare here).
     */
    @PluginMethod
    public void save(PluginCall call) {
        if (!guard(call)) return;
        String name = call.getString("name", "farm");
        String data = call.getString("data");
        if (data == null) {
            call.reject("no data", "FAILED");
            return;
        }
        String description = call.getString("description", "");
        long played = call.getLong("playedTimeMillis", 0L);
        long progress = call.getLong("progressValue", 0L);
        SnapshotsClient client = PlayGames.getSnapshotsClient(getActivity());
        client
            .open(name, true, SnapshotsClient.RESOLUTION_POLICY_HIGHEST_PROGRESS)
            .addOnCompleteListener(t -> {
                if (!t.isSuccessful()) {
                    reject(call, t.getException());
                    return;
                }
                SnapshotsClient.DataOrConflict<Snapshot> r = t.getResult();
                if (r.isConflict()) {
                    call.reject("conflict", "CONFLICT");
                    return;
                }
                Snapshot snap = r.getData();
                snap.getSnapshotContents().writeBytes(data.getBytes(StandardCharsets.UTF_8));
                SnapshotMetadataChange change = new SnapshotMetadataChange.Builder()
                    .setDescription(description)
                    .setPlayedTimeMillis(played)
                    .setProgressValue(progress)
                    .build();
                client
                    .commitAndClose(snap, change)
                    .addOnCompleteListener(c -> {
                        if (!c.isSuccessful()) {
                            reject(call, c.getException());
                            return;
                        }
                        SnapshotMetadata meta = c.getResult();
                        JSObject out = new JSObject();
                        out.put("modified", meta == null ? System.currentTimeMillis() : meta.getLastModifiedTimestamp());
                        call.resolve(out);
                    });
            });
    }

    private boolean guard(PluginCall call) {
        if (ready && getActivity() != null) return true;
        call.reject("Play Games is not configured", "UNAVAILABLE");
        return false;
    }

    private void reject(PluginCall call, Exception e) {
        if (e instanceof ApiException) {
            int code = ((ApiException) e).getStatusCode();
            if (code == GamesClientStatusCodes.SIGN_IN_REQUIRED || code == CommonStatusCodes.SIGN_IN_REQUIRED) {
                call.reject("sign-in required", "SIGNED_OUT");
                return;
            }
            if (code == CommonStatusCodes.NETWORK_ERROR || code == GamesClientStatusCodes.NETWORK_ERROR_NO_DATA) {
                call.reject("offline", "OFFLINE");
                return;
            }
        }
        call.reject(e == null ? "failed" : String.valueOf(e.getMessage()), "FAILED");
    }
}
