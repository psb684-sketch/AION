import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "en" | "zh-TW" | "zh-CN" | "ko";

const STORAGE_KEY = "AION.language";

// English remains the source language. Keeping the translations here makes it
// possible to localize legacy UI without coupling every component to i18n.
const ZH_TW: Record<string, string> = {
  "Settings": "鼇?츣", "Appearance": "鸚뽬?", "Editor": "渶②섞??, "Shortcuts": "恙ユ뜼??,
  "Auto-Captions": "?ゅ땿耶쀥퉽", "Storage & Cache": "?꿨춼令븅뼋?뉐엮??, "About": "?쒏뼹",
  "Language": "沃욆?", "Interface language": "餓뗩씊窈?ㅊ沃욆?", "Choose the language used throughout AION": "?멩뱡 AION ?ⓧ퍔?㏘슴?①쉪沃욆?", "English": "English竊덅떛?뉛펹",
  "Traditional Chinese": "濚곲쳱訝?뻼", "Theme": "訝삯죱", "Font": "耶쀥엹", "Custom Theme": "?よ쮥訝삯죱",
  "Hide Editor": "?김뿈渶②섞??, "Custom Theme Editor": "?よ쮥訝삯죱渶②섞??, "Apply Custom Theme": "也쀧뵪?よ쮥訝삯죱",
  "Timeline": "?귡뼋邕?, "Snap to grid": "弱띺퐡?쇘퇉", "Clips snap to ruler ticks when dragging": "?뽪쎋?뉑??귛컢慂듿갰誤뤷댗佯?,
  "Magnetic snap": "髥곫㎩맱??, "Snap clips to playhead and other clip edges": "弱뉒뎴餘드맱?꾢댆??붂??닑?뜸퍟?뉑??딁랜",
  "Sequence Settings": "佯뤷닓鼇?츣", "Aspect ratio": "?ラ씊驪붶풃", "Canvas dimensions for export": "??눣?ラ씊?꾢갰野멩캈堊?,
  "Frame rate": "壤길졏??, "Frames per second for this project": "閭ㅵ컝旅덃캀燁믣쉽?쇗빖", "Defaults": "?먫Þ??,
  "Auto-save": "?ゅ땿?꿨춼", "Periodically save project state": "若싨쐿?꿨춼弱덃죭???,
  "Default frame rate": "?먫Þ壤길졏??, "Frame rate for new projects": "?겼컝旅덄쉪?먫Þ壤길졏??,
  "Start a new project": "?뗥쭓?겼컝旅?, "Begin with a 16:9 landscape canvas, or capture your screen and face simultaneously.": "鵝욜뵪 16:9 艅ュ릲?ュ툋?뗥쭓竊뚧닑?뚧셽?꾥＝?℡퉽?뉑뵝壤길찣??,
  "Recent Projects": "?瓦묊쉪弱덃죭", "No recent projects": "亦믤쐣?瓦묊쉪弱덃죭", "Create a new project to get started": "兩븀쳦?겼컝旅덁빳?뗥쭓鵝욜뵪",
  "New Project": "?겼쥭弱덃죭", "Create Project": "兩븀쳦弱덃죭", "Open Project": "?뗥븶弱덃죭", "Project name": "弱덃죭?띸㉠",
  "Rename Project": "?띷뼭?썲릫弱덃죭", "Delete Project": "?ら솮弱덃죭", "Rename": "?띷뼭?썲릫", "Delete": "?ら솮",
  "Cancel": "?뽪텋", "Save": "?꿨춼", "Close": "?쒒뻾", "Confirm": "閻븃첀", "More options": "?닷쩀?면쟿",
  "This action cannot be undone. All project data will be permanently deleted.": "閭ㅶ뱧鵝쒐꽒力뺝쑴?잞펽??됧컝旅덅퀒?쇿컜熬ユ갭阿끻닼?ㅳ?,
  "Import": "??뀯", "Import Files": "??뀯茹붹죭", "Media": "揶믧쳱", "Media Assets": "揶믧쳱榮졿쓲", "Text": "?뉐춻",
  "Add Text": "?겼쥭?뉐춻", "Audio": "?녘쮭", "Add Audio": "?겼쥭?녘쮭", "Transitions": "饔됧졃", "Adjust": "沃욘빐",
  "Clip Properties": "?뉑?掠ф?, "Asset Library": "榮졿쓲佯?, "Clip Adjustments": "?뉑?沃욘빐",
  "Export": "??눣", "Export Video": "??눣壤긺뎴", "Exporting...": "閭ｅ쑉??눣??, "Download": "訝뗨펹",
  "Media Library": "揶믧쳱佯?, "Add Media": "?겼쥭揶믧쳱", "No media yet": "弱싩꽒揶믧쳱", "Drop files here": "弱뉑첇旅덃떀?얍댆?숃！",
  "Track": "邕뚪걪", "No tracks": "亦믤쐣邕뚪걪", "New track": "?겼쥭邕뚪걪", "Locked": "藥꿴럷若?, "Remove Gap": "燁삯솮令븅슇",
  "Drop media here ??I to import": "弱뉐첅遙붹떀?얕눛閭?????I ??뀯", "Zoom In": "?얍ㄷ", "Zoom Out": "潁?컦",
  "Play": "??붂", "Pause": "?ュ걶", "Mute": "?쒒윹", "Volume": "?녜뇧", "Playing": "??붂訝?,
  "Loading...": "雍됧뀯訝??, "Application Error": "?됬뵪葉뗥폀??い", "Something went wrong": "?쇘뵟??い",
  "Something went wrong. The application encountered an unexpected error.": "?쇘뵟?ら젏?잏쉪??い竊뚧뇡?①쮮凉뤹꽒力뺟뭡瀛뚦윿烏뚣?,
  "Try Again": "?띹ĳ訝轝?, "Search": "?쒎컠", "No results": "亦믤쐣永먩옖", "Recommended": "兩븃?", "Active": "鵝욜뵪訝?,
  "Cached": "藥꿨엮??, "Failed": "鸚길븮", "Audio ready for use": "?녘쮭藥꿨룾鵝욜뵪", "Downloading...": "訝뗨펹訝??,
  "Cache Management": "恙ュ룚嶸←릤", "Cache Status": "恙ュ룚???, "Clear All Caches": "歷낂솮??됧엮??,
  "Screen Capture Enabled": "藥꿨븶?②옠亮뺞벜??, "Microphone Source": "墉ε뀑窯ⓧ푺繹?,
  "No microphone devices found.": "?얌툖?곈벤?뗩˘獒앯쉰??, "Recording Audio Only": "?낂똾獒썽윹鼇?,
  "Transcription Language": "饔됮똾沃욆?", "Search languages...": "?쒎컠沃욆???, "Whisper Models": "Whisper 與▼엹",
  "Local Auto-Captions": "?ф찣?ゅ땿耶쀥퉽", "Caption settings": "耶쀥퉽鼇?츣", "Delete Caption": "?ら솮耶쀥퉽",
  "Enter subtitle text...": "雍멨뀯耶쀥퉽?뉐춻??, "Start:": "?뗥쭓竊?, "Duration:": "?룟벧竊?,
  "No effects found": "?얌툖?경븞??, "Try a different search or category": "獄뗥삒屋?끀餓뽪맂弱뗦닑?녽줊",
  "No matching effects found": "?얌툖?곁쎑寧?쉪?덃옖", "Try searching for other styles": "獄뗦맂弱뗥끀餓뽪ª凉?,
  "Software Update": "邕잓쳱?닸뼭", "AION is up to date": "AION 藥꿩삸??곁뎵??, "New Version Available": "?됪뼭?덃쑍??뵪",
  "Release Notes": "?덃쑍沃ゆ삇", "Downloading update...": "閭ｅ쑉訝뗨펹?닸뼭??, "Update Check Failed": "茹€윥?닸뼭鸚길븮",
  "Back to Home": "瓦붷썮腰뽭쟻", "Undo": "孃⒴렅", "Redo": "?띶걳", "Undo (Cmd+Z)": "孃⒴렅竊뉱md+Z竊?,
  "Redo (Cmd+Shift+Z)": "?띶걳竊뉱md+Shift+Z竊?, "Swap selected clips (Ctrl+Shift+S)": "雅ㅶ룢?멨룚?꾤뎴餘듸펷Cmd/Ctrl+Shift+S竊?,
  "Delete left at playhead (Q)": "?ら솮??붂??랩?댐펷Q竊?, "Delete right at playhead (W)": "?ら솮??붂??뤂?댐펷W竊?,
  "Split all at playhead (S)": "?ⓩ뮡?얗젺?녶돯?③깿竊늆竊?, "Ripple mode (R) - Affects drag, trim, and delete operations": "?ｅ땿與▼폀竊늃竊됤?壤깁읉?뽪쎋?곦엶?よ늾?ら솮?띴퐳",
  "Delete selected clip(s)": "?ら솮?멨룚?꾤뎴餘?, "Duplicate selected clip(s) (Cmd/Ctrl+D)": "筽뉓＝?멨룚?꾤뎴餘듸펷Cmd/Ctrl+D竊?,
  "Close gaps": "?쒒뻾令븅슇", "Closed timeline gaps": "藥꿴뿙?됪셽?볢뻗令븅슇", "No clips under playhead to split": "??붂??툔亦믤쐣??늽?꿰쉪?뉑?",
  "No clips to delete left at playhead": "??붂??랩?닸쾼?됧룾?ら솮?꾤뎴餘?, "No clips to delete right at playhead": "??붂??뤂?닸쾼?됧룾?ら솮?꾤뎴餘?,
  "Zoom out timeline": "潁?컦?귡뼋邕?, "Zoom in timeline": "?얍ㄷ?귡뼋邕?, "Timeline zoom": "?귡뼋邕며리??,
  "No clips on timeline": "?귡뼋邕멧툓亦믤쐣?뉑?", "Previous frame": "訝듾?壤길졏", "Next frame": "訝뗤?壤길졏",
  "Pause playback": "?ュ걶??붂", "Play playback": "?뗥쭓??붂", "Base:": "?뷴틫竊?, "Dark": "曆김돯", "Midnight": "?덂쩂",
  "Ocean": "役룡큾", "Forest": "汝?옑", "Midnight Carbon": "?덂쩂閻녜퍚", "Ember Studio": "繞섊눥藥δ퐳若?,
  "Forest Console": "汝?옑?㎩댍??, "Slate Noir": "?녔씮容?, "Rose Cut": "?ョ뫎?뉔씊",
  "Import theme from JSON file": "孃?JSON 茹붹죭??뀯訝삯죱", "Export theme to JSON file": "弱뉏말窈뚦뙬?븀궨 JSON 茹붹죭",
  "Copy all colors from selected base theme": "筽뉓＝??멨읃佯뺜말窈뚨쉪??됭돯壤?, "Reset to default dark theme": "?띹Þ?븅젏鼇?런?꿜말窈?,
  "Search colors...": "?쒎컠?꿨쉘??, "A modern, native video editor built with Tauri, React, and FFmpeg. Designed for speed and creative freedom.": "餓?Tauri?갧eact ??FFmpeg ?볣좂쉪?얌빰?잏뵟壤긺뎴渶②섞?⑨펽?쇤¨?잌벧?뉐돲鵝쒑눎?긱?,
  "Auto-updates are only available in the desktop app.": "?ゅ땿?닸뼭?낂겑?ⓩ뼹旅뚪씊?덃뇡?①쮮凉뤵?, "Keep AION running at peak performance.": "溫?AION 岳앮똻?鵝녔븞?썬?,
  "Searching for newer releases...": "閭ｅ쑉?쒎컠?곁뎵?р?, "You are currently running the latest version.": "??뎺鵝욜뵪?꾣삸??곁뎵?с?,
  "The application will automatically restart once complete.": "若뚧닇孃뚧뇡?①쮮凉뤷컜?ゅ땿?띷뼭?잌땿??, "An unknown error occurred.": "?쇘뵟?ょ윥??い??,
  "Text Animations": "?뉐춻?뺟빂", "Entrance": "?꿨졃", "Exit": "???, "Duration": "?곭틠?귡뼋", "Easing": "渶⒴땿",
  "Linear": "渶싨?, "Ease In": "渶⒴뀯", "Ease Out": "渶⒴눣", "Ease In-Out": "渶⒴뀯渶⒴눣",
  "Animations preview during playback": "?뺟빂?껃쑉??붂?귡젏誤?, "Plain Text": "榮붹뻼耶?, "Text Effect": "?뉐춻?덃옖", "Template": "影꾣쑍",
  "Press a key...": "?됦툔?됮뜷??, "Reset All": "?③깿?띹Þ", "Keyboard Shortcuts": "?든썶恙ユ뜼??,
  "Transform": "溫듿숱", "Position": "鵝띸쉰", "Scale": "潁?붂", "Rotation": "?뗨퐠", "Opacity": "訝띺뤸삇佯?,
  "Crop": "獒곩늾", "Fit": "寧?릦", "Fill": "櫻ユ뼁", "Reset": "?띹Þ", "Audio Settings": "?녘쮭鼇?츣",
  "Fade In": "曆▼뀯", "Fade Out": "曆▼눣", "Text Style": "?뉐춻與ｅ폀", "Font Size": "耶쀥엹鸚㎩컦", "Font Weight": "耶쀩뇥",
  "Text Content": "?뉐춻?㎩?", "Text Color": "?뉐춻?꿨쉘", "Fill Color": "櫻ユ뼁?꿨쉘", "Thin (100)": "璵든눗竊?00竊?,
  "Extra Light (200)": "?밭눗竊?00竊?, "Light (300)": "榮곈쳱竊?00竊?, "Regular (400)": "與숁틬竊?00竊?,
  "Medium (500)": "訝?춬竊?00竊?, "Semi Bold (600)": "?딁쿁竊?00竊?, "Bold (700)": "暎쀩쳱竊?00竊?,
  "Extra Bold (800)": "?밭쿁竊?00竊?, "Black (900)": "擁끿쿁竊?00竊?, "Transition Settings": "饔됧졃鼇?츣",
  "Type": "窈욃엹", "Fade": "曆▼뙑", "Dissolve": "繹띈㎗", "Ease In / Out": "渶⒴뀯竊뤹랭??, "Filter Settings": "嚥얗룪鼇?츣",
  "Effect Settings": "?덃옖鼇?츣", "Timeline Filter": "?귡뼋邕멩옛??, "Body Effect": "雅븀돥?덃옖", "Video Effect": "壤긺뎴?덃옖", "Intensity": "凉룟벧",
  "Importing...": "閭ｅ쑉??뀯??, "Import Media": "??뀯揶믧쳱", "No media imported": "弱싨쑋??뀯揶믧쳱",
  "Import videos, audio, or images to get started": "??뀯壤긺뎴?곲윹鼇딀닑?뽫뎴餓ι뼀冶뗤슴??, "Remove from Timeline": "孃욄셽?볢뻗燁삯솮",
  "Add to Track": "?졾뀯邕뚪걪", "Essentials": "?뷸쑍", "Portrait": "雅뷴깗", "Landscape": "窯ⓩ솺", "Cinematic": "?삣쉽??,
  "Movies": "?삣쉽", "Vintage": "孃⒴룮", "Vibrant": "饒?콛", "Mono": "嶺됧?", "Aesthetic": "獰롦꽏", "Life": "?잍뉵",
  "Failed to load filters": "?→퀡雍됧뀯嚥얗룪", "No matching filters found": "?얌툖?곁쎑寧?쉪嚥얗룪", "Try another category or search": "獄뗥삒屋?끀餓뽩늽窈욄닑?쒎컠",
  "Failed to add filter": "?→퀡?겼쥭嚥얗룪", "No approved audio yet": "弱싩꽒藥꿩졇?녺쉪?녘쮭", "Add to Timeline": "?졾뀯?귡뼋邕?,
  "Download & Add": "訝뗨펹訝?뒥??, "No internet connection.": "亦믤쐣泳꿱러?ｇ퇉??, "No favorite templates saved.": "弱싨쑋?꿨춼??쏁칱?с?,
  "Updating templates library...": "閭ｅ쑉?닸뼭影꾣쑍佯モ?, "No matching templates found": "?얌툖?곁쎑寧?쉪影꾣쑍", "Try searching other categories": "獄뗦맂弱뗥끀餓뽩늽窈?,
  "Auto Caption Generator": "?ゅ땿耶쀥퉽?®뵟??, "Generate highly accurate captions automatically from the audio tracks in your project timeline. Powered by local speech recognition models.": "鵝욜뵪?ф찣沃욇윹渦②춼與▼엹竊뚦풛弱덃죭?귡뼋邕며쉪?녘퍕?ゅ땿?®뵟遙섉틬閻뷴벧耶쀥퉽??,
  "Filter gaps & silence": "?롦옛令븅슇?뉔씄??, "No audio or video clips found on the timeline. Drag some media onto the timeline first to transcribe them.": "?귡뼋邕멧툓?얌툖?곈윹鼇딀닑壤긺뎴?뉑??귟쳦?덂컜揶믧쳱?뽪쎋?경셽?볢뻗?띺꿱죱饔됮똾??,
  "Analyzing Audio Timeline...": "閭ｅ쑉?녷옄?녘쮭?귡뼋邕멤?, "Transcribing Speech (Whisper Offline)...": "閭ｅ쑉饔됮똾沃욆첑?놂펷Whisper ?®퇉竊됤?,
  "Aligning Word Timestamps...": "閭ｅ쑉弱띺퐡?뉐춻?귡뼋?녘쮼??, "Stitching Subtitle Track...": "閭ｅ쑉永꾢릦耶쀥퉽邕뚢?,
  "Please keep AION open. This process runs locally.": "獄뗤퓷??AION ?뗥븶竊뚧?葉뗥틣?껃쑉?ф찣?룩죱??, "Captions Generated Successfully!": "耶쀥퉽藥꿩닇?잏뵢?잞펯",
  "Geometric": "亮얌퐬", "Optical Distortion": "?됧???쎊", "Temporal": "?귡뼋", "Particle Dissolve": "暎믣춴繹띈㎗",
  "Light Based": "?됬퇉窈?, "Depth Based": "曆긷벧窈?, "Physics Simulated": "?⑴릤與→벉", "Failed to load transitions": "?→퀡雍됧뀯饔됧졃",
  "No matching transitions found": "?얌툖?곁쎑寧?쉪饔됧졃", "Select two clips or place playhead at a cut": "?멨룚?⒴뗧뎴餘듸펽?뽩컜??붂??쉰?쇔돦?ι퍧",
  "Add transition to timeline": "弱뉓퐠?닷뒥?ζ셽?볢뻗", "No stickers found": "?얌툖?계꼈??, "Add sticker to timeline": "弱뉓꼈?뽩뒥?ζ셽?볢뻗",
  "Download sticker": "訝뗨펹縕쇔쐳", "Whisper Model Required": "?誤?Whisper 與▼엹", "Generating...": "閭ｅ쑉?®뵟??,
  "Auto-Generate Captions": "?ゅ땿?®뵟耶쀥퉽", "No captions on the timeline. Click Add Manual or Import to begin.": "?귡뼋邕멧툓亦믤쐣耶쀥퉽?귟쳦?됥뚧뎸?뺞뼭罌욁띷닑?뚦뙬?γ띺뼀冶뗣?,
  "Jump Playhead to Start": "弱뉑뮡?얗젺瓮녘눛?뗥쭓鵝띸쉰", "New Caption Text": "?겼춻亮뺞뻼耶?,
  "Preview aspect ratio": "?먫┰?ラ씊驪붶풃", "Playback quality": "??붂?곮나", "Playback speed": "??붂?잌벧",
  "Add text to timeline": "弱뉑뻼耶쀥뒥?ζ셽?볢뻗", "Clear marks": "歷낂솮與숃쮼", "Close (Esc)": "?쒒뻾竊뉳sc竊?,
  "Mark In (I)": "鼇?츣?ι퍧竊뉹竊?, "Mark Out (O)": "鼇?츣?븅퍧竊늀竊?, "Play marked region": "??붂與숃쮼影꾢쐨",
  "Change Text Effect": "溫딀쎍?뉐춻?덃옖", "Detach Effect (Keep current styles)": "?녽썴?덃옖竊덁퓷?숂쎅?띷ª凉륅펹",
  "Applied Filter": "藥꿨쪞?①쉪嚥얗룪", "Remove Effect": "燁삯솮?덃옖", "Remove Filter": "燁삯솮嚥얗룪", "Video Effects": "壤긺뎴?덃옖",
  "Sticker Animation": "縕쇔쐳?뺟빂", "Preset Effects": "?먫Þ?덃옖",
  "Style Presets": "與ｅ폀?먫Þ??, "Template Gallery": "影꾣쑍佯?, "Typography": "耶쀩쳱?믣뜲", "Center on canvas": "營?릎?쇘빂躍?,
  "Flip Horizontal": "麗닷뭄玲삭퐠", "Flip Vertical": "?귞쎍玲삭퐠", "Reset rotation": "?띹Þ?뗨퐠", "Timing": "?귡뼋鼇?츣",
  "Double-click to reset volume": "?됧뀳訝뗤빳?띹Þ?녜뇧", "Delete marker": "?ら솮與숃쮼", "Link clips": "?ｇ탳?뉑?",
  "Waveform unavailable": "?→퀡窈?ㅊ力℡숱", "Waveform unavailable for this format": "閭ㅶ졏凉뤹꽒力뺡’鹽뷸끼壤?,
  "Pack track (remove gaps)": "鶯볡리邕뚪걪竊덄㎉?ㅷ㈉?숋펹", "Pack track - remove all unprotected gaps": "鶯볡리邕뚪걪 ??燁삯솮??됪쑋?쀤퓷鈺루쉪令븅슇",
  "Click to rebind": "?됦?訝뗤빳?띷뼭鼇?츣", "Reset to default": "?띹Þ?븅젏鼇??, "Delete model": "?ら솮與▼엹",
  "Close sheet": "?쒒뻾?€씮", "Click to rename project": "?됦?訝뗩뇥?겼뫝?띶컝旅?, "Save Name": "?꿨춼?띸㉠",
  "Dismiss": "?쒒뻾", "Dismiss update notification": "?쒒뻾?닸뼭?싩윥", "Download and install update": "訝뗨펹訝?츎獒앮쎍??,
  "Download animated preview": "訝뗨펹?뺞뀑?먫┰",
  "VIDEO EDITOR": "壤긺뎴渶②섞??, "Create something amazing": "?듕퐳餓ㅴ볶要싪콛?꾡퐳??, "Record Screen & Camera": "?꾥＝?℡퉽?뉑뵝壤길찣",
  "Untitled Project": "?ゅ뫝?띶컝旅?, "Today": "餓듿ㄹ", "Yesterday": "?ⓨㄹ", "API Configuration": "API 鼇?츣",
  "AION uses the AION API for text effects and templates. To enable these features": "AION 鵝욜뵪 AION API ?먧풘?뉐춻?덃옖?뉒칱?с귟떏誤곩븶?③쇾틳?잒꺗竊?,
  "Stickers": "縕쇔쐳", "Effects": "?덃옖", "Filters": "嚥얗룪", "Captions": "耶쀥퉽", "Safe Zones": "若됧뀲???,
  "Standard": "與숁틬", "Readable cadence": "???影也?, "System": "楹사뎠", "Classic dark": "泳볟끂曆김돯",
  "Deep blue tones": "曆김뿆?꿱た", "Cool cyan accents": "?룩돯?믥텭容욅떪", "Natural green hues": "?ょ꽫 green 泳좄돯?꿱た",
  "Professional broadcast-grade cold precision": "弱덃?兩ｆ뮡榮?cold ?룩た暎얏틬窯ⓩ졏", "Warm creative workspace": "繹ユ슄?꾢돲鵝쒎램鵝쒐㈉??,
  "Low eye strain terminal aesthetic": "鵝롧쑝?쏂쿋?붺쉪永귞ク艅잏풆耶?, "Maximum neutrality broadcast interface": "遙섇벧訝?㎫쉪兩ｆ뮡餓뗩씊",
  "Modern approachable aesthetic": "?얌빰訝붻┴?뚨쉪獰롥?窯ⓩ졏",
  "Restore Unsaved Session?": "誤곩쑴?잍쑋?꿨춼?꾢램鵝쒒쉸餘드뿇竊?, "An unsaved session for": "?득릍?겻빳訝뗥컝旅덃쐣?ゅ꽧耶섊쉪藥δ퐳?롦?竊?,
  "was detected.": "??, "Last saved:": "訝딀А?꿨춼竊?, "Discard": "?ⓩ즲", "Restore Session": "孃⒴렅藥δ퐳?롦?", "Restoring??: "閭ｅ쑉孃⒴렅??,
  "Save changes before closing?": "誤곩쑉?쒒뻾?띶꽧耶섋츏?닷뿇竊?, "Don't Save": "訝띶꽧耶?, "If you close without saving, your recent edits will be permanently lost.": "倻귝옖訝띶꽧耶섇갚?쒒뻾竊뚥퐷?瓦묊쉪渶②섞?㎩?弱뉑쐝麗멧퉭?뷴ㅁ??,
  "Saving project": "閭ｅ쑉?꿨춼弱덃죭", "Stopping preview": "閭ｅ쑉?쒏??먫┰", "Cleaning up resources": "閭ｅ쑉歷끿릤蘊뉑틦", "Resetting state": "閭ｅ쑉?띹Þ???,
  "Error Closing Project": "?쒒뻾弱덃죭?귞쇊?잓뙬沃?, "Some cleanup steps failed. Please check the console for details.": "?ⓨ늽歷끿릤閭ι찣鸚길븮竊뚩쳦?η쐦訝삥렒?겻빳?뽩풓屋녕눗蘊뉓쮭??,
  "Saving": "閭ｅ쑉?꿨춼", "and cleaning up...": "訝?툍?녻퀒繹먥?, "Force Close": "凉룟댍?쒒뻾",
  "A new version has been released on GitHub": "GitHub 藥꿰쇊躍껅뼭?덃쑍", "Active Videos": "鵝쒐뵪訝?쉪壤긺뎴", "Active model:": "鵝욜뵪訝?쉪與▼엹竊?,
  "Add clips to the timeline before exporting.": "獄뗥뀍弱뉒뎴餘드뒥?ζ셽?볢뻗?띶뙬?뷩?, "Add media to the timeline": "弱뉐첅遙붷뒥?ζ셽?볢뻗",
  "Add template to timeline": "弱뉒칱?у뒥?ζ셽?볢뻗", "Add text effect to timeline": "弱뉑뻼耶쀦븞?쒎뒥?ζ셽?볢뻗", "Added": "藥꿨뒥??,
  "All models run locally on your device. Your audio never leaves your computer, ensuring complete privacy and offline functionality.": "??됪Æ?뗩꺗?ⓧ퐷?꾥짔營?툓?룩죱竊뚪윹鼇듾툖?껈썴?뗩쎔??펽??▶岳앶슧燁곮늾?®퇉鵝욜뵪??,
  "An error occurred during the rendering and encoding process.": "嶸쀥쐳?뉒랬閻쇤걥葉뗤릎?쇘뵟??い??, "App Cache": "?됬뵪葉뗥폀恙ュ룚",
  "App cache, WebView, GPU, and IndexedDB": "?됬뵪葉뗥폀恙ュ룚?갮ebView?갍PU ??IndexedDB", "Apply to all captions": "也쀩곩댆??됧춻亮?,
  "Audio Library Cache": "?녘쮭佯ュ엮??, "Audio published from AION Studio will appear here after API cache refresh.": "孃?AION Studio ?쇔툋?꾦윹鼇딀쐝??API 恙ュ룚?닸뼭孃뚪’鹽뷸뼹閭ㅳ?,
  "Auto-Captions Configuration": "?ゅ땿耶쀥퉽鼇?츣", "Auto-detect works well for most content. Set a language explicitly to improve accuracy for accented speech or mixed-language content.": "?ゅ땿?득릍?⑴뵪?쇔ㄷ鸚싨빖?㎩?竊쎿삇閻뷸뙁若싪첑鼇??룓遙섇룭?녔닑曆룟릦沃욆??㎩??꾣틬閻뷴벧??,
  "Auto-saving??: "閭ｅ쑉?ゅ땿?꿨춼??, "Average Speed": "亮녑쓦?잌벧", "Background Box": "?뚧솺?밧죯", "Blur Radius": "與←퀕?듿풌",
  "Border Radius": "?볢쭜?듿풌", "Box Color": "?밧죯?꿨쉘", "Broadcast styles to all clips on this track": "弱뉑ª凉뤷쪞?ⓨ댆閭ㅸ퍕?볡쉪??됬뎴餘?,
  "Cache:": "恙ュ룚竊?, "Cached Audio Files": "藥꿨엮?뽫쉪?녘쮭茹붹죭", "Cached Text Effects": "藥꿨엮?뽫쉪?뉐춻?덃옖", "Canvas": "?ュ툋",
  "Check console (F12) for details": "獄뗦윥?뗤말?㎩룿竊뉶12竊됦빳?뽩풓屋녕눗蘊뉓쮭", "Checking FFmpeg??: "閭ｅ쑉茹€윥 FFmpeg??,
  "Clear Audio Cache": "歷낂솮?녘쮭恙ュ룚", "Clear Local Cache": "歷낂솮?ф찣恙ュ룚", "Clear cached data to free up disk space or resolve performance issues.": "歷낂솮恙ュ룚蘊뉑뼑餓ι뇣?양즯閻잏㈉?볠닑鰲ｆ군?덅꺗?뤻죱??,
  "Clearing audio cache will remove all downloaded library files. You'll need to download them again when adding to timeline.": "歷낂솮?녘쮭恙ュ룚?껆㎉?ㅶ??됧럴訝뗨펹?꾦윹鼇듿벴茹붹죭竊뚧뿥孃뚦뒥?ζ셽?볢뻗?귡??띷뼭訝뗨펹??,
  "Clearing cache may require an application restart for full effect": "歷낂솮恙ュ룚孃뚦룾?썽?誤곲뇥?겼븶?뺞뇡?①쮮凉뤸뎺?껃츑?①뵟??,
  "Click on any clip in the timeline to view and edit its properties": "?됦?訝뗦셽?볢뻗訝?쉪餓삡??뉑?餓ζあ誤뽩룋渶②섞掠ф?, "Closing Project": "閭ｅ쑉?쒒뻾弱덃죭",
  "Cloud Render Video": "?꿰ク嶸쀥쐳壤긺뎴", "Cloud Rendering Fallback": "?꿰ク嶸쀥쐳?숁뤃", "Codec": "渶①♠??, "Color": "?꿨쉘", "Color Filter": "?꿨쉘嚥얗룪",
  "Configure Whisper speech recognition for automatic caption generation.": "鼇?츣 Whisper 沃욇윹渦②춼餓θ눎?뺟뵢?잌춻亮뺛?, "Conform Mode": "?⑶뀓與▼폀",
  "Conform Offset X": "?⑶뀓 X 鵝띸㎉", "Conform Offset Y": "?⑶뀓 Y 鵝띸㎉", "Conform Scale": "?⑶뀓潁?붂", "Custom Gradient": "?よ쮥轢멨광",
  "Custom style name...": "?よ쮥與ｅ폀?띸㉠??, "Delete all downloaded files": "?ら솮??됧럴訝뗨펹茹붹죭", "Deleting...": "閭ｅ쑉?ら솮??,
  "Detailed breakdown of project loading phases. Shows which parts take the longest to load.": "屋녕눗?녷옄弱덃죭雍됧뀯?롦?竊뚪’鹽뷸??쀦셽?꾦깿?녴?,
  "Disabled": "藥꿨걶??, "Discard preview? Files remain on disk.": "誤곫뜥汝꾦젏誤썲뿇竊잍첇旅덁퍖?껂퓷?쇿쑉髥곭쥮訝듽?, "Disk Size": "髥곭쥮鸚㎩컦",
  "Download Trimmed": "訝뗨펹岳?돦?뉑?", "Download and add text effect to timeline": "訝뗨펹?뉐춻?덃옖訝?뒥?ζ셽?볢뻗", "Download and add text to timeline": "訝뗨펹?뉐춻訝?뒥?ζ셽?볢뻗",
  "Download template": "訝뗨펹影꾣쑍", "Drop media files into the media panel to get started": "弱뉐첅遙붹첇旅덃떀?얍댆揶믧쳱?€씮餓ι뼀冶뗤슴??,
  "Dropped Frames": "?됪졏??, "Dropped:": "?됪졏竊?, "Enabled": "藥꿨븶??, "English (US)": "?길뻼竊덄풆?뗰펹", "Est. File Size": "?먧섟茹붹죭鸚㎩컦",
  "Export Complete!": "??눣若뚧닇竊?, "Export Failed": "??눣鸚길븮", "Export Preset": "??눣?먫Þ??, "Export Project File": "??눣弱덃죭茹?,
  "Export Settings": "??눣鼇?츣", "Exporting Video??: "閭ｅ쑉??눣壤긺뎴??, "FFmpeg is required": "?誤?FFmpeg", "FFmpeg missing": "煐뷴컩 FFmpeg",
  "Files": "茹붹죭", "Flip": "玲삭퐠", "Font Family": "耶쀥엹楹삣닓", "Frame Rate": "壤길졏??, "Frames": "壤길졏", "Free": "?띹꼇",
  "GPU Cache": "GPU 恙ュ룚", "GPU Memory": "GPU 鼇섉넼遙?, "GPU Preview Initializing...": "閭ｅ쑉?앭쭓??GPU ?먫┰??, "GPU Textures": "GPU 榮뗧릤",
  "Gold Gradient": "?묋돯轢멨광", "Google Web Fonts": "Google 泳꿴쟻耶쀥엹", "Gradient Stops": "轢멨광影容?, "Hide camera": "?김뿈?앭쉽艅?,
  "Hide track": "?김뿈邕뚪걪", "Horizontal Align": "麗닷뭄弱띺퐡", "Important Notes:": "?띹쫨力ⓩ꼷雅뗩쟿竊?, "In:": "?ι퍧竊?, "Inactive": "?や슴??,
  "IndexedDB": "IndexedDB", "Input level:": "雍멨뀯?녜뇧竊?, "Install FFmpeg and add to PATH": "若됭짔 FFmpeg 訝?뒥??PATH",
  "Letter Spacing": "耶쀨퇌", "Level": "?녜뇧", "Line Height": "烏뚪쳵", "Loading preview...": "閭ｅ쑉雍됧뀯?먫┰??,
  "Local cache stores effects on your device for faster access.": "?ф찣恙ュ룚?껃컜?덃옖?꿨춼?②짔營?툓竊뚥빳?졾엮耶섇룚?잌벧??, "Local-First Privacy": "?ф찣?ゅ뀍?긺쭅",
  "Lock aspect ratio": "?뽩츣?ラ씊驪붶풃", "Lock track": "?뽩츣邕뚪걪", "Manage cached text effects from local storage and API.": "嶸←릤?ф찣?꿨춼令븅뼋??API ?꾣뻼耶쀦븞?쒎엮?뽧?,
  "Manage downloaded audio files from the audio library.": "嶸←릤孃욇윹鼇듿벴訝뗨펹?꾦윹鼇딀첇旅덀?, "Marker name??: "與숃쮼?띸㉠??, "Max Drift:": "?鸚㎩걦燁삼폏",
  "Memory": "鼇섉넼遙?, "Memory + IndexedDB": "鼇섉넼遙?+ IndexedDB", "Mobile Export": "烏뚦땿獒앯쉰??눣", "Model active": "與▼엹鵝욜뵪訝?,
  "Mute audio": "弱뉔윹鼇딃씄??, "Mute track": "弱뉓퍕?볣씄??, "Name": "?띸㉠", "No active model selected. Click \"Use this model\" on a downloaded model to enable auto-captions.": "弱싨쑋?멩뱡鵝욜뵪訝?쉪與▼엹?귟쳦?ⓨ럴訝뗨펹?꾣Æ?뗤툓?됥뚥슴?ⓩ?與▼엹?띴빳?잏뵪?ゅ땿耶쀥퉽??,
  "No clips in sequence": "佯뤷닓訝?쾼?됬뎴餘?, "No content to export": "亦믤쐣??뙬?븀쉪?㎩?", "No matching presets found.": "?얌툖?곁쎑寧?쉪?먫Þ?녴?,
  "No matching templates found.": "?얌툖?곁쎑寧?쉪影꾣쑍??, "No model downloaded yet ??download one above to enable auto-captions.": "弱싨쑋訝뗨펹與▼엹 ??獄뗤툔雍됦툓?밥뻣訝與▼엹餓ε븶?②눎?뺝춻亮뺛?,
  "No template active.": "??뎺亦믤쐣也쀧뵪影꾣쑍??, "Normal trim (Shift for ripple)": "訝?т엶?わ펷??Shift ?ｅ땿竊?, "Note:": "力ⓩ꼷竊?,
  "Note: Changing colors will detach from the effect preset.": "力ⓩ꼷竊싪츏?닺돯壤⒵쐝?뉑븞?쒒젏鼇?늽?㏂?, "Note: Modifying typography will detach from the effect preset.": "力ⓩ꼷竊싦엶?밧춻遙붹럲?경쐝?뉑븞?쒒젏鼇?늽?㏂?,
  "OFF": "??, "ON": "??, "Offset X": "X 鵝띸㎉", "Offset Y": "Y 鵝띸㎉", "On-Device Rendering Available": "??슴?②짔營?ク嶸쀥쐳", "Out:": "?븅퍧竊?,
  "Outer Glow / Shadow": "鸚뽩뀎?덌폀?겼쉽", "Outline / Stroke": "鸚뽪죫竊뤸룒??, "Output": "雍멨눣", "Padding": "?㎬퇌", "Pixel Format": "?뤹킔?쇔폀",
  "Playhead": "??붂??, "Prefer Application Window": "?ゅ뀍?멩뱡?됬뵪葉뗥폀誤뽫첊", "Prefer Entire Display": "?ゅ뀍?멩뱡?닷뗩’鹽뷴솳",
  "Preview Performance": "?먫┰?덅꺗", "Previewing": "?먫┰訝?, "Procedural Style Preview": "葉뗥틣凉뤸ª凉뤻젏誤?, "Program Preview": "影??젏誤?,
  "Project": "弱덃죭", "Project Closed": "弱덃죭藥꿴뿙??, "Project File Export Fallback": "弱덃죭茹붷뙬?뷴굺??, "Properties": "掠ф?, "Protect": "岳앲?",
  "Quality": "?곮나", "Rainbow Gradient": "壤⑵쇆轢멨광", "Recording Screen": "閭ｅ쑉?꾥＝?℡퉽", "Refresh Stats": "?띷뼭?당릤永김쮫蘊뉑뼑",
  "Renaming...": "閭ｅ쑉?띷뼭?썲릫??, "Render Effect": "嶸쀥쐳?덃옖", "Render Telemetry": "嶸쀥쐳?숁릍", "Rendered Frames": "藥꿰츞?뽩쉽??,
  "Reset all?": "誤곩뀲?③뇥鼇?뿇竊?, "Resolution": "鰲ｆ옄佯?, "Returning to home...": "閭ｅ쑉瓦붷썮腰뽭쟻??, "Ripple trim (Shift to disable)": "?ｅ땿岳?돦竊덃뙃 Shift ?쒐뵪竊?,
  "Ruler": "弱븃쫸", "Samples Collected": "藥꿩뵸?녷ª??, "Saved Path": "?꿨춼瓮?풌", "Scene Eval": "?닸솺屋뺜섟", "Scheduler": "?믥쮮??,
  "Screen recording": "?℡퉽?꾢쉽", "Search body effects...": "?쒎컠雅븀돥?덃옖??, "Search effects...": "?쒎컠?덃옖??, "Search shortcuts...": "?쒎컠恙ユ뜼?듈?,
  "Search templates...": "?쒎컠影꾣쑍??, "Seeks/sec": "驪뤹쭜?쒎컠轝→빖", "Select a clip to edit": "?멨룚?뉑?餓ι꿱죱渶②섞",
  "Select a template from the gallery below to apply it.": "孃욂툔?밭칱?у벴?멨룚影꾣쑍餓ε쪞?ⓦ?, "Shared File": "?긴벴茹붹죭", "Show camera": "窈?ㅊ?앭쉽艅?,
  "Show track": "窈?ㅊ邕뚪걪", "Size": "鸚㎩컦", "Solid Color": "榮붻돯", "Speed": "?잌벧", "Stale Reuse": "?롦쐿?띸뵪",
  "Standard System Picker (Let me choose)": "與숁틬楹사뎠?멩뱡?⑨펷溫볠닊?멩뱡竊?, "Style": "與ｅ폀", "Sunset Gradient": "鸚뺡쇋轢멨광",
  "System Fonts": "楹사뎠耶쀥엹", "System picker will prompt when recording starts": "?뗥쭓?꾢쉽?귝쐝窈?ㅊ楹사뎠?멩뱡??, "Text Effects Cache": "?뉐춻?덃옖恙ュ룚",
  "The app will restart when complete": "若뚧닇孃뚧뇡?①쮮凉뤷컜?띷뼭?잌땿", "Thickness": "暎쀧눗", "Time Remaining": "?⑶쨾?귡뼋", "Toolbar": "藥ε끁??,
  "Total Render Time": "潁썹츞?뽪셽??, "Total Size": "潁썲ㄷ弱?, "Total:": "潁썼쮫竊?, "Transition": "饔됧졃", "Trim In": "岳?돦?ι퍧", "Trim Out": "岳?돦?븅퍧",
  "Try another search or category": "獄뗥삒屋?끀餓뽪맂弱뗦닑?녽줊", "Type your text...": "雍멨뀯?뉐춻??, "Unlock aspect ratio": "鰲ｉ솮?뽩츣?ラ씊驪붶풃",
  "Unlock track": "鰲ｉ솮?뽩츣邕뚪걪", "Unmute": "?뽪텋?쒒윹", "Unmute audio": "?뽪텋?녘쮭?쒒윹", "Unmute track": "?뽪텋邕뚪걪?쒒윹",
  "Unprotect": "?뽪텋岳앲?", "Update cache information": "?닸뼭恙ュ룚蘊뉓쮭", "Vertical Align": "?귞쎍弱띺퐡",
  "Video export requires FFmpeg to be installed and available in your system PATH.": "??눣壤긺뎴?誤곩츎獒?FFmpeg竊뚥툝?썲풛楹사뎠 PATH 耶섇룚??,
  "WebView cache (Windows) may be locked by running processes": "WebView 恙ュ룚竊늋indows竊됧룾?썼˙?룩죱訝?쉪葉뗥틣?뽩츣",
  "Your custom text": "鵝좂쉪?よ쮥?뉐춻", "Your settings and preferences will be preserved": "鵝좂쉪鼇?츣?뉐걦也썲컜?껂퓷??,
  "Your video has been successfully generated and saved to your device.": "壤긺뎴藥꿩닇?잏뵢?잋를?꿨춼?겻퐷?꾥짔營??, "p95 Frame Time": "p95 壤길졏?귡뼋",
  "??WebGL Pipeline": "??WebGL 嶸←퇉", "??Live Testing": "???녔셽歷цĳ", "??Trimmed": "??藥꿜엶??,
};

