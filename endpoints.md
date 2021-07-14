# Endpoints

## HTML(initial chat)

https://www.youtube.com/live_chat?continuation=

## JSON(following chat)

### Request

```js
fetch("https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", {
  "headers": {
    "accept": "*/*",
    "accept-language": "zh-TW,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-CN;q=0.5,ja;q=0.4",
    "authorization": "SAPISIDHASH 1626192331_bc1bf434b6c2dbaa2a85aad2f9df8c3319a446d0",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Microsoft Edge\";v=\"91\", \"Chromium\";v=\"91\"",
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "same-origin",
    "sec-fetch-site": "same-origin",
    "x-goog-authuser": "0",
    "x-goog-visitor-id": "Cgtfdzh0Q213YlFlQSix2baHBg%3D%3D",
    "x-origin": "https://www.youtube.com",
    "x-youtube-client-name": "1",
    "x-youtube-client-version": "2.20210711.07.00",
    "cookie": ""
  },
  "referrer": "https://www.youtube.com/live_chat?continuation=0ofMyANxGlhDaWtxSndvWVZVTndOams1TTNkNGNIbEVVRWhWY0dGMmQwUkdjV2RuRWdzeVUyTlphbG80WVRWck5Cb1Q2cWpkdVFFTkNnc3lVMk5aYWxvNFlUVnJOQ0FCMAGCAQIIBIgBAaABgJ6Hgqrg8QKyAQA%253D",
  "referrerPolicy": "strict-origin-when-cross-origin",
  "body": JSON.stringify({
    "context": {
      "client": {
        "hl": "zh-TW",
        "gl": "TW",
        "remoteHost": "220.142.208.68",
        "deviceMake": "",
        "deviceModel": "",
        "visitorData": "Cgtfdzh0Q213YlFlQSix2baHBg%3D%3D",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.67,gzip(gfe)",
        "clientName": "WEB",
        "clientVersion": "2.20210711.07.00",
        "osName": "Windows",
        "osVersion": "10.0",
        "originalUrl": "https://www.youtube.com/live_chat?continuation=0ofMyANxGlhDa…c3lVMk5aYWxvNFlUVnJOQ0FCMAGCAQIIBIgBAaABgJ6Hgqrg8QKyAQA%253D",
        "screenPixelDensity": 2,
        "platform": "DESKTOP",
        "clientFormFactor": "UNKNOWN_FORM_FACTOR",
        "screenDensityFloat": 2,
        "userInterfaceTheme": "USER_INTERFACE_THEME_DARK",
        "timeZone": "Asia/Taipei",
        "browserName": "Edge Chromium",
        "browserVersion": "91.0.864.67",
        "screenWidthPoints": 894,
        "screenHeightPoints": 562,
        "utcOffsetMinutes": 480,
        "connectionType": "CONN_CELLULAR_4G",
        "mainAppWebInfo": {
          "graftUrl": "https://www.youtube.com/live_chat?continuation=0ofMyANxGlhDa…c3lVMk5aYWxvNFlUVnJOQ0FCMAGCAQIIBIgBAaABgJ6Hgqrg8QKyAQA%253D",
          "webDisplayMode": "WEB_DISPLAY_MODE_BROWSER",
          "isWebNativeShareAvailable": true
        }
      },
      "user": {
        "lockedSafetyMode": false
      },
      "request": {
        "useSsl": true,
        "internalExperimentFlags": [],
        "consistencyTokenJars": []
      },
      "adSignalsInfo": {
        "params": [
          {
            "key": "dt",
            "value": "1626188978659"
          }
        ]
      }
    },
    "continuation": "0ofMyAOvARpYQ2lrcUp3b1lWVU53TmprNU0zZDRjSGxFVUVoVmNHRjJkMFJHY1dkbkVnc3lVMk5aYWxvNFlUVnJOQm9UNnFqZHVRRU5DZ3N5VTJOWmFsbzRZVFZyTkNBQii255K-tuDxAjAAQAFKGggBGAAgAEoCCAFQ4e_Igqrg8QJYA3gAogEAUIS-ub624PECWIK0s4mK4PECggECCASIAQCaAQIIAKABmqX6vrbg8QKyAQA%3D",
    "webClientInfo": {
      "isDocumentHidden": false
    }
  }),
  "method": "POST",
  "mode": "cors"
});
```

### Response

