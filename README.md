# ![](icon.ico) Piano Marvel Enhancements

User script to enhance pianomarvel.com with new features.

- **MIDI Shortcuts**: Control the Piano Marvel web app using your MIDI device (piano/keyboard).


![schreenshot](https://user-images.githubusercontent.com/1504597/82356211-e86a2200-99c8-11ea-8fb3-2de2b38ba6c6.png)


## Requirements

Requires one of the following browser plugins:
  - [Violentmonkey](https://violentmonkey.github.io/)
  - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
  - [Tampermonkey](https://www.tampermonkey.net/)

If your browser supports the MIDI Access API (check [here](https://developer.mozilla.org/en-US/docs/Web/API/MIDIAccess#Browser_compatibility)), you may not need the following. However, I recommend installing them anyway for the best experience. If you are having issues (such as your MIDI device not showing up), these plugins may help.
- [Jazz-Plugin](https://jazz-soft.net/download/Jazz-Plugin/)
- [Jazz-MIDI](https://jazz-soft.net/download/#jazzmidi)


## Install

Click here to install: [pianoMarvelEnhancements.user.js](https://github.com/yo1dog/piano-marvel-enhancements/raw/master/src/pianoMarvelEnhancements.user.js)

Because pianomarvel.com does not use HTTPS, Chrome (and perhaps other browsers) normally does not allow it to access your MIDI devices. To get around this you must:
1. Navigate to chrome://flags/#unsafely-treat-insecure-origin-as-secure
2. Enable the feature and add `http://pianomarvel.com`
3. Restart Chrome.


## Usage

1. Once you install the user script, navigate to the pianomarvel.com web app.
2. Select "Menu" from the top left and you will notice a new "MIDI Shortcuts" section at the bottom.
3. Select the MIDI device you want to use to activate shortcuts.
4. Select the action you want to set a shortcut for.
5. Click the record button.
6. Play a sequence of notes that will active the shortcut. Must be 1-5 notes. The timing of your notes does not matter, only the sequence. Make sure to choose sequences that you will not play by accident.
7. Click the stop button.
8. Repeat for all desired actions.

Your shortcuts are automatically saved in your browser so you only have to set them up once.

To activate a shortcut, simply play the sequence of notes. Again, timing does not matter and simultaneous notes are not supported. However, the full sequence must be played within 5 seconds.

The following actions are supported:

action  | effect
--------|-------
Back    | Clicks the << button at the bottom.
Next    | Clicks the >> button at the bottom.
Prepare | Clicks the Prepare button at the bottom.
Assess  | Clicks the Assess button at the bottom.
Stop    | Clicks the Prepare or the Assess button at the bottom if they are active.


## Debugging

I suggest installed in the Jazz plugins listed above for the best experience.

If the list of MIDI devices is not updating, try restarting your browser. This may be necessary depending on your browser, operating system, and/or plugins.

Check the messages in the output box in the MIDI Shortcuts module in the menu. Check your browser's console logs for more verbose information.