// Simplified Chinese translations. Keys mirror the English source text so the
// same DOM-walking translation engine can swap languages without touching
// components. Generated via OpenCC `tw2sp` from ZH_TW; reviewers are encouraged
// to refine wording for mainland usage (e.g. 饔?뻑 vs 饔?퐪).
const ZH_CN: Record<string, string> = {
  "Settings": "溫양쉰", "Appearance": "鸚뽬쭆", "Editor": "煐뽬풌??, "Shortcuts": "恙ユ뜼??, "Auto-Captions": "?ゅ뒯耶쀥퉽", "Storage & Cache": "岳앭춼令븅뿴訝롧폆耶?,
  "About": "?념틢", "Language": "瑥??", "Interface language": "?ε룭?양ㅊ瑥??", "Choose the language used throughout AION": "?됪떓 AION ?ⓩ렏?ｄ슴?①쉪瑥??", "English": "English竊덅떛?뉛펹", "Traditional Chinese": "濚곦퐪訝?뻼",
  "Theme": "訝삯쥦", "Font": "耶쀤퐪", "Custom Theme": "?よ?訝삯쥦", "Hide Editor": "?먫뿈煐뽬풌??, "Custom Theme Editor": "?よ?訝삯쥦煐뽬풌??, "Apply Custom Theme": "也쀧뵪?よ?訝삯쥦",
  "Timeline": "?띌뿴饔?, "Snap to grid": "野백퐧?쇘봇", "Clips snap to ruler ticks when dragging": "?뽪쎋?뉑??뜹?慂먨갰鰲꾢댗佯?, "Magnetic snap": "髥곫㎩맱??, "Snap clips to playhead and other clip edges": "弱녺뎴餘드맱?꾢댆??붂鸚닸닑?뜸퍟?뉑?渦밭폍", "Sequence Settings": "訝꿱죱溫양쉰",
  "Aspect ratio": "?삯씊驪붶풃", "Canvas dimensions for export": "野쇔눣?삯씊?꾢갰野멩캈堊?, "Frame rate": "壤길졏??, "Frames per second for this project": "閭ㅹ」??캀燁믣쉽?쇗빊", "Defaults": "容섋???, "Auto-save": "?ゅ뒯岳앭춼",
  "Periodically save project state": "若싨쐿岳앭춼窈밭쎅?뜻?, "Default frame rate": "煐븀쐛壤길졏??, "Frame rate for new projects": "?곈」??쉪煐븀쐛壤길졏??, "Start a new project": "凉冶뗦뼭窈밭쎅", "Begin with a 16:9 landscape canvas, or capture your screen and face simultaneously.": "鵝욜뵪 16:9 與ゅ릲?삣툋凉冶뗰펽?뽩릪?뜹퐬?뜹콓亮뺜툗?꾢쉽?뷩?, "Recent Projects": "?瓦묊쉪窈밭쎅",
  "No recent projects": "亦→쐣?瓦묊쉪窈밭쎅", "Create a new project to get started": "?쎾뻠?곈」??빳凉冶뗤슴??, "New Project": "曆삣뒥窈밭쎅", "Create Project": "?쎾뻠窈밭쎅", "Open Project": "?볟?窈밭쎅", "Project name": "窈밭쎅?띸㎞",
  "Rename Project": "?띶뫝?띺」??, "Delete Project": "?좈솮窈밭쎅", "Rename": "?띶뫝??, "Delete": "?좈솮", "Cancel": "?뽪텋", "Save": "岳앭춼",
  "Close": "?녜뿭", "Confirm": "簾??", "More options": "?닷쩀?됮」", "This action cannot be undone. All project data will be permanently deleted.": "閭ㅶ뱧鵝쒏뿞力뺝쨳?잞펽??됮」??빊??컛熬ユ갭阿끻닠?ㅳ?, "Import": "野쇔뀯", "Import Files": "野쇔뀯?뉏뻑",
  "Media": "揶믢퐪", "Media Assets": "揶믢퐪榮졿쓲", "Text": "?뉑쑍", "Add Text": "曆삣뒥?뉑쑍", "Audio": "?녜쥜", "Add Audio": "曆삣뒥?녜쥜",
  "Transitions": "饔у쑛", "Adjust": "瘟껅빐", "Clip Properties": "?뉑?掠욄?, "Asset Library": "榮졿쓲佯?, "Clip Adjustments": "?뉑?瘟껅빐", "Export": "野쇔눣",
  "Export Video": "野쇔눣鰲녽쥜", "Exporting...": "閭ｅ쑉野쇔눣??, "Download": "訝뗨슬", "Media Library": "揶믢퐪佯?, "Add Media": "曆삣뒥揶믢퐪", "No media yet": "弱싨뿞揶믢퐪",
  "Drop files here": "弱녷뻼餓뜻떀?얍댆瓦숅뇤", "Track": "饔③걪", "No tracks": "亦→쐣饔③걪", "New track": "曆삣뒥饔③걪", "Locked": "藥꿴봺若?, "Remove Gap": "燁삯솮令븅슇",
  "Drop media here ??I to import": "弱녶첅鵝볠떀?얕눛閭?????I 野쇔뀯", "Zoom In": "?얍ㄷ", "Zoom Out": "煐⒴컦", "Play": "??붂", "Pause": "?귛걶", "Mute": "?숅윹",
  "Volume": "?녜뇧", "Playing": "??붂訝?, "Loading...": "?좄슬訝??, "Application Error": "佯붺뵪葉뗥틣?숃?", "Something went wrong": "?묊뵟?숃?", "Something went wrong. The application encountered an unexpected error.": "?묊뵟?ら쥋?잏쉪?숃?竊뚦틪?①쮮佯뤸뿞力뺟빵瀯?퓧烏뚣?,
  "Try Again": "?띹캊訝轝?, "Search": "?쒐뇨", "No results": "亦→쐣瀯볠옖", "Recommended": "兩븃?", "Active": "鵝욜뵪訝?, "Cached": "藥꿰폆耶?,
  "Failed": "鸚김뇰", "Audio ready for use": "?녜쥜藥꿨룾鵝욜뵪", "Downloading...": "訝뗨슬訝??, "Cache Management": "煐볟춼嶸←릤", "Cache Status": "煐볟춼?뜻?, "Clear All Caches": "歷낂솮??됬폆耶?,
  "Screen Capture Enabled": "藥꿩?域삣콓亮뺞닼??, "Microphone Source": "墉?뀑繇롦씎繹?, "No microphone devices found.": "?얌툖?곈벧?뗩즼溫얍쨭??, "Recording Audio Only": "餓끻퐬?띌윹窯?, "Transcription Language": "饔у퐬瑥??",
  "Search languages...": "?쒐뇨瑥????, "Whisper Models": "Whisper 與▼엹", "Local Auto-Captions": "?ф쑛?ゅ뒯耶쀥퉽", "Caption settings": "耶쀥퉽溫양쉰", "Delete Caption": "?좈솮耶쀥퉽", "Enter subtitle text...": "渦볟뀯耶쀥퉽?뉑쑍??,
  "Start:": "凉冶뗰폏", "Duration:": "?욕벧竊?, "No effects found": "?얌툖?경븞??, "Try a different search or category": "瑥룟컼瑥뺝끀餓뽪맂榮€닑?녺굳", "No matching effects found": "?얌툖?곁쎑寧?쉪?덃옖", "Try searching for other styles": "瑥룡맂榮℡끀餓뽪졆凉?,
  "Software Update": "饔?뻑?닸뼭", "AION is up to date": "AION 藥꿩삸??곁뎵??, "New Version Available": "?됪뼭?덃쑍??뵪", "Release Notes": "?덃쑍瑥닸삇", "Downloading update...": "閭ｅ쑉訝뗨슬?닸뼭??, "Update Check Failed": "汝?ζ쎍?겼ㅁ兀?,
  "Back to Home": "瓦붷썮腰뽭〉", "Undo": "鸚띶렅", "Redo": "?띶걳", "Undo (Cmd+Z)": "鸚띶렅竊뉱md+Z竊?, "Redo (Cmd+Shift+Z)": "?띶걳竊뉱md+Shift+Z竊?, "Swap selected clips (Ctrl+Shift+S)": "雅ㅶ뜟?됧룚?꾤뎴餘듸펷Cmd/Ctrl+Shift+S竊?,
  "Delete left at playhead (Q)": "?좈솮??붂鸚닷랩堊㏆펷Q竊?, "Delete right at playhead (W)": "?좈솮??붂鸚닷뤂堊㏆펷W竊?, "Split all at playhead (S)": "?ⓩ뮡?얍ㅄ?녶돯?③깿竊늆竊?, "Ripple mode (R) - Affects drag, trim, and delete operations": "瓦욃뒯與▼폀竊늃竊됤?壤긷뱧?뽪쎋?곦엶?や툗?좈솮?띴퐳", "Delete selected clip(s)": "?좈솮?됧룚?꾤뎴餘?, "Duplicate selected clip(s) (Cmd/Ctrl+D)": "?룩킑?됧룚?꾤뎴餘듸펷Cmd/Ctrl+D竊?,
  "Close gaps": "?녜뿭令븅슇", "Closed timeline gaps": "藥꿨뀽??뿶?닺슈令븅슇", "No clips under playhead to split": "??붂鸚답툔亦→쐣??늽?꿰쉪?뉑?", "No clips to delete left at playhead": "??붂鸚닷랩堊㎪깹?됧룾?좈솮?꾤뎴餘?, "No clips to delete right at playhead": "??붂鸚닷뤂堊㎪깹?됧룾?좈솮?꾤뎴餘?, "Zoom out timeline": "煐⒴컦?띌뿴饔?,
  "Zoom in timeline": "?얍ㄷ?띌뿴饔?, "Timeline zoom": "?띌뿴饔당섄??, "No clips on timeline": "?띌뿴饔답툓亦→쐣?뉑?", "Previous frame": "訝듾?壤길졏", "Next frame": "訝뗤?壤길졏", "Pause playback": "?귛걶??붂",
  "Play playback": "凉冶뗦뮡??, "Base:": "?뷴틫竊?, "Dark": "曆김돯", "Midnight": "?덂쩂", "Ocean": "役룡큾", "Forest": "汝?옑",
  "Midnight Carbon": "?덂쩂閻녜퍚", "Ember Studio": "鵝숂꺃藥δ퐳若?, "Forest Console": "汝?옑?㎩댍??, "Slate Noir": "?녔씮容?, "Rose Cut": "?ョ뫎?뉔씊", "Import theme from JSON file": "餓?JSON ?뉏뻑野쇔뀯訝삯쥦",
  "Export theme to JSON file": "弱녵말窯섇??뷰맏 JSON ?뉏뻑", "Copy all colors from selected base theme": "?룩킑??됧읃佯뺜말窯섊쉪??됭돯壤?, "Reset to default dark theme": "?띹?訝븀성?곫런?꿜말窯?, "Search colors...": "?쒐뇨?꿨쉘??, "A modern, native video editor built with Tauri, React, and FFmpeg. Designed for speed and creative freedom.": "餓?Tauri?갧eact 訝?FFmpeg ?볣좂쉪?겻빰?잏뵟鰲녽쥜煐뽬풌?⑨펽?쇤±?잌벧訝롥닗鵝쒑눎?긱?, "Auto-updates are only available in the desktop app.": "?ゅ뒯?닸뼭餓낂귞뵪雅롦죱?®뎵佯붺뵪葉뗥틣??,
  "Keep AION running at peak performance.": "溫?AION 岳앮똻?鵝녔㎬꺗??, "Searching for newer releases...": "閭ｅ쑉?쒐뇨?곁뎵?р?, "You are currently running the latest version.": "??뎺鵝욜뵪?꾣삸??곁뎵?с?, "The application will automatically restart once complete.": "若뚧닇?롥틪?①쮮佯뤷컛?ゅ뒯?띷뼭??뒯??, "An unknown error occurred.": "?묊뵟?ょ윥?숃???, "Text Animations": "?뉑쑍?①뵽",
  "Entrance": "瓦쎾쑛", "Exit": "???, "Duration": "?곭뺌?띌뿴", "Easing": "煐볟뒯", "Linear": "瀛욘?, "Ease In": "煐볟뀯",
  "Ease Out": "煐볟눣", "Ease In-Out": "煐볟뀯煐볟눣", "Animations preview during playback": "?①뵽鴉싧쑉??붂?띌쥋鰲?, "Plain Text": "瀛?뻼??, "Text Effect": "?뉑쑍?덃옖", "Template": "?껅쑍",
  "Press a key...": "?됦툔?됮뵰??, "Reset All": "?③깿?띹?", "Keyboard Shortcuts": "??썥恙ユ뜼??, "Transform": "?섇숱", "Position": "鵝띸쉰", "Scale": "煐⒵붂",
  "Rotation": "?뗨쉬", "Opacity": "訝띺뤸삇佯?, "Crop": "獒곩늾", "Fit": "寧?릦", "Fill": "櫻ユ빨", "Reset": "?띹?",
  "Audio Settings": "?녜쥜溫양쉰", "Fade In": "曆▼뀯", "Fade Out": "曆▼눣", "Text Style": "?뉑쑍?룟폀", "Font Size": "耶쀤퐪鸚㎩컦", "Font Weight": "耶쀩뇥",
  "Text Content": "?뉑쑍?끻?", "Text Color": "?뉑쑍?꿨쉘", "Fill Color": "櫻ユ빨?꿨쉘", "Thin (100)": "?곭퍏竊?00竊?, "Extra Light (200)": "?밭퍏竊?00竊?, "Light (300)": "瀯녵퐪竊?00竊?,
  "Regular (400)": "?뉐뇛竊?00竊?, "Medium (500)": "訝?춬竊?00竊?, "Semi Bold (600)": "?딁쿁竊?00竊?, "Bold (700)": "暎쀤퐪竊?00竊?, "Extra Bold (800)": "?밭쿁竊?00竊?, "Black (900)": "擁끿쿁竊?00竊?,
  "Transition Settings": "饔у쑛溫양쉰", "Type": "映삣엹", "Fade": "曆▼뙑", "Dissolve": "繹띈㎗", "Ease In / Out": "煐볟뀯竊뤹폆??, "Filter Settings": "譯ㅹ븳溫양쉰",
  "Effect Settings": "?덃옖溫양쉰", "Timeline Filter": "?띌뿴饔닸빱??, "Body Effect": "雅븀돥?덃옖", "Video Effect": "鰲녽쥜?덃옖", "Intensity": "凉뷴벧", "Importing...": "閭ｅ쑉野쇔뀯??,
  "Import Media": "野쇔뀯揶믢퐪", "No media imported": "弱싨쑋野쇔뀯揶믢퐪", "Import videos, audio, or images to get started": "野쇔뀯鰲녽쥜?곲윹窯묉닑?양뎴餓ε?冶뗤슴??, "Remove from Timeline": "餓롦뿶?닺슈燁삯솮", "Add to Track": "?졾뀯饔③걪", "Essentials": "?뷸쑍",
  "Portrait": "雅뷴깗", "Landscape": "繇롦솺", "Cinematic": "?드쉽??, "Movies": "?드쉽", "Vintage": "鸚띶룮", "Vibrant": "縟쒑돰",
  "Mono": "嶺됧?", "Aesthetic": "獰롦꽏", "Life": "?잍뉵", "Failed to load filters": "?졿퀡?좄슬譯ㅹ븳", "No matching filters found": "?얌툖?곁쎑寧?쉪譯ㅹ븳", "Try another category or search": "瑥룟컼瑥뺝끀餓뽩늽映삥닑?쒐뇨",
  "Failed to add filter": "?졿퀡曆삣뒥譯ㅹ븳", "No approved audio yet": "弱싨뿞藥꿩졇?녺쉪?녜쥜", "Add to Timeline": "?졾뀯?띌뿴饔?, "Download & Add": "訝뗨슬亮뜹뒥??, "No internet connection.": "亦→쐣營묊퍥瓦욄렏??, "No favorite templates saved.": "弱싨쑋岳앭춼??김똽?с?,
  "Updating templates library...": "閭ｅ쑉?닸뼭?껅쑍佯볛?, "No matching templates found": "?얌툖?곁쎑寧?쉪?껅쑍", "Try searching other categories": "瑥룡맂榮℡끀餓뽩늽映?, "Auto Caption Generator": "?ゅ뒯耶쀥퉽雅㎫뵟??, "Generate highly accurate captions automatically from the audio tracks in your project timeline. Powered by local speech recognition models.": "鵝욜뵪?ф쑛瑥?윹渦②칳與▼엹竊뚥퍗窈밭쎅?띌뿴饔당쉪?녘쉔?ゅ뒯雅㎫뵟遙섇뇛簾?벧耶쀥퉽??, "Filter gaps & silence": "瓦뉑빱令븅슇訝롩쓾??,
  "No audio or video clips found on the timeline. Drag some media onto the timeline first to transcribe them.": "?띌뿴饔답툓?얌툖?곈윹窯묉닑鰲녽쥜?뉑??귟??덂컛揶믢퐪?뽪쎋?경뿶?닺슈?띹퓵烏뚩쉬壤뺛?, "Analyzing Audio Timeline...": "閭ｅ쑉?녷옄?녜쥜?띌뿴饔닳?, "Transcribing Speech (Whisper Offline)...": "閭ｅ쑉饔у퐬瑥???놂펷Whisper ?길쑛竊됤?, "Aligning Word Timestamps...": "閭ｅ쑉野백퐧?뉑쑍?띌뿴?녘???, "Stitching Subtitle Track...": "閭ｅ쑉瀯꾢릦耶쀥퉽饔ⓥ?, "Please keep AION open. This process runs locally.": "瑥룝퓷??AION ?볟?竊뚧?瓦쏁쮮鴉싧쑉?ф쑛瓦먫죱??,
  "Captions Generated Successfully!": "耶쀥퉽藥꿩닇?잋벨?잞펯", "Geometric": "?졽퐬", "Optical Distortion": "?됧???쎊", "Temporal": "?띌뿴", "Particle Dissolve": "暎믣춴繹띈㎗", "Light Based": "?됬봇映?,
  "Depth Based": "曆긷벧映?, "Physics Simulated": "?⑴릤餓욜쐿", "Failed to load transitions": "?졿퀡?좄슬饔у쑛", "No matching transitions found": "?얌툖?곁쎑寧?쉪饔у쑛", "Select two clips or place playhead at a cut": "?됧룚訝ㅴ릉?뉑?竊뚧닑弱녷뮡?얍ㅄ營?틢?ゆ렏??, "Add transition to timeline": "弱녻쉬?뷴뒥?ζ뿶?닺슈",
  "No stickers found": "?얌툖?계눼??, "Add sticker to timeline": "弱녻눼?얍뒥?ζ뿶?닺슈", "Download sticker": "訝뗨슬兀닷쎗", "Whisper Model Required": "?誤?Whisper 與▼엹", "Generating...": "閭ｅ쑉雅㎫뵟??, "Auto-Generate Captions": "?ゅ뒯雅㎫뵟耶쀥퉽",
  "No captions on the timeline. Click Add Manual or Import to begin.": "?띌뿴饔답툓亦→쐣耶쀥퉽?귟??됥뚧뎸?ⓩ렌?졼띷닑?뚦??γ띶?冶뗣?, "Jump Playhead to Start": "弱녷뮡?얍ㅄ瓮녘눛凉冶뗤퐤營?, "New Caption Text": "?겼춻亮뺞뻼??, "Preview aspect ratio": "窯꾥쭏?삯씊驪붶풃", "Playback quality": "??붂?곮뇽", "Playback speed": "??붂?잌벧",
  "Add text to timeline": "弱녷뻼?у뒥?ζ뿶?닺슈", "Clear marks": "歷낂솮?뉓?", "Close (Esc)": "?녜뿭竊뉳sc竊?, "Mark In (I)": "溫양쉰?η궧竊뉹竊?, "Mark Out (O)": "溫양쉰?븀궧竊늀竊?, "Play marked region": "??붂?뉓??껃쎍",
  "Change Text Effect": "?섉쎍?뉑쑍?덃옖", "Detach Effect (Keep current styles)": "?녺┿?덃옖竊덁퓷?숂쎅?띷졆凉륅펹", "Applied Filter": "藥꿨쪞?①쉪譯ㅹ븳", "Remove Effect": "燁삯솮?덃옖", "Remove Filter": "燁삯솮譯ㅹ븳", "Video Effects": "鰲녽쥜?덃옖",
  "Sticker Animation": "兀닷쎗?①뵽", "Preset Effects": "煐븀쐛?덃옖", "Style Presets": "?룟폀煐븀쐛??, "Template Gallery": "?껅쑍佯?, "Typography": "耶쀤퐪?믣뜲",
  "Center on canvas": "營?릎雅롧뵽躍?, "Flip Horizontal": "麗닷뭄玲삭쉬", "Flip Vertical": "?귞쎍玲삭쉬", "Reset rotation": "?띹??뗨쉬", "Timing": "?띌뿴溫양쉰", "Double-click to reset volume": "?됦륵訝뗤빳?띹??녜뇧",
  "Delete marker": "?좈솮?뉓?", "Link clips": "?얏렏?뉑?", "Waveform unavailable": "?졿퀡?양ㅊ力℡숱", "Waveform unavailable for this format": "閭ㅶ졏凉뤸뿞力뺞샑鹽뷸끼壤?, "Pack track (remove gaps)": "?뗧섄饔③걪竊덄㎉?ㅷ㈉?숋펹", "Pack track - remove all unprotected gaps": "?뗧섄饔③걪 ??燁삯솮??됪쑋?쀤퓷?ㅷ쉪令븅슇",
  "Click to rebind": "?됦?訝뗤빳?띷뼭溫양쉰", "Reset to default": "?띹?訝븅퍡溫ㅵ?, "Delete model": "?좈솮與▼엹", "Close sheet": "?녜뿭?€씮", "Click to rename project": "?됦?訝뗩뇥?썲릫窈밭쎅", "Save Name": "岳앭춼?띸㎞",
  "Dismiss": "?녜뿭", "Dismiss update notification": "?녜뿭?닸뼭?싩윥", "Download and install update": "訝뗨슬亮뜹츎獒끾쎍??, "Download animated preview": "訝뗨슬?ⓩ곲쥋鰲?, "VIDEO EDITOR": "鰲녽쥜煐뽬풌??, "Create something amazing": "?쎽퐳餓ㅴ볶?딂돰?꾡퐳??,
  "Record Screen & Camera": "壤뺝댍掠뤷퉽訝롦몖壤길쑛", "Untitled Project": "?ゅ뫝?띺」??, "Today": "餓듿ㄹ", "Yesterday": "?ⓨㄹ", "API Configuration": "API 溫양쉰", "AION uses the AION API for text effects and templates. To enable these features": "AION 鵝욜뵪 AION API ?먧풘?뉑쑍?덃옖訝롨똽?с귟떏誤곫?域삭퓳雅쎾뒣?쏙폏",
  "Stickers": "兀닷쎗", "Effects": "?덃옖", "Filters": "譯ㅹ븳", "Captions": "耶쀥퉽", "Safe Zones": "若됧뀲?뷴윜", "Standard": "?뉐뇛",
  "Readable cadence": "????귛쪕", "System": "楹사퍨", "Classic dark": "瀯뤷끂曆김돯", "Deep blue tones": "曆김뱷?꿱컘", "Cool cyan accents": "?룩돯?믥뼁?밭?", "Natural green hues": "?ょ꽫 green 瀯욤돯?꿱컘",
  "Professional broadcast-grade cold precision": "訝볞툣亮욘뮡瀛?cold ?룩컘暎얍뇛繇롦졏", "Warm creative workspace": "歷⒵슄?꾢닗鵝쒎램鵝쒐㈉??, "Low eye strain terminal aesthetic": "鵝롧쑝?쏂킓?끿쉪瀯덄ク?븀풆耶?, "Maximum neutrality broadcast interface": "遙섇벧訝?㎫쉪亮욘뮡?ε룭", "Modern approachable aesthetic": "?겻빰訝붶볏?뚨쉪獰롥?繇롦졏", "Restore Unsaved Session?": "誤곩쨳?잍쑋岳앭춼?꾢램鵝쒒샄餘드릹竊?,
  "An unsaved session for": "堊?탩?겻빳訝뗩」??쐣?や퓷耶섊쉪藥δ퐳?뜻?竊?, "was detected.": "??, "Last saved:": "訝딀А岳앭춼竊?, "Discard": "?띶펱", "Restore Session": "鸚띶렅藥δ퐳?뜻?", "Restoring??: "閭ｅ쑉鸚띶렅??,
  "Save changes before closing?": "誤곩쑉?녜뿭?띴퓷耶섇룜?닷릹竊?, "Don't Save": "訝띴퓷耶?, "If you close without saving, your recent edits will be permanently lost.": "倻귝옖訝띴퓷耶섇갚?녜뿭竊뚥퐷?瓦묊쉪煐뽬풌?끻?弱녵폏麗멧퉭?쀥ㅁ??,
  "Saving project": "閭ｅ쑉岳앭춼窈밭쎅", "Stopping preview": "閭ｅ쑉?쒏?窯꾥쭏", "Cleaning up resources": "閭ｅ쑉歷끿릤壅꾣틦", "Resetting state": "閭ｅ쑉?띹??뜻?, "Error Closing Project": "?녜뿭窈밭쎅?뜹룕?잓뵗瑥?, "Some cleanup steps failed. Please check the console for details.": "?ⓨ늽歷끿릤閭ιい鸚김뇰竊뚩??η쐦訝삥렒?겻빳?뽩풓瑥?퍏岳→겘??,
  "Saving": "閭ｅ쑉岳앭춼", "and cleaning up...": "亮뜻툍?녻탡繹먥?, "Force Close": "凉뷴댍?녜뿭", "A new version has been released on GitHub": "GitHub 藥꿨룕躍껅뼭?덃쑍", "Active Videos": "鵝쒐뵪訝?쉪鰲녽쥜", "Active model:": "鵝욜뵪訝?쉪與▼엹竊?,
  "Add clips to the timeline before exporting.": "瑥룟뀍弱녺뎴餘드뒥?ζ뿶?닺슈?띶??뷩?, "Add media to the timeline": "弱녶첅鵝볟뒥?ζ뿶?닺슈", "Add template to timeline": "弱녻똽?у뒥?ζ뿶?닺슈", "Add text effect to timeline": "弱녷뻼?ф븞?쒎뒥?ζ뿶?닺슈", "Added": "藥꿨뒥??, "All models run locally on your device. Your audio never leaves your computer, ensuring complete privacy and offline functionality.": "??됪Æ?뗩꺗?ⓧ퐷?꾥?鸚뉏툓瓦먫죱竊뚪윹窯묇툖鴉싩┿凉?듣꼹竊뚦룾簾?퓷?먪쭅訝롨꽦?뷰슴?ⓦ?,
  "An error occurred during the rendering and encoding process.": "嶸쀥쎗訝롧폋?곮퓝葉뗤릎?묊뵟?숃???, "App Cache": "佯붺뵪葉뗥틣煐볟춼", "App cache, WebView, GPU, and IndexedDB": "佯붺뵪葉뗥틣煐볟춼?갮ebView?갍PU 訝?IndexedDB", "Apply to all captions": "也쀩곩댆??됧춻亮?, "Audio Library Cache": "?녜쥜佯볡폆耶?, "Audio published from AION Studio will appear here after API cache refresh.": "餓?AION Studio ?묈툋?꾦윹窯묇폏??API 煐볟춼?닸뼭?롦샑鹽뷰틢閭ㅳ?,
  "Auto-Captions Configuration": "?ゅ뒯耶쀥퉽溫양쉰", "Auto-detect works well for most content. Set a language explicitly to improve accuracy for accented speech or mixed-language content.": "?ゅ뒯堊?탩?귞뵪雅롥ㄷ鸚싨빊?끻?竊쎿삇簾?뙁若싪?鼇??룓遙섇룭?녔닑曆룟릦瑥???끻??꾢뇛簾?벧??, "Auto-saving??: "閭ｅ쑉?ゅ뒯岳앭춼??, "Average Speed": "亮녑쓦?잌벧", "Background Box": "?뚧솺?밧쓼", "Blur Radius": "與←퀕?듿푶",
  "Border Radius": "?녻쭜?듿푶", "Box Color": "?밧쓼?꿨쉘", "Broadcast styles to all clips on this track": "弱녷졆凉뤷쪞?ⓨ댆閭ㅸ쉔?볡쉪??됬뎴餘?, "Cache:": "煐볟춼竊?, "Cached Audio Files": "藥꿰폆耶섊쉪?녜쥜?뉏뻑", "Cached Text Effects": "藥꿰폆耶섊쉪?뉑쑍?덃옖",
  "Canvas": "?삣툋", "Check console (F12) for details": "瑥룡윥?뗤말?㎩룿竊뉶12竊됦빳?뽩풓瑥?퍏岳→겘", "Checking FFmpeg??: "閭ｅ쑉汝??FFmpeg??, "Clear Audio Cache": "歷낂솮?녜쥜煐볟춼", "Clear Local Cache": "歷낂솮?ф쑛煐볟춼", "Clear cached data to free up disk space or resolve performance issues.": "歷낂솮煐볟춼?경뜮餓ι뇢?양즯?섊㈉?닸닑鰲ｅ넶?㎬꺗??쥦??,
  "Clearing audio cache will remove all downloaded library files. You'll need to download them again when adding to timeline.": "歷낂솮?녜쥜煐볟춼鴉싩㎉?ㅶ??됧럴訝뗨슬?꾦윹窯묈틩?뉏뻑竊뚧뿥?롥뒥?ζ뿶?닺슈?띌??띷뼭訝뗨슬??, "Clearing cache may require an application restart for full effect": "歷낂솮煐볟춼?롥룾?썽?誤곲뇥?겼맦?ⓨ틪?①쮮佯뤸뎺鴉싧츑?①뵟??, "Click on any clip in the timeline to view and edit its properties": "?됦?訝뗦뿶?닺슈訝?쉪餓삡??뉑?餓ζ윥?뗥룋煐뽬풌掠욄?, "Closing Project": "閭ｅ쑉?녜뿭窈밭쎅", "Cloud Render Video": "雅묊ク嶸쀥쎗鰲녽쥜", "Cloud Rendering Fallback": "雅묊ク嶸쀥쎗鸚뉑뤃",
  "Codec": "煐뽫쟻??, "Color": "?꿨쉘", "Color Filter": "?꿨쉘譯ㅹ븳", "Configure Whisper speech recognition for automatic caption generation.": "溫양쉰 Whisper 瑥?윹渦②칳餓θ눎?ⓧ벨?잌춻亮뺛?, "Conform Mode": "?귡뀓與▼폀", "Conform Offset X": "?귡뀓 X 鵝띸㎉",
  "Conform Offset Y": "?귡뀓 Y 鵝띸㎉", "Conform Scale": "?귡뀓煐⒵붂", "Custom Gradient": "?よ?歷먨콆", "Custom style name...": "?よ??룟폀?띸㎞??, "Delete all downloaded files": "?좈솮??됧럴訝뗨슬?뉏뻑", "Deleting...": "閭ｅ쑉?좈솮??,
  "Detailed breakdown of project loading phases. Shows which parts take the longest to load.": "瑥?퍏?녷옄窈밭쎅?좄슬?뜻?竊뚧샑鹽뷸??쀦뿶?꾦깿?녴?, "Disabled": "藥꿨걶??, "Discard preview? Files remain on disk.": "誤곮닄凉껈쥋鰲덂릹竊잍뻼餓뜸퍖鴉싦퓷?쇿쑉髥곭썥訝듽?, "Disk Size": "髥곭썥鸚㎩컦", "Download Trimmed": "訝뗨슬岳?돦?뉑?", "Download and add text effect to timeline": "訝뗨슬?뉑쑍?덃옖亮뜹뒥?ζ뿶?닺슈",
  "Download and add text to timeline": "訝뗨슬?뉑쑍亮뜹뒥?ζ뿶?닺슈", "Download template": "訝뗨슬?껅쑍", "Drop media files into the media panel to get started": "弱녶첅鵝볠뻼餓뜻떀?얍댆揶믢퐪?€씮餓ε?冶뗤슴??, "Dropped Frames": "?됪졏??, "Dropped:": "?됪졏竊?, "Enabled": "藥꿩?域?,
  "English (US)": "?길뻼竊덄풆?쏙펹", "Est. File Size": "窯꾡섟?뉏뻑鸚㎩컦", "Export Complete!": "野쇔눣若뚧닇竊?, "Export Failed": "野쇔눣鸚김뇰", "Export Preset": "野쇔눣煐븀쐛??, "Export Project File": "野쇔눣窈밭쎅旅?,
  "Export Settings": "野쇔눣溫양쉰", "Exporting Video??: "閭ｅ쑉野쇔눣鰲녽쥜??, "FFmpeg is required": "?誤?FFmpeg", "FFmpeg missing": "煐뷴컩 FFmpeg", "Files": "?뉏뻑", "Flip": "玲삭쉬",
  "Font Family": "耶쀤퐪楹삣닓", "Frame Rate": "壤길졏??, "Frames": "壤길졏", "Free": "?띹뉩", "GPU Cache": "GPU 煐볟춼", "GPU Memory": "GPU ?끻춼",
  "GPU Preview Initializing...": "閭ｅ쑉?앭쭓??GPU 窯꾥쭏??, "GPU Textures": "GPU 瀛밭릤", "Gold Gradient": "?묋돯歷먨콆", "Google Web Fonts": "Google 營묌〉耶쀤퐪", "Gradient Stops": "歷먨콆?귞궧", "Hide camera": "?먫뿈?꾢쉽??,
  "Hide track": "?먫뿈饔③걪", "Horizontal Align": "麗닷뭄野백퐧", "Important Notes:": "?띹쫨力ⓩ꼷雅뗩」竊?, "In:": "?η궧竊?, "Inactive": "?や슴??, "IndexedDB": "IndexedDB",
  "Input level:": "渦볟뀯?녜뇧竊?, "Install FFmpeg and add to PATH": "若됭즳 FFmpeg 亮뜹뒥??PATH", "Letter Spacing": "耶쀨퇌", "Level": "?녜뇧", "Line Height": "烏뚪쳵", "Loading preview...": "閭ｅ쑉?좄슬窯꾥쭏??,
  "Local cache stores effects on your device for faster access.": "?ф쑛煐볟춼鴉싧컛?덃옖岳앭춼?②?鸚뉏툓竊뚥빳?졾엮溫욥뿮?잌벧??, "Local-First Privacy": "?ф쑛鴉섇뀍?먪쭅", "Lock aspect ratio": "?곩츣?삯씊驪붶풃", "Lock track": "?곩츣饔③걪", "Manage cached text effects from local storage and API.": "嶸←릤?ф쑛岳앭춼令븅뿴訝?API ?꾣뻼?ф븞?쒐폆耶섅?, "Manage downloaded audio files from the audio library.": "嶸←릤餓롩윹窯묈틩訝뗨슬?꾦윹窯묉뻼餓뜰?,
  "Marker name??: "?뉓??띸㎞??, "Max Drift:": "?鸚㎩걦燁삼폏", "Memory": "?끻춼", "Memory + IndexedDB": "?끻춼 + IndexedDB", "Mobile Export": "烏뚦뒯溫얍쨭野쇔눣", "Model active": "與▼엹鵝욜뵪訝?,
  "Mute audio": "弱녽윹窯묌쓾??, "Mute track": "弱녻쉔?볣쓾??, "Name": "?띸㎞", "No active model selected. Click \"Use this model\" on a downloaded model to enable auto-captions.": "弱싨쑋?됪떓鵝욜뵪訝?쉪與▼엹?귟??ⓨ럴訝뗨슬?꾣Æ?뗤툓?됥뚥슴?ⓩ?與▼엹?띴빳嚥域삭눎?ⓨ춻亮뺛?, "No clips in sequence": "訝꿱죱訝?깹?됬뎴餘?, "No content to export": "亦→쐣????븀쉪?끻?",
  "No matching presets found.": "?얌툖?곁쎑寧?쉪煐븀쐛?녴?, "No matching templates found.": "?얌툖?곁쎑寧?쉪?껅쑍??, "No model downloaded yet ??download one above to enable auto-captions.": "弱싨쑋訝뗨슬與▼엹 ??瑥룝툔饔썰툓?밥뻣訝與▼엹餓ζ?域삭눎?ⓨ춻亮뺛?, "No template active.": "??뎺亦→쐣也쀧뵪?껅쑍??, "Normal trim (Shift for ripple)": "訝?т엶?わ펷??Shift 瓦욃뒯竊?, "Note:": "力ⓩ꼷竊?,
  "Note: Changing colors will detach from the effect preset.": "力ⓩ꼷竊싧룜?닺돯壤⒳폏訝롦븞?쒐성?곩늽獵삠?, "Note: Modifying typography will detach from the effect preset.": "力ⓩ꼷竊싦엶?밧춻鵝볠럲?겻폏訝롦븞?쒐성?곩늽獵삠?, "OFF": "??, "ON": "凉", "Offset X": "X 鵝띸㎉", "Offset Y": "Y 鵝띸㎉",
  "On-Device Rendering Available": "??슴?②?鸚뉒ク嶸쀥쎗", "Out:": "?븀궧竊?, "Outer Glow / Shadow": "鸚뽩뀎?뺧폀?닷쉽", "Outline / Stroke": "鸚뽪죫竊뤸룒渦?, "Output": "渦볟눣", "Padding": "?낁퇌",
  "Pixel Format": "?뤹킔?쇔폀", "Playhead": "??붂鸚?, "Prefer Application Window": "鴉섇뀍?됪떓佯붺뵪葉뗥틣囹쀥룭", "Prefer Entire Display": "鴉섇뀍?됪떓?답릉?양ㅊ??, "Preview Performance": "窯꾥쭏?㎬꺗", "Previewing": "窯꾥쭏訝?,
  "Procedural Style Preview": "瓦쏁쮮凉뤸졆凉뤻쥋鰲?, "Program Preview": "?귞쎅窯꾥쭏", "Project": "窈밭쎅", "Project Closed": "窈밭쎅藥꿨뀽??, "Project File Export Fallback": "窈밭쎅旅ｅ??뷴쨭??, "Properties": "掠욄?,
  "Protect": "岳앮뒪", "Quality": "?곮뇽", "Rainbow Gradient": "壤⑵쇆歷먨콆", "Recording Screen": "閭ｅ쑉壤뺝댍掠뤷퉽", "Refresh Stats": "?룡뼭瀯잒??경뜮", "Renaming...": "閭ｅ쑉?띶뫝?띯?,
  "Render Effect": "嶸쀥쎗?덃옖", "Render Telemetry": "嶸쀥쎗?ζ탩", "Rendered Frames": "藥꿰츞?얍쉽??, "Reset all?": "誤곩뀲?③뇥溫얍릹竊?, "Resolution": "?녻쑬??, "Returning to home...": "閭ｅ쑉瓦붷썮腰뽭〉??,
  "Ripple trim (Shift to disable)": "瓦욃뒯岳?돦竊덃뙃 Shift ?쒐뵪竊?, "Ruler": "弱븃쭊", "Samples Collected": "藥꿩뵸?녷졆??, "Saved Path": "岳앭춼瓮?푶", "Scene Eval": "?뷸솺瑥꾡섟", "Scheduler": "瘟껃벧??,
  "Screen recording": "掠뤷퉽壤뺝깗", "Search body effects...": "?쒐뇨雅븀돥?덃옖??, "Search effects...": "?쒐뇨?덃옖??, "Search shortcuts...": "?쒐뇨恙ユ뜼???, "Search templates...": "?쒐뇨?껅쑍??, "Seeks/sec": "驪뤹쭜?쒐뇨轝→빊",
  "Select a clip to edit": "?됧룚?뉑?餓θ퓵烏뚨폋渦?, "Select a template from the gallery below to apply it.": "餓롣툔?배똽?у틩?됧룚?껅쑍餓ε쪞?ⓦ?, "Shared File": "?긴벴?뉏뻑", "Show camera": "?양ㅊ?꾢쉽??, "Show track": "?양ㅊ饔③걪", "Size": "鸚㎩컦",
  "Solid Color": "瀛?돯", "Speed": "?잌벧", "Stale Reuse": "瓦뉑쐿?띸뵪", "Standard System Picker (Let me choose)": "?뉐뇛楹사퍨?됪떓?⑨펷溫⒵닊?됪떓竊?, "Style": "?룟폀", "Sunset Gradient": "鸚뺡삾歷먨콆",
  "System Fonts": "楹사퍨耶쀤퐪", "System picker will prompt when recording starts": "凉冶뗥퐬?뤸뿶鴉싨샑鹽븀내瀯잓됪떓??, "Text Effects Cache": "?뉑쑍?덃옖煐볟춼", "The app will restart when complete": "若뚧닇?롥틪?①쮮佯뤷컛?띷뼭??뒯", "Thickness": "暎쀧퍏", "Time Remaining": "?⒳퐰?띌뿴",
  "Toolbar": "藥ε끁??, "Total Render Time": "?사츞?얏뿶??, "Total Size": "?삣ㄷ弱?, "Total:": "?삭?竊?, "Transition": "饔у쑛", "Trim In": "岳?돦?η궧",
  "Trim Out": "岳?돦?븀궧", "Try another search or category": "瑥룟컼瑥뺝끀餓뽪맂榮€닑?녺굳", "Type your text...": "渦볟뀯?뉑쑍??, "Unlock aspect ratio": "鰲ｉ솮?곩츣?삯씊驪붶풃", "Unlock track": "鰲ｉ솮?곩츣饔③걪", "Unmute": "?뽪텋?숅윹",
  "Unmute audio": "?뽪텋?녜쥜?숅윹", "Unmute track": "?뽪텋饔③걪?숅윹", "Unprotect": "?뽪텋岳앮뒪", "Update cache information": "?닸뼭煐볟춼岳→겘", "Vertical Align": "?귞쎍野백퐧", "Video export requires FFmpeg to be installed and available in your system PATH.": "野쇔눣鰲녽쥜?誤곩츎獒?FFmpeg竊뚥툝?썰퍗楹사퍨 PATH 溫욥뿮??,
  "WebView cache (Windows) may be locked by running processes": "WebView 煐볟춼竊늋indows竊됧룾?썼˙瓦먫죱訝?쉪瓦쏁쮮?곩츣", "Your custom text": "鵝좂쉪?よ??뉑쑍", "Your settings and preferences will be preserved": "鵝좂쉪溫양쉰訝롥걦也썲컛鴉싦퓷??, "Your video has been successfully generated and saved to your device.": "鰲녽쥜藥꿩닇?잋벨?잌뭉岳앭춼?겻퐷?꾥?鸚뉎?, "p95 Frame Time": "p95 壤길졏?띌뿴", "??WebGL Pipeline": "??WebGL 嶸←봇",
  "??Live Testing": "???녔뿶役뗨캊", "??Trimmed": "??藥꿜엶??,
};


