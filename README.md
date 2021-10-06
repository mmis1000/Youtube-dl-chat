# Youtube DL Chat

A downloader for downloading live chats from youtube (either live or archive)

## Requirements

- Node.js 15+
- Network (Obviously)

## Usage

To get the scripts.

1. Go to the release page
2. Download the script you want
3. (Optionally) Review the content
4. `chmod 755 <file name>`

### The full downloader

```bash
# For latest detail, read the buildin description instead
./youtube-chat-dl --help
```

```txt
Usage: youtube-chat-dl [options] <url>

The command for download chat
Usage: youtubeChatDl.js [options] <url>

This is program is used to dump chat from youtube chatroom.
The full output is saved in a directory with the following structure:

  /[output]/chat.jsonl
  /[output]/chat.text
  /[output]/assets/[images] (optional)

The chat is saved in jsonl format. (One JSON object per line)
With a plain text file chat.txt for readability.

The information in chat.jsonl with assets downloaded should be enough
  to reconstruct the chat visual identically offline.

Commands:
  youtubeChatDl.js <url>            The command for download chat      [default]
  youtubeChatDl.js video <dirname>  The command for Generate video from recorded
                                    chat

Positionals:
  url  The YouTube stream/archive URL/ID                                [string]

Options:
      --help              Show help                                    [boolean]
      --version           Show version number                          [boolean]
  -o, --output            Override the default output directory pattern
                             [string] [default: "[[DATE]][[STREAM_ID]] [TITLE]"]
  -l, --language          Abbreviation of the Accept-Language header
                       [string] [default: "zh-TW,zh;q=0.8,en-US;q=0.5,en;q=0.3"]
  -a, --with-assets       Download image assets (avatar and emojis)
                                                      [boolean] [default: false]
  -h, --header            Extra headers                    [array] [default: []]
  -r, --retry             Retry count on network error (5xx, not
                          available...etc)                 [number] [default: 3]
  -j, --cookie-jar        Cookie jar path for authorization
                                                        [string] [default: null]
  -w, --write-cookie-jar  Write back to Cookie jar    [boolean] [default: false]
      --dry               Dry run, show parsed arguments only
                                                      [boolean] [default: false]
```

### Dump archive chat only

download the chat in a `one json per line` format

```bash
./fetchChatAll https://www.youtube.com/watch?v=XXXXXXXX > chat.jsonl
```

### Tail live chat only

Download the chat in a `one json per line` format.  
The dump contains all information required to reconstruct the chat room.

```bash
./fetchChatLive https://www.youtube.com/watch?v=XXXXXXXX > chat.jsonl
```

### Convert dumped chat to human readable format only

```bash
# from dump
./convertToHumanReadable.js ./chat.jsonl > chat.txt
# from archive
./fetchChatAll https://www.youtube.com/watch?v=XXXXXXXX | ./convertToHumanReadable.js > chat.txt
# from live
./fetchChatLive https://www.youtube.com/watch?v=XXXXXXXX | ./convertToHumanReadable.js > chat.txt
```

## Todo

- handle network error more gracefully (add auto retry?)
- generate html chat page