```json
{
  "responseContext": {
    "serviceTrackingParams": [
      {
        "service": "CSI",
        "params": [
          {
            "key": "c",
            "value": "WEB"
          },
          {
            "key": "cver",
            "value": "2.20210711.07.00"
          },
          {
            "key": "yt_li",
            "value": "1"
          },
          {
            "key": "GetLiveChat_rid",
            "value": "0xe2d618edd1e62dad"
          }
        ]
      },
      {
        "service": "GFEEDBACK",
        "params": [
          {
            "key": "logged_in",
            "value": "1"
          },
          {
            "key": "e",
            "value": "23744176,24069545,24052378,24044124,24045411,24049567,23890959,23918597,24022728,23809316,24049569,23996830,24059521,24062574,24049820,24060197,24002022,23858057,23973490,24038425,24056264,1714257,24052245,24023960,24004644,23886225,24056431,23968386,23986034,24001373,24014916,9405982,23998056,23974595,23882685,24058380,24058812,23944779,24053866,24007246,24037794,23946420,24049573,23891346,24012512,24028142,24043960,24058240,23966208,23884386,24066055,24030040,23857949,24049575,23804281,23891344,24068851,24049577,24058128,24056704,24059817,24054130,24002025,23963163,24036947,23983296,24034805,23934970,24042870"
          }
        ]
      },
      {
        "service": "GUIDED_HELP",
        "params": [
          {
            "key": "logged_in",
            "value": "1"
          }
        ]
      },
      {
        "service": "ECATCHER",
        "params": [
          {
            "key": "client.version",
            "value": "2.20210711"
          },
          {
            "key": "client.name",
            "value": "WEB"
          }
        ]
      }
    ],
    "mainAppWebResponseContext": {
      "datasyncId": "110721188241226762981||",
      "loggedOut": false
    },
    "webResponseContextExtensionData": {
      "hasDecorated": true
    }
  },
  "continuationContents": {
    "liveChatContinuation": {
      "continuations": [
        {
          "invalidationContinuationData": {
            "invalidationId": {
              "objectSource": 1056,
              "objectId": "Y2hhdH5lVzdRMDItdjhTY341NDIwNjQz",
              "topic": "chat~eW7Q02-v8Sc~5420643",
              "subscribeToGcmTopics": true,
              "protoCreationTimestampMs": "1626192790039"
            },
            "timeoutMs": 10000,
            "continuation": "0ofMyAOrARpYQ2lrcUp3b1lWVU5uZEhSSk9GRm1aRmRvZG1RelUxSjBRMWxqU25wM0VndGxWemRSTURJdGRqaFRZeG9UNnFqZHVRRU5DZ3RsVnpkUk1ESXRkamhUWXlBQijX5aGcuODxAjAAQAJKFggBGAAgAFDP9-yRuODxAlgDeACiAQBQn5jJnLjg8QJYutyenIjg8QKCAQIIBIgBAJoBAggAoAG81dicuODxArIBAA%3D%3D"
          }
        }
      ],
      "actions": [
        {
          "addChatItemAction": {
            "item": {
              "liveChatTextMessageRenderer": {
                "message": {
                  "runs": [
                    {
                      "emoji": {
                        "emojiId": "UCgttI8QfdWhvd3SRtCYcJzw/tvB-YPLxEMi28wS0laXgCg",
                        "shortcuts": [
                          ":_わらわら:",
                          ":わらわら:"
                        ],
                        "searchTerms": [
                          "_わらわら",
                          "わらわら"
                        ],
                        "image": {
                          "thumbnails": [
                            {
                              "url": "https://yt3.ggpht.com/V9oUbrgsQ2RaOndxFXsREQEaW6x4RFgGhpM2FxoXw2ofMA2Tg5ZnLoaYoW5VyUikRkuVeDEi=w24-h24-c-k-nd",
                              "width": 24,
                              "height": 24
                            },
                            {
                              "url": "https://yt3.ggpht.com/V9oUbrgsQ2RaOndxFXsREQEaW6x4RFgGhpM2FxoXw2ofMA2Tg5ZnLoaYoW5VyUikRkuVeDEi=w48-h48-c-k-nd",
                              "width": 48,
                              "height": 48
                            }
                          ],
                          "accessibility": {
                            "accessibilityData": {
                              "label": "わらわら"
                            }
                          }
                        },
                        "isCustomEmoji": true
                      }
                    },
                    {
                      "emoji": {
                        "emojiId": "UCgttI8QfdWhvd3SRtCYcJzw/tvB-YPLxEMi28wS0laXgCg",
                        "shortcuts": [
                          ":_わらわら:",
                          ":わらわら:"
                        ],
                        "searchTerms": [
                          "_わらわら",
                          "わらわら"
                        ],
                        "image": {
                          "thumbnails": [
                            {
                              "url": "https://yt3.ggpht.com/V9oUbrgsQ2RaOndxFXsREQEaW6x4RFgGhpM2FxoXw2ofMA2Tg5ZnLoaYoW5VyUikRkuVeDEi=w24-h24-c-k-nd",
                              "width": 24,
                              "height": 24
                            },
                            {
                              "url": "https://yt3.ggpht.com/V9oUbrgsQ2RaOndxFXsREQEaW6x4RFgGhpM2FxoXw2ofMA2Tg5ZnLoaYoW5VyUikRkuVeDEi=w48-h48-c-k-nd",
                              "width": 48,
                              "height": 48
                            }
                          ],
                          "accessibility": {
                            "accessibilityData": {
                              "label": "わらわら"
                            }
                          }
                        },
                        "isCustomEmoji": true
                      }
                    }
                  ]
                },
                "authorName": {
                  "simpleText": "my goodboy lhr"
                },
                "authorPhoto": {
                  "thumbnails": [
                    {
                      "url": "https://yt4.ggpht.com/ytc/AKedOLSUdKG9hrw-jYtEQs31kk4ekwU3z7EU0uF-Dlo=s32-c-k-c0x00ffffff-no-rj",
                      "width": 32,
                      "height": 32
                    },
                    {
                      "url": "https://yt4.ggpht.com/ytc/AKedOLSUdKG9hrw-jYtEQs31kk4ekwU3z7EU0uF-Dlo=s64-c-k-c0x00ffffff-no-rj",
                      "width": 64,
                      "height": 64
                    }
                  ]
                },
                "contextMenuEndpoint": {
                  "commandMetadata": {
                    "webCommandMetadata": {
                      "ignoreNavigation": true
                    }
                  },
                  "liveChatItemContextMenuEndpoint": {
                    "params": "Q2tjS1JRb2FRMHRZYkc5YWVUUTBVRVZEUmxsdFMzZFJiMlJPZUdkRVlXY1NKME5NWWxvdGIzazBORkJGUTBaWlNGQkdaMjlrTTFWTlMyZEJNVFl5TmpFNU1qYzVNVFExT1JvcEtpY0tHRlZEWjNSMFNUaFJabVJYYUhaa00xTlNkRU5aWTBwNmR4SUxaVmMzVVRBeUxYWTRVMk1nQVNnRU1ob0tHRlZEUTI5SExWOTRWVmMzY2xKVmVEZzNNakY0YlU1VFFRJTNEJTNE"
                  }
                },
                "id": "CkUKGkNLWGxvWnk0NFBFQ0ZZbUt3UW9kTnhnRGFnEidDTGJaLW95NDRQRUNGWUhQRmdvZDNVTUtnQTE2MjYxOTI3OTE0NTk%3D",
                "timestampUsec": "1626192789140183",
                "authorBadges": [
                  {
                    "liveChatAuthorBadgeRenderer": {
                      "customThumbnail": {
                        "thumbnails": [
                          {
                            "url": "https://yt3.ggpht.com/bdfwek0QAVdizygL2qtKTv0LMzenDFrHjkWH4OBv7wuukokZisPZa7yAzXHEpWKeEtZdCLOBRw=s16-c-k"
                          },
                          {
                            "url": "https://yt3.ggpht.com/bdfwek0QAVdizygL2qtKTv0LMzenDFrHjkWH4OBv7wuukokZisPZa7yAzXHEpWKeEtZdCLOBRw=s32-c-k"
                          }
                        ]
                      },
                      "tooltip": "會員 (1 個月)",
                      "accessibility": {
                        "accessibilityData": {
                          "label": "會員 (1 個月)"
                        }
                      }
                    }
                  }
                ],
                "authorExternalChannelId": "UCCoG-_xUW7rRUx8721xmNSA",
                "contextMenuAccessibility": {
                  "accessibilityData": {
                    "label": "留言動作"
                  }
                }
              }
            },
            "clientId": "CLbZ-oy44PECFYHPFgod3UMKgA1626192791459"
          }
        }
      ]
    }
  }
}
```
