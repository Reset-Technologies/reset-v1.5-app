const { withMainApplication } = require("expo/config-plugins");

/**
 * Config plugin: wire the Twilio Voice SDK into the Android Application lifecycle.
 *
 * @twilio/voice-react-native-sdk requires a `VoiceApplicationProxy` to be
 * constructed and `onCreate()`d from the host Application. Without it, the
 * autolinked TwilioVoiceReactNativePackage instantiates at RN startup and reads
 * `VoiceApplicationProxy.getJSEventEmitter()`, which is null — crashing the app
 * with a NullPointerException right after the splash screen, before any screen
 * renders. (iOS has no equivalent Application-lifecycle requirement, so it was
 * unaffected.)
 *
 * MainApplication.kt is generated (the android/ dir is gitignored / managed
 * workflow), so editing it by hand wouldn't survive prebuild or reach EAS.
 * This plugin re-applies the edits every prebuild. The proxy's onCreate() MUST
 * run before loadReactNative(this) so the JSEventEmitter exists before the
 * Twilio native module initializes.
 */
module.exports = function withTwilioVoiceAndroid(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Import the proxy.
    const importLine = "import com.twiliovoicereactnative.VoiceApplicationProxy";
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        "import android.content.res.Configuration",
        `import android.content.res.Configuration\n\n${importLine}`
      );
    }

    // 2. Declare the proxy as an Application field (stores the Application ref;
    //    safe to construct here — it isn't used until onCreate()).
    if (!contents.includes("voiceApplicationProxy")) {
      contents = contents.replace(
        /(class MainApplication : Application\(\), ReactApplication \{)/,
        `$1\n\n  // Twilio Voice SDK Application-lifecycle proxy (see withTwilioVoiceAndroid).\n  private val voiceApplicationProxy = VoiceApplicationProxy(this)`
      );

      // 3. Initialize the proxy before React Native loads its native modules.
      contents = contents.replace(
        /(override fun onCreate\(\) \{\n\s*super\.onCreate\(\))/,
        `$1\n    voiceApplicationProxy.onCreate()`
      );

      // 4. Tear it down on terminate (best-effort; Android may not call this).
      contents = contents.replace(
        /(\n  override fun onConfigurationChanged)/,
        `\n  override fun onTerminate() {\n    voiceApplicationProxy.onTerminate()\n    super.onTerminate()\n  }\n$1`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