const KO: Record<string, string> = {
  "Settings": "?ㅼ젙",
  "Appearance": "紐⑥뼇",
  "Editor": "?몄쭛湲?,
  "Shortcuts": "?⑥텞??,
  "Auto-Captions": "?먮룞 ?먮쭑",
  "Storage & Cache": "??μ냼 諛?罹먯떆",
  "About": "?뺣낫",
  "Language": "?몄뼱",
  "Interface language": "?명꽣?섏씠???몄뼱",
  "Choose the language used throughout AION": "AION ?꾩껜?먯꽌 ?ъ슜???몄뼱 ?좏깮",
  "English": "?곸뼱",
  "Traditional Chinese": "踰덉껜 以묐Ц",
  "Theme": "?뚮쭏",
  "Font": "湲瑗?,
  "Custom Theme": "?ъ슜??吏???뚮쭏",
  "Hide Editor": "?몄쭛湲??④린湲?,
  "Custom Theme Editor": "?ъ슜??吏???뚮쭏 ?몄쭛湲?,
  "Apply Custom Theme": "?뚮쭏 ?곸슜",
  "Timeline": "??꾨씪??,
  "Snap to grid": "洹몃━???ㅻ깄",
  "Clips snap to ruler ticks when dragging": "?쒕옒洹????대┰??猷곕윭 ?깆뿉 留욎땄",
  "Magnetic snap": "?먯꽍 ?ㅻ깄",
  "Snap clips to playhead and other clip edges": "Snap clips to playhead and other clip edges",
  "Sequence Settings": "?쒗???ㅼ젙",
  "Aspect ratio": "?붾㈃ 鍮꾩쑉",
  "Canvas dimensions for export": "Canvas dimensions for export",
  "Frame rate": "?꾨젅???띾룄",
  "Frames per second for this project": "Frames per second for this project",
  "Defaults": "湲곕낯媛?,
  "Auto-save": "?먮룞 ???,
  "Periodically save project state": "Periodically save project state",
  "Default frame rate": "Default frame rate",
  "Frame rate for new projects": "Frame rate for new projects",
  "Start a new project": "Start a new project",
  "Begin with a 16:9 landscape canvas, or capture your screen and face simultaneously.": "Begin with a 16:9 landscape canvas, or capture your screen and face simultaneously.",
  "Recent Projects": "理쒓렐 ?꾨줈?앺듃",
  "No recent projects": "No recent projects",
  "Create a new project to get started": "Create a new project to get started",
  "New Project": "???꾨줈?앺듃",
  "Create Project": "?꾨줈?앺듃 留뚮뱾湲?,
  "Open Project": "?꾨줈?앺듃 ?닿린",
  "Project name": "?꾨줈?앺듃 ?대쫫",
  "Rename Project": "Rename Project",
  "Delete Project": "Delete Project",
  "Rename": "?대쫫 諛붽씀湲?,
  "Delete": "??젣",
  "Cancel": "痍⑥냼",
  "Save": "???,
  "Close": "?リ린",
  "Confirm": "?뺤씤",
  "More options": "More options",
  "This action cannot be undone. All project data will be permanently deleted.": "This action cannot be undone. All project data will be permanently deleted.",
  "Import": "媛?몄삤湲?,
  "Import Files": "?뚯씪 媛?몄삤湲?,
  "Media": "誘몃뵒??,
  "Media Assets": "Media Assets",
  "Text": "?띿뒪??,
  "Add Text": "Add Text",
  "Audio": "?ㅻ뵒??,
  "Add Audio": "Add Audio",
  "Transitions": "鍮꾨뵒???꾪솚",
  "Adjust": "議곗젙",
  "Clip Properties": "?대┰ ?띿꽦",
  "Asset Library": "?먯뀑 ?쇱씠釉뚮윭由?,
  "Clip Adjustments": "Clip Adjustments",
  "Export": "?대낫?닿린",
  "Export Video": "鍮꾨뵒???대낫?닿린",
  "Exporting...": "?대낫?대뒗 以?..",
  "Download": "?ㅼ슫濡쒕뱶",
  "Media Library": "誘몃뵒???",
  "Add Media": "Add Media",
  "No media yet": "No media yet",
  "Drop files here": "?ш린???뚯씪 ?뚯뼱???볤린",
  "Track": "?몃옓",
  "No tracks": "?몃옓 ?놁쓬",
  "New track": "???몃옓",
  "Locked": "?좉툑",
  "Remove Gap": "鍮?怨듦컙 ??젣",
  "Drop media here ??I to import": "Drop media here ??I to import",
  "Zoom In": "?뺣?",
  "Zoom Out": "異뺤냼",
  "Play": "?ъ깮",
  "Pause": "?쇱떆?뺤?",
  "Mute": "?뚯냼嫄?,
  "Volume": "蹂쇰ⅷ",
  "Playing": "?ъ깮 以?,
  "Loading...": "遺덈윭?ㅻ뒗 以?..",
  "Application Error": "?좏뵆由ъ??댁뀡 ?ㅻ쪟",
  "Something went wrong": "Something went wrong",
  "Something went wrong. The application encountered an unexpected error.": "Something went wrong. The application encountered an unexpected error.",
  "Try Again": "?ㅼ떆 ?쒕룄",
  "Search": "寃??,
  "No results": "No results",
  "Recommended": "Recommended",
  "Active": "Active",
  "Cached": "Cached",
  "Failed": "Failed",
  "Audio ready for use": "Audio ready for use",
  "Downloading...": "Downloading...",
  "Cache Management": "罹먯떆 愿由?,
  "Cache Status": "Cache Status",
  "Clear All Caches": "紐⑤뱺 罹먯떆 吏?곌린",
  "Screen Capture Enabled": "Screen Capture Enabled",
  "Microphone Source": "Microphone Source",
  "No microphone devices found.": "No microphone devices found.",
  "Recording Audio Only": "Recording Audio Only",
  "Transcription Language": "Transcription Language",
  "Search languages...": "?몄뼱 寃??..",
  "Whisper Models": "Whisper Models",
  "Local Auto-Captions": "濡쒖뺄 ?먮룞 ?먮쭑",
  "Caption settings": "?먮쭑 ?ㅼ젙",
  "Delete Caption": "?먮쭑 ??젣",
  "Enter subtitle text...": "?먮쭑 ?띿뒪???낅젰...",
  "Start:": "?쒖옉:",
  "Duration:": "湲몄씠:",
  "No effects found": "No effects found",
  "Try a different search or category": "Try a different search or category",
  "No matching effects found": "?쇱튂?섎뒗 ?④낵 ?놁쓬",
  "Try searching for other styles": "Try searching for other styles",
  "Software Update": "?뚰봽?몄썾???낅뜲?댄듃",
  "AION is up to date": "AION??理쒖떊 踰꾩쟾?낅땲??,
  "New Version Available": "??踰꾩쟾 ?ъ슜 媛??,
  "Release Notes": "Release Notes",
  "Downloading update...": "?낅뜲?댄듃 ?ㅼ슫濡쒕뱶 以?..",
  "Update Check Failed": "Update Check Failed",
  "Back to Home": "Back to Home",
  "Undo": "?ㅽ뻾 痍⑥냼",
  "Redo": "?ㅼ떆 ?ㅽ뻾",
  "Undo (Cmd+Z)": "Undo (Cmd+Z)",
  "Redo (Cmd+Shift+Z)": "Redo (Cmd+Shift+Z)",
  "Swap selected clips (Ctrl+Shift+S)": "Swap selected clips (Ctrl+Shift+S)",
  "Delete left at playhead (Q)": "Delete left at playhead (Q)",
  "Delete right at playhead (W)": "Delete right at playhead (W)",
  "Split all at playhead (S)": "?뚮젅?댄뿤?쒖뿉??紐⑤몢 ?먮Ⅴ湲?(S)",
  "Ripple mode (R) - Affects drag, trim, and delete operations": "?붾Ъ寃?紐⑤뱶 (R) - ?쒕옒洹? ?ㅻ벉湲? ??젣 ?곗궛???곹뼢",
  "Delete selected clip(s)": "?좏깮???대┰ ??젣",
  "Duplicate selected clip(s) (Cmd/Ctrl+D)": "Duplicate selected clip(s) (Cmd/Ctrl+D)",
  "Close gaps": "鍮?怨듦컙 ?リ린",
  "Closed timeline gaps": "Closed timeline gaps",
  "No clips under playhead to split": "No clips under playhead to split",
  "No clips to delete left at playhead": "No clips to delete left at playhead",
  "No clips to delete right at playhead": "No clips to delete right at playhead",
  "Zoom out timeline": "Zoom out timeline",
  "Zoom in timeline": "Zoom in timeline",
  "Timeline zoom": "??꾨씪???뺣?/異뺤냼",
  "No clips on timeline": "No clips on timeline",
  "Previous frame": "?댁쟾 ?꾨젅??,
  "Next frame": "?ㅼ쓬 ?꾨젅??,
  "Pause playback": "Pause playback",
  "Play playback": "Play playback",
  "Base:": "Base:",
  "Dark": "Dark",
  "Midnight": "Midnight",
  "Ocean": "Ocean",
  "Forest": "Forest",
  "Midnight Carbon": "Midnight Carbon",
  "Ember Studio": "Ember Studio",
  "Forest Console": "Forest Console",
  "Slate Noir": "Slate Noir",
  "Rose Cut": "Rose Cut",
  "Import theme from JSON file": "Import theme from JSON file",
  "Export theme to JSON file": "Export theme to JSON file",
  "Copy all colors from selected base theme": "Copy all colors from selected base theme",
  "Reset to default dark theme": "Reset to default dark theme",
  "Search colors...": "Search colors...",
  "A modern, native video editor built with Tauri, React, and FFmpeg. Designed for speed and creative freedom.": "A modern, native video editor built with Tauri, React, and FFmpeg. Designed for speed and creative freedom.",
  "Auto-updates are only available in the desktop app.": "Auto-updates are only available in the desktop app.",
  "Keep AION running at peak performance.": "Keep AION running at peak performance.",
  "Searching for newer releases...": "Searching for newer releases...",
  "You are currently running the latest version.": "You are currently running the latest version.",
  "The application will automatically restart once complete.": "The application will automatically restart once complete.",
  "An unknown error occurred.": "An unknown error occurred.",
  "Text Animations": "Text Animations",
  "Entrance": "Entrance",
  "Exit": "Exit",
  "Duration": "Duration",
  "Easing": "Easing",
  "Linear": "Linear",
  "Ease In": "Ease In",
  "Ease Out": "Ease Out",
  "Ease In-Out": "Ease In-Out",
  "Animations preview during playback": "Animations preview during playback",
  "Plain Text": "Plain Text",
  "Text Effect": "Text Effect",
  "Template": "Template",
  "Press a key...": "Press a key...",
  "Reset All": "Reset All",
  "Keyboard Shortcuts": "Keyboard Shortcuts",
  "Transform": "Transform",
  "Position": "Position",
  "Scale": "Scale",
  "Rotation": "Rotation",
  "Opacity": "Opacity",
  "Crop": "Crop",
  "Fit": "Fit",
  "Fill": "Fill",
  "Reset": "Reset",
  "Audio Settings": "?ㅻ뵒???ㅼ젙",
  "Fade In": "?섏씠????,
  "Fade Out": "?섏씠???꾩썐",
  "Text Style": "Text Style",
  "Font Size": "Font Size",
  "Font Weight": "Font Weight",
  "Text Content": "Text Content",
  "Text Color": "Text Color",
  "Fill Color": "Fill Color",
  "Thin (100)": "Thin (100)",
  "Extra Light (200)": "Extra Light (200)",
  "Light (300)": "Light (300)",
  "Regular (400)": "Regular (400)",
  "Medium (500)": "Medium (500)",
  "Semi Bold (600)": "Semi Bold (600)",
  "Bold (700)": "Bold (700)",
  "Extra Bold (800)": "Extra Bold (800)",
  "Black (900)": "Black (900)",
  "Transition Settings": "Transition Settings",
  "Type": "Type",
  "Fade": "Fade",
  "Dissolve": "Dissolve",
  "Ease In / Out": "Ease In / Out",
  "Filter Settings": "Filter Settings",
  "Effect Settings": "Effect Settings",
  "Timeline Filter": "Timeline Filter",
  "Body Effect": "Body Effect",
  "Video Effect": "Video Effect",
  "Intensity": "Intensity",
  "Importing...": "Importing...",
  "Import Media": "Import Media",
  "No media imported": "No media imported",
  "Import videos, audio, or images to get started": "Import videos, audio, or images to get started",
  "Remove from Timeline": "Remove from Timeline",
  "Add to Track": "Add to Track",
  "Essentials": "Essentials",
  "Portrait": "Portrait",
  "Landscape": "Landscape",
  "Cinematic": "Cinematic",
  "Movies": "Movies",
  "Vintage": "Vintage",
  "Vibrant": "Vibrant",
  "Mono": "Mono",
  "Aesthetic": "Aesthetic",
  "Life": "Life",
  "Failed to load filters": "Failed to load filters",
  "No matching filters found": "No matching filters found",
  "Try another category or search": "Try another category or search",
  "Failed to add filter": "Failed to add filter",
  "No approved audio yet": "No approved audio yet",
  "Add to Timeline": "Add to Timeline",
  "Download & Add": "Download & Add",
  "No internet connection.": "No internet connection.",
  "No favorite templates saved.": "No favorite templates saved.",
  "Updating templates library...": "Updating templates library...",
  "No matching templates found": "No matching templates found",
  "Try searching other categories": "Try searching other categories",
  "Auto Caption Generator": "Auto Caption Generator",
  "Generate highly accurate captions automatically from the audio tracks in your project timeline. Powered by local speech recognition models.": "Generate highly accurate captions automatically from the audio tracks in your project timeline. Powered by local speech recognition models.",
  "Filter gaps & silence": "Filter gaps & silence",
  "No audio or video clips found on the timeline. Drag some media onto the timeline first to transcribe them.": "No audio or video clips found on the timeline. Drag some media onto the timeline first to transcribe them.",
  "Analyzing Audio Timeline...": "Analyzing Audio Timeline...",
  "Transcribing Speech (Whisper Offline)...": "Transcribing Speech (Whisper Offline)...",
  "Aligning Word Timestamps...": "Aligning Word Timestamps...",
  "Stitching Subtitle Track...": "Stitching Subtitle Track...",
  "Please keep AION open. This process runs locally.": "Please keep AION open. This process runs locally.",
  "Captions Generated Successfully!": "Captions Generated Successfully!",
  "Geometric": "Geometric",
  "Optical Distortion": "Optical Distortion",
  "Temporal": "Temporal",
  "Particle Dissolve": "Particle Dissolve",
  "Light Based": "Light Based",
  "Depth Based": "Depth Based",
  "Physics Simulated": "Physics Simulated",
  "Failed to load transitions": "Failed to load transitions",
  "No matching transitions found": "No matching transitions found",
  "Select two clips or place playhead at a cut": "Select two clips or place playhead at a cut",
  "Add transition to timeline": "Add transition to timeline",
  "No stickers found": "No stickers found",
  "Add sticker to timeline": "Add sticker to timeline",
  "Download sticker": "Download sticker",
  "Whisper Model Required": "Whisper Model Required",
  "Generating...": "Generating...",
  "Auto-Generate Captions": "Auto-Generate Captions",
  "No captions on the timeline. Click Add Manual or Import to begin.": "No captions on the timeline. Click Add Manual or Import to begin.",
  "Jump Playhead to Start": "Jump Playhead to Start",
  "New Caption Text": "New Caption Text",
  "Preview aspect ratio": "Preview aspect ratio",
  "Playback quality": "Playback quality",
  "Playback speed": "Playback speed",
  "Add text to timeline": "Add text to timeline",
  "Clear marks": "Clear marks",
  "Close (Esc)": "Close (Esc)",
  "Mark In (I)": "Mark In (I)",
  "Mark Out (O)": "Mark Out (O)",
  "Play marked region": "Play marked region",
  "Change Text Effect": "Change Text Effect",
  "Detach Effect (Keep current styles)": "Detach Effect (Keep current styles)",
  "Applied Filter": "Applied Filter",
  "Remove Effect": "Remove Effect",
  "Remove Filter": "Remove Filter",
  "Video Effects": "鍮꾨뵒???④낵",
  "Sticker Animation": "Sticker Animation",
  "Preset Effects": "Preset Effects",
  "Style Presets": "Style Presets",
  "Template Gallery": "Template Gallery",
  "Typography": "Typography",
  "Center on canvas": "Center on canvas",
  "Flip Horizontal": "Flip Horizontal",
  "Flip Vertical": "Flip Vertical",
  "Reset rotation": "Reset rotation",
  "Timing": "Timing",
  "Double-click to reset volume": "Double-click to reset volume",
  "Delete marker": "Delete marker",
  "Link clips": "Link clips",
  "Waveform unavailable": "Waveform unavailable",
  "Waveform unavailable for this format": "Waveform unavailable for this format",
  "Pack track (remove gaps)": "Pack track (remove gaps)",
  "Pack track - remove all unprotected gaps": "Pack track - remove all unprotected gaps",
  "Click to rebind": "Click to rebind",
  "Reset to default": "Reset to default",
  "Delete model": "Delete model",
  "Close sheet": "Close sheet",
  "Click to rename project": "Click to rename project",
  "Save Name": "Save Name",
  "Dismiss": "Dismiss",
  "Dismiss update notification": "Dismiss update notification",
  "Download and install update": "Download and install update",
  "Download animated preview": "Download animated preview",
  "VIDEO EDITOR": "VIDEO EDITOR",
  "Create something amazing": "Create something amazing",
  "Record Screen & Camera": "Record Screen & Camera",
  "Untitled Project": "Untitled Project",
  "Today": "Today",
  "Yesterday": "Yesterday",
  "API Configuration": "API Configuration",
  "AION uses the AION API for text effects and templates. To enable these features": "AION uses the AION API for text effects and templates. To enable these features",
  "Stickers": "Stickers",
  "Effects": "?④낵",
  "Filters": "Filters",
  "Captions": "Captions",
  "Safe Zones": "Safe Zones",
  "Standard": "Standard",
  "Readable cadence": "Readable cadence",
  "System": "System",
  "Classic dark": "Classic dark",
  "Deep blue tones": "Deep blue tones",
  "Cool cyan accents": "Cool cyan accents",
  "Natural green hues": "Natural green hues",
  "Professional broadcast-grade cold precision": "Professional broadcast-grade cold precision",
  "Warm creative workspace": "Warm creative workspace",
  "Low eye strain terminal aesthetic": "Low eye strain terminal aesthetic",
  "Maximum neutrality broadcast interface": "Maximum neutrality broadcast interface",
  "Modern approachable aesthetic": "Modern approachable aesthetic",
  "Restore Unsaved Session?": "Restore Unsaved Session?",
  "An unsaved session for": "An unsaved session for",
  "was detected.": "was detected.",
  "Last saved:": "Last saved:",
  "Discard": "Discard",
  "Restore Session": "Restore Session",
  "Restoring??: "Restoring??,
  "Save changes before closing?": "Save changes before closing?",
  "Don't Save": "Don't Save",
  "If you close without saving, your recent edits will be permanently lost.": "If you close without saving, your recent edits will be permanently lost.",
  "Saving project": "Saving project",
  "Stopping preview": "Stopping preview",
  "Cleaning up resources": "Cleaning up resources",
  "Resetting state": "Resetting state",
  "Error Closing Project": "Error Closing Project",
  "Some cleanup steps failed. Please check the console for details.": "Some cleanup steps failed. Please check the console for details.",
  "Saving": "Saving",
  "and cleaning up...": "and cleaning up...",
  "Force Close": "Force Close",
  "A new version has been released on GitHub": "A new version has been released on GitHub",
  "Active Videos": "Active Videos",
  "Active model:": "Active model:",
  "Add clips to the timeline before exporting.": "Add clips to the timeline before exporting.",
  "Add media to the timeline": "Add media to the timeline",
  "Add template to timeline": "Add template to timeline",
  "Add text effect to timeline": "Add text effect to timeline",
  "Added": "Added",
  "All models run locally on your device. Your audio never leaves your computer, ensuring complete privacy and offline functionality.": "All models run locally on your device. Your audio never leaves your computer, ensuring complete privacy and offline functionality.",
  "An error occurred during the rendering and encoding process.": "An error occurred during the rendering and encoding process.",
  "App Cache": "App Cache",
  "App cache, WebView, GPU, and IndexedDB": "App cache, WebView, GPU, and IndexedDB",
  "Apply to all captions": "Apply to all captions",
  "Audio Library Cache": "Audio Library Cache",
  "Audio published from AION Studio will appear here after API cache refresh.": "Audio published from AION Studio will appear here after API cache refresh.",
  "Auto-Captions Configuration": "Auto-Captions Configuration",
  "Auto-detect works well for most content. Set a language explicitly to improve accuracy for accented speech or mixed-language content.": "Auto-detect works well for most content. Set a language explicitly to improve accuracy for accented speech or mixed-language content.",
  "Auto-saving??: "Auto-saving??,
  "Average Speed": "Average Speed",
  "Background Box": "Background Box",
  "Blur Radius": "Blur Radius",
  "Border Radius": "Border Radius",
  "Box Color": "Box Color",
  "Broadcast styles to all clips on this track": "Broadcast styles to all clips on this track",
  "Cache:": "Cache:",
  "Cached Audio Files": "Cached Audio Files",
  "Cached Text Effects": "Cached Text Effects",
  "Canvas": "Canvas",
  "Check console (F12) for details": "Check console (F12) for details",
  "Checking FFmpeg??: "Checking FFmpeg??,
  "Clear Audio Cache": "Clear Audio Cache",
  "Clear Local Cache": "Clear Local Cache",
  "Clear cached data to free up disk space or resolve performance issues.": "Clear cached data to free up disk space or resolve performance issues.",
  "Clearing audio cache will remove all downloaded library files. You'll need to download them again when adding to timeline.": "Clearing audio cache will remove all downloaded library files. You'll need to download them again when adding to timeline.",
  "Clearing cache may require an application restart for full effect": "Clearing cache may require an application restart for full effect",
  "Click on any clip in the timeline to view and edit its properties": "Click on any clip in the timeline to view and edit its properties",
  "Closing Project": "Closing Project",
  "Cloud Render Video": "Cloud Render Video",
  "Cloud Rendering Fallback": "Cloud Rendering Fallback",
  "Codec": "Codec",
  "Color": "Color",
  "Color Filter": "Color Filter",
  "Configure Whisper speech recognition for automatic caption generation.": "Configure Whisper speech recognition for automatic caption generation.",
  "Conform Mode": "Conform Mode",
  "Conform Offset X": "Conform Offset X",
  "Conform Offset Y": "Conform Offset Y",
  "Conform Scale": "Conform Scale",
  "Custom Gradient": "Custom Gradient",
  "Custom style name...": "Custom style name...",
  "Delete all downloaded files": "Delete all downloaded files",
  "Deleting...": "Deleting...",
  "Detailed breakdown of project loading phases. Shows which parts take the longest to load.": "Detailed breakdown of project loading phases. Shows which parts take the longest to load.",
  "Disabled": "Disabled",
  "Discard preview? Files remain on disk.": "Discard preview? Files remain on disk.",
  "Disk Size": "Disk Size",
  "Download Trimmed": "Download Trimmed",
  "Download and add text effect to timeline": "Download and add text effect to timeline",
  "Download and add text to timeline": "Download and add text to timeline",
  "Download template": "Download template",
  "Drop media files into the media panel to get started": "Drop media files into the media panel to get started",
  "Dropped Frames": "Dropped Frames",
  "Dropped:": "Dropped:",
  "Enabled": "Enabled",
  "English (US)": "English (US)",
  "Est. File Size": "Est. File Size",
  "Export Complete!": "Export Complete!",
  "Export Failed": "Export Failed",
  "Export Preset": "Export Preset",
  "Export Project File": "Export Project File",
  "Export Settings": "Export Settings",
  "Exporting Video??: "Exporting Video??,
  "FFmpeg is required": "FFmpeg is required",
  "FFmpeg missing": "FFmpeg missing",
  "Files": "Files",
  "Flip": "Flip",
  "Font Family": "Font Family",
  "Frame Rate": "Frame Rate",
  "Frames": "Frames",
  "Free": "Free",
  "GPU Cache": "GPU Cache",
  "GPU Memory": "GPU Memory",
  "GPU Preview Initializing...": "GPU Preview Initializing...",
  "GPU Textures": "GPU Textures",
  "Gold Gradient": "Gold Gradient",
  "Google Web Fonts": "Google Web Fonts",
  "Gradient Stops": "Gradient Stops",
  "Hide camera": "Hide camera",
  "Hide track": "Hide track",
  "Horizontal Align": "Horizontal Align",
  "Important Notes:": "Important Notes:",
  "In:": "In:",
  "Inactive": "Inactive",
  "IndexedDB": "IndexedDB",
  "Input level:": "Input level:",
  "Install FFmpeg and add to PATH": "Install FFmpeg and add to PATH",
  "Letter Spacing": "Letter Spacing",
  "Level": "Level",
  "Line Height": "Line Height",
  "Loading preview...": "Loading preview...",
  "Local cache stores effects on your device for faster access.": "Local cache stores effects on your device for faster access.",
  "Local-First Privacy": "Local-First Privacy",
  "Lock aspect ratio": "Lock aspect ratio",
  "Lock track": "Lock track",
  "Manage cached text effects from local storage and API.": "Manage cached text effects from local storage and API.",
  "Manage downloaded audio files from the audio library.": "Manage downloaded audio files from the audio library.",
  "Marker name??: "Marker name??,
  "Max Drift:": "Max Drift:",
  "Memory": "Memory",
  "Memory + IndexedDB": "Memory + IndexedDB",
  "Mobile Export": "Mobile Export",
  "Model active": "Model active",
  "Mute audio": "Mute audio",
  "Mute track": "Mute track",
  "Name": "Name",
  " on a downloaded model to enable auto-captions.": " on a downloaded model to enable auto-captions.",
  "No clips in sequence": "No clips in sequence",
  "No content to export": "No content to export",
  "No matching presets found.": "No matching presets found.",
  "No matching templates found.": "No matching templates found.",
  "No model downloaded yet ??download one above to enable auto-captions.": "No model downloaded yet ??download one above to enable auto-captions.",
  "No template active.": "No template active.",
  "Normal trim (Shift for ripple)": "Normal trim (Shift for ripple)",
  "Note:": "Note:",
  "Note: Changing colors will detach from the effect preset.": "Note: Changing colors will detach from the effect preset.",
  "Note: Modifying typography will detach from the effect preset.": "Note: Modifying typography will detach from the effect preset.",
  "OFF": "OFF",
  "ON": "ON",
  "Offset X": "Offset X",
  "Offset Y": "Offset Y",
  "On-Device Rendering Available": "On-Device Rendering Available",
  "Out:": "Out:",
  "Outer Glow / Shadow": "Outer Glow / Shadow",
  "Outline / Stroke": "Outline / Stroke",
  "Output": "Output",
  "Padding": "Padding",
  "Pixel Format": "Pixel Format",
  "Playhead": "?뚮젅?댄뿤??,
  "Prefer Application Window": "Prefer Application Window",
  "Prefer Entire Display": "Prefer Entire Display",
  "Preview Performance": "Preview Performance",
  "Previewing": "Previewing",
  "Procedural Style Preview": "Procedural Style Preview",
  "Program Preview": "Program Preview",
  "Project": "?꾨줈?앺듃",
  "Project Closed": "Project Closed",
  "Project File Export Fallback": "Project File Export Fallback",
  "Properties": "?띿꽦",
  "Protect": "Protect",
  "Quality": "?덉쭏",
  "Rainbow Gradient": "Rainbow Gradient",
  "Recording Screen": "Recording Screen",
  "Refresh Stats": "Refresh Stats",
  "Renaming...": "Renaming...",
  "Render Effect": "Render Effect",
  "Render Telemetry": "Render Telemetry",
  "Rendered Frames": "Rendered Frames",
  "Reset all?": "Reset all?",
  "Resolution": "?댁긽??,
  "Returning to home...": "Returning to home...",
  "Ripple trim (Shift to disable)": "?붾Ъ寃??ㅻ벉湲?(Shift濡?鍮꾪솢?깊솕)",
  "Ruler": "Ruler",
  "Samples Collected": "Samples Collected",
  "Saved Path": "Saved Path",
  "Scene Eval": "Scene Eval",
  "Scheduler": "Scheduler",
  "Screen recording": "Screen recording",
  "Search body effects...": "Search body effects...",
  "Search effects...": "Search effects...",
  "Search shortcuts...": "Search shortcuts...",
  "Search templates...": "Search templates...",
  "Seeks/sec": "Seeks/sec",
  "Select a clip to edit": "Select a clip to edit",
  "Select a template from the gallery below to apply it.": "Select a template from the gallery below to apply it.",
  "Shared File": "Shared File",
  "Show camera": "Show camera",
  "Show track": "Show track",
  "Size": "?ш린",
  "Solid Color": "Solid Color",
  "Speed": "?띾룄",
  "Stale Reuse": "Stale Reuse",
  "Standard System Picker (Let me choose)": "Standard System Picker (Let me choose)",
  "Style": "Style",
  "Sunset Gradient": "Sunset Gradient",
  "System Fonts": "System Fonts",
  "System picker will prompt when recording starts": "System picker will prompt when recording starts",
  "Text Effects Cache": "Text Effects Cache",
  "The app will restart when complete": "The app will restart when complete",
  "Thickness": "Thickness",
  "Time Remaining": "Time Remaining",
  "Toolbar": "Toolbar",
  "Total Render Time": "Total Render Time",
  "Total Size": "Total Size",
  "Total:": "Total:",
  "Transition": "Transition",
  "Trim In": "?쒖옉???ㅻ벉湲?,
  "Trim Out": "?앹젏 ?ㅻ벉湲?,
  "Try another search or category": "Try another search or category",
  "Type your text...": "Type your text...",
  "Unlock aspect ratio": "Unlock aspect ratio",
  "Unlock track": "?몃옓 ?좉툑 ?댁젣",
  "Unmute": "?뚯냼嫄??댁젣",
  "Unmute audio": "Unmute audio",
  "Unmute track": "Unmute track",
  "Unprotect": "Unprotect",
  "Update cache information": "Update cache information",
  "Vertical Align": "Vertical Align",
  "Video export requires FFmpeg to be installed and available in your system PATH.": "Video export requires FFmpeg to be installed and available in your system PATH.",
  "WebView cache (Windows) may be locked by running processes": "WebView cache (Windows) may be locked by running processes",
  "Your custom text": "Your custom text",
  "Your settings and preferences will be preserved": "Your settings and preferences will be preserved",
  "Your video has been successfully generated and saved to your device.": "Your video has been successfully generated and saved to your device.",
  "p95 Frame Time": "p95 Frame Time",
  "??WebGL Pipeline": "??WebGL Pipeline",
  "??Live Testing": "??Live Testing",
  "??Trimmed": "??Trimmed"
};
const EN_FROM_KO: Record<string, string> = Object.fromEntries(Object.entries(KO).map(([k, v]) => [v, k]));

const EN_FROM_ZH_TW: Record<string, string> = Object.fromEntries(
  Object.entries(ZH_TW).map(([en, zh]) => [zh, en])
);

const EN_FROM_ZH_CN: Record<string, string> = Object.fromEntries(
  Object.entries(ZH_CN).map(([en, zh]) => [zh, en])
);

const ATTRIBUTES = ["title", "placeholder", "aria-label"] as const;
const originalText = new WeakMap<Text, string>();
const originalAttrs = new WeakMap<Element, Map<string, string>>();

function translateText(value: string, language: AppLanguage): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (language === "en") {
    const fromTw = EN_FROM_ZH_TW[trimmed];
    if (fromTw) return value.replace(trimmed, fromTw);
    const fromCn = EN_FROM_ZH_CN[trimmed];
    if (fromCn) return value.replace(trimmed, fromCn);
    const fromKo = EN_FROM_KO[trimmed];
    if (fromKo) return value.replace(trimmed, fromKo);
    return value
      .replace(/?ゅ뫝?띶컝旅??ゅ뫝?띺」??g, "Untitled Project")
      .replace(/餓듿ㄹ/g, "Today")
      .replace(/?ⓨㄹ/g, "Yesterday")
      .replace(/與숁틬|?뉐뇛/g, "Standard")
      .replace(/???影也?????귛쪕/g, "Readable cadence")
      .replace(/??g, "times")
      .replace(/與ｆ쑍|?룡쑍/g, "samples");
  }

  if (language === "ko") {
    const translated = KO[trimmed];
    if (translated) return value.replace(trimmed, translated);
    return value
      .replace(/\bUntitled Project\b/g, "?쒕ぉ ?녿뒗 ?꾨줈?앺듃")
      .replace(/\bToday\b/g, "?ㅻ뒛")
      .replace(/\bYesterday\b/g, "?댁젣")
      .replace(/\bStandard\b/g, "?쒖?");
  }

  if (language === "zh-CN") {
    const translated = ZH_CN[trimmed];
    if (translated) return value.replace(trimmed, translated);
    return value
      .replace(/\bUntitled Project\b/g, "?ゅ뫝?띺」??)
      .replace(/\bToday\b/g, "餓듿ㄹ")
      .replace(/\bYesterday\b/g, "?ⓨㄹ")
      .replace(/\bStandard\b/g, "?뉐뇛")
      .replace(/\bReadable cadence\b/g, "????귛쪕")
      .replace(/\btimes\b/g, "??)
      .replace(/\bsamples\b/g, "?룡쑍");
  }

  // zh-TW
  const translated = ZH_TW[trimmed];
  if (translated) return value.replace(trimmed, translated);
  return value
    .replace(/\bUntitled Project\b/g, "?ゅ뫝?띶컝旅?)
    .replace(/\bToday\b/g, "餓듿ㄹ")
    .replace(/\bYesterday\b/g, "?ⓨㄹ")
    .replace(/\bStandard\b/g, "與숁틬")
    .replace(/\bReadable cadence\b/g, "???影也?)
    .replace(/\btimes\b/g, "??)
    .replace(/\bsamples\b/g, "與ｆ쑍");
}

function localizeTree(root: Node, language: AppLanguage) {
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (!text.data.trim()) return;
      const previous = originalText.get(text);
      if (previous === undefined) {
        const trimmed = text.data.trim();
        const origEnTw = EN_FROM_ZH_TW[trimmed];
        const origEnCn = origEnTw ? undefined : EN_FROM_ZH_CN[trimmed];
        const origEn = origEnTw ?? origEnCn;
        const initialText = origEn ? text.data.replace(trimmed, origEn) : text.data;
        originalText.set(text, initialText);
      } else {
        const zhTwVersion = translateText(previous, "zh-TW");
        const zhCnVersion = translateText(previous, "zh-CN");
        const enVersion = translateText(previous, "en");
        if (text.data !== previous && text.data !== zhTwVersion && text.data !== zhCnVersion && text.data !== enVersion) {
          originalText.set(text, text.data);
        }
      }

      const source = originalText.get(text)!;
      const next = translateText(source, language);
      if (text.data !== next) {
        text.data = next;
      }
      return;
    }

    if (!(node instanceof Element) || ["SCRIPT", "STYLE", "TEXTAREA"].includes(node.tagName) || node.closest("[data-no-i18n], [contenteditable='true']")) return;

    let saved = originalAttrs.get(node);
    if (!saved) {
      saved = new Map();
      originalAttrs.set(node, saved);
    }

    for (const attr of ATTRIBUTES) {
      const value = node.getAttribute(attr);
      if (value === null) continue;
      const previous = saved.get(attr);
      if (previous === undefined) {
        const trimmed = value.trim();
        const origEnTw = EN_FROM_ZH_TW[trimmed];
        const origEnCn = origEnTw ? undefined : EN_FROM_ZH_CN[trimmed];
        const origEn = origEnTw ?? origEnCn;
        const initialValue = origEn ? value.replace(trimmed, origEn) : value;
        saved.set(attr, initialValue);
      } else {
        const zhTwVersion = translateText(previous, "zh-TW");
        const zhCnVersion = translateText(previous, "zh-CN");
        const enVersion = translateText(previous, "en");
        if (value !== previous && value !== zhTwVersion && value !== zhCnVersion && value !== enVersion) {
          saved.set(attr, value);
        }
      }
      const source = saved.get(attr)!;
      const next = translateText(source, language);
      if (value !== next) {
        node.setAttribute(attr, next);
      }
    }

    node.childNodes.forEach(visit);
  };

  visit(root);
}

type I18nValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void };
const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): AppLanguage {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "zh-TW" || saved === "zh-CN") return saved;
  const nav = navigator.language.toLowerCase();
  if (nav === "zh-cn" || nav.startsWith("zh-cn-")) return "zh-CN";
  if (nav.startsWith("zh")) return "zh-TW";
  if (nav.startsWith("ko")) return "ko";
  return "ko"; // default to ko for AION Korean Patch
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<AppLanguage>(initialLanguage);
  const setLanguage = useCallback((next: AppLanguage) => {
    localStorage.setItem(STORAGE_KEY, next);
    updateLanguage(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("set_menu_language", { language }))
      .catch(() => undefined);
    localizeTree(document.body, language);
    let isApplying = false;
    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      isApplying = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") localizeTree(mutation.target, language);
          mutation.addedNodes.forEach((node) => localizeTree(node, language));
        }
      } finally {
        queueMicrotask(() => {
          isApplying = false;
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

