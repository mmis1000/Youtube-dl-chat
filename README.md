# Youtube DL Chat

A downloader for downloading live chats from youtube (either live or archive)

## Usage

### The full downloader

```bash
# For detail, read the build in description
./youtube-chat-dl --help
```

### Dump archive chat only

download the chat in a `one json per line` format

```bash
./fetchChatAll.js https://www.youtube.com/watch?v=XXXXXXXX > chat.jsonl
```

### Tail live chat only

Download the chat in a `one json per line` format.  
The dump contains all information required to reconstruct the chat room.

```bash
./fetchChatLive.js https://www.youtube.com/watch?v=XXXXXXXX > chat.jsonl
```

### Convert dumped chat to human readable format only

```bash
# from dump
./convertToHumanReadable.js ./chat.jsonl > chat.txt
# from archive
./fetchChatAll.js https://www.youtube.com/watch?v=XXXXXXXX | ./convertToHumanReadable.js > chat.txt
# from live
./fetchChatLive.js https://www.youtube.com/watch?v=XXXXXXXX | ./convertToHumanReadable.js > chat.txt
```
