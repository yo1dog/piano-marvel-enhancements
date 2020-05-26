# ![](icon.ico) Piano Marvel Enhancements

User script to enhance pianomarvel.com with new features.

- **MIDI Shortcuts**: Control the Piano Marvel web app using your MIDI device (piano/keyboard).


![schreenshot](https://user-images.githubusercontent.com/1504597/82495016-17a78e80-9ab0-11ea-837b-1e425023e490.png)


There are 2 versions of this app: "integrated" and "external".

Integrated works with the Piano Marvel plugin so no additional plugins are required. However, **shortcuts do not work during assess mode.**. External **usually requires additional plugins** and listens to your MIDI device directly. External also requires your MIDI driver to support Multi-Client (default OSX drivers do, Windows do not) or additional workarounds will be required.


## Requirements

One of the following browser plugins is required:
  - [Violentmonkey](https://violentmonkey.github.io/)
  - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
  - [Tampermonkey](https://www.tampermonkey.net/)

The external version will **likely** require the following Jazz plugins. If your browser supports the MIDI Access API (Chrome, Edge), you may not. However, I strongly recommend installing them anyway for the best experience. If you insist, check bellow for hints on using the external version without installing these plugins.
  - [Jazz-Plugin](https://jazz-soft.net/download/Jazz-Plugin/)
  - [Jazz-MIDI](https://jazz-soft.net/download/#jazzmidi)


## Install

Click to install one of:
  - [Integrated](https://github.com/yo1dog/piano-marvel-enhancements/raw/master/bin/pianoMarvelEnhancements.integrated.user.js)
  - [External](https://github.com/yo1dog/piano-marvel-enhancements/raw/master/bin/pianoMarvelEnhancements.external.user.js)


## Usage

1. Once you install the user script, navigate to the pianomarvel.com web app.
2. Click "Menu" at the top left and you will notice a new "MIDI Shortcuts" section at the bottom.
3. If you are using the integrated version, make sure the status says "Connected". If you are using the external version, select the MIDI input you want to use.
4. Select the action you want to set a shortcut for.
5. Click the record button.
6. Play a sequence of notes that will activate the shortcut. Must be 1-5 notes. The timing of your notes does not matter, only the sequence. Make sure to choose sequences that you will not play by accident.
7. Click the stop button.
8. Repeat for all desired actions.
9. To remove a shortcut, click the record button and then the stop button without playing any notes.

Your shortcuts are automatically saved in your browser so you only have to set them up once.

To activate a shortcut, simply play the sequence of notes. Again, timing does not matter and simultaneous notes are not supported. However, the full sequence must be played within 5 seconds.

The following actions are supported:

action        | effect | equivalent
--------------|--------|------------
Back          | Goes back. | Pressing the left arrow key or clicking the << button.
Next          | Goes forward. | Pressing the right arrow key or clicking the >> button.
Prepare       | Starts or stops prepare mode. | Pressing the 1 key or clicking the Prepare button.
Assess        | Starts or stops assess mode. | Pressing the 2 key or clicking the Assess button.
Start/Stop    | Starts or stops the last used mode (prepare or assess). | Pressing the space key.
Start/Restart | Starts or restarts the last used mode (prepare or assess). | Pressing the space key twice with a delay.


## Issues / Debugging

Check the messages at the bottom of the menu. Check your browser's console logs for more verbose information.

### Integrated

Shortcuts don't work during assess mode. This is unfortunately a known bug. The Piano Marvel plugin refuses to relay the notes being played during assess mode and I have not figured out a solution around this problem.

"Unable to find Piano Marvel WebSocket." Try hard-refreshing the page. If that doesn't help, try closing and reopening the Piano Marvel plugin. It is important that you close the plugin using the "Exit the application" button. Using the "Restart the application" does not force the Piano Marvel app to reconnect. Closing the plugin window only minimizes or backgrounds the plugin and does not actually close it.

This is caused by a race condition between the user script and the page's JavaScript execution time. The user script monkey patches the WebSocket class so it can intercept and capture the WebSocket that the Piano Marvel app creates. If this is not done before page's JavaScript executes and creates the WebSocket, the only remedy is to force the Piano Marvel app to create a new WebSocket. This can be done by closing the WebSocket by closing the plugin.

### External

If you are having issues (such as your MIDI device not showing up) and you don't have the Jazz plugins installed (listed above), install them.

If the list of MIDI devices is not updating, try restarting your browser. This may be necessary depending on your browser, operating system, device, and/or plugins.

If Piano Marvel and the app can't listen to your MIDI device at the same time, this probably means your drivers do not support multi-client. This means only 1 client (Piano Marvel Plugin or Jazz Plugin) can listen to your MIDI device. The default OSX drivers support multi-client. The default Windows drivers do not. You can try the following workarounds:
  - Install a custom generic driver like [FlexASIO](https://github.com/dechamps/FlexASIO).
  - Create a virtual MIDI device that supports multi-client (or create multiple virtual devices), route your physical device through the virtual, and connect Piano Marvel and the shortcuts to the virtual. You can use tools like [loopMidi](https://www.tobias-erichsen.de/software/loopmidi.html) and [LoopBe1](https://www.nerds.de/en/loopbe1.html) to create a virtual MIDI device with multi-client support and tools like [MIDI-OX](http://www.midiox.com/) or [Banana](https://www.vb-audio.com/Voicemeeter/banana.htm) to reroute the MIDI output.

### External Without Jazz Plugins

First verify [here](https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess#Browser_compatibility) that your browser supports the MIDI Access API.

Next, because pianomarvel.com does not use HTTPS, Chrome and other Chromium browsers such as Edge disable access to your MIDI devices. To get around this you must:
1. Navigate to chrome://flags/#unsafely-treat-insecure-origin-as-secure
2. Enable the feature and add `http://pianomarvel.com`
3. Restart your browser.

Without the plugins you may need to refresh the page and/or restart the browser after connecting new MIDI devices.
