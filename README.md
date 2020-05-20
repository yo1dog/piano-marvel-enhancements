# ![](icon.ico) Piano Marvel Enhancements

User script to enhance pianomarvel.com with new features.

- **MIDI Shortcuts**: Control the Piano Marvel web app using your MIDI device (piano/keyboard).


![schreenshot](https://user-images.githubusercontent.com/1504597/82356211-e86a2200-99c8-11ea-8fb3-2de2b38ba6c6.png)


## Requirements

Requires one of the following browser plugins:
  - [Violentmonkey](https://violentmonkey.github.io/)
  - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
  - [Tampermonkey](https://www.tampermonkey.net/)


## Install

Click here to install: [pianoMarvelEnhancements.user.js](https://github.com/yo1dog/piano-marvel-enhancements/raw/master/src/pianoMarvelEnhancements.user.js)


## Usage

1. Once you install the user script, navigate to the pianomarvel.com web app.
2. Click "Menu" at the top left and you will notice a new "MIDI Shortcuts" section at the bottom.
3. Select the action you want to set a shortcut for.
4. Click the record button.
5. Play a sequence of notes that will activate the shortcut. Must be 1-5 notes. The timing of your notes does not matter, only the sequence. Make sure to choose sequences that you will not play by accident.
6. Click the stop button.
7. Repeat for all desired actions.
8. To remove a shortcut, click the record button and then the stop button without playing any notes.

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


## Issues / Debugging

Check the messages at the bottom of the menu. Check your browser's console logs for more verbose information.

If the status is "Disconnected", try hard-refreshing the page. If that doesn't help, try closing and reopening the Piano Marvel plugin. It is important that you close the plugin using the "Exit the application" button. Using the "Restart the application" does not force the Piano Marvel app to reconnect. Closing the plugin window only minimizes or backgrounds the plugin and does not actually close it. 

This is caused by a race condition between the user script and the page's JavaScript execution time. The user script monkey patches the WebSocket class so it can intercept and capture the web socket that the Piano Marvel app creates. If this is not done before page's JavaScript executes and creates the WebSocket, the only remedy is to force the Piano Marvel app to create a new web socket. This can be done by closing the web socket via closing the plugin.