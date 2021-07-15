type NarrowableKeyedItems<Key extends string, Field extends { [PKey in Key]?: unknown }> = 
  {
    [K in Exclude<Key, keyof Field>]?: never
  } & Field

// Continuations

type ContinuationKeys =
  'reloadContinuationData'
  | 'timedContinuationData'
  | 'invalidationContinuationData'
  | 'liveChatReplayContinuationData'
  | 'playerSeekContinuationData'

  export type ReloadContinuation = NarrowableKeyedItems<ContinuationKeys, {
  reloadContinuationData: {
    continuation: string
  }
}>

export type LiveContinuation = NarrowableKeyedItems<ContinuationKeys, {
  timedContinuationData: {
    timeoutMs: number,
    continuation: string
  }
}>

export type LiveContinuation2 = NarrowableKeyedItems<ContinuationKeys, {
  invalidationContinuationData: {
    timeoutMs: number,
    continuation: string
  }
}>

type LiveReplayContinuation = NarrowableKeyedItems<ContinuationKeys, {
  liveChatReplayContinuationData: {
    timeUntilLastMessageMsec: number,
    continuation: string
  }
}>

type LiveReplaySeekContinuation = NarrowableKeyedItems<ContinuationKeys, {
  playerSeekContinuationData: {
    continuation: string
  }
}>

type LiveContinuations = LiveContinuation | LiveContinuation2
type LiveReplayContinuations = LiveReplayContinuation | LiveReplaySeekContinuation
export type Continuations = LiveContinuations | LiveReplayContinuations

// Text run

type TextRunKeys = 'text' | 'emoji'

type TextRunText = NarrowableKeyedItems<TextRunKeys, {
  text: string
}>
type TextRunEmoji = NarrowableKeyedItems<TextRunKeys, {
  emoji: {
    emojiId: string
    image: {
      thumbnails: {
        url:    string;
        width:  number;
        height: number;
      }[],
      accessibility: {
        accessibilityData: {
          label: string
        }
      }
    }
    isCustomEmoji: boolean
  }
}>
type TextRuns = TextRunText | TextRunEmoji

// Chat item renderer

type ChatItemRendererKeys = 
  'liveChatTextMessageRenderer'
  | 'liveChatPaidMessageRenderer'
  | 'liveChatMembershipItemRenderer'
  | 'liveChatViewerEngagementMessageRenderer'

type TextChatItemRenderer = NarrowableKeyedItems<ChatItemRendererKeys, {
  liveChatTextMessageRenderer: {
    timestampUsec: string,
    /** only in replay */
    timestampText?: {
      simpleText: string
    }
    authorName: {
      simpleText: string
    },
    message: {
      runs: TextRuns[]
    }
  }
}>

type PaidChatItemRenderer = NarrowableKeyedItems<ChatItemRendererKeys, {
  liveChatPaidMessageRenderer: {
    timestampUsec: string,
    /** only in replay */
    timestampText?: {
      simpleText: string
    }
    authorName: {
      simpleText: string
    },
    purchaseAmountText: {
      simpleText: string
    },
    message: {
      runs: TextRuns[]
    }
  }
}>

type MemberChatItemRenderer = NarrowableKeyedItems<ChatItemRendererKeys, {
  liveChatMembershipItemRenderer: {
    timestampUsec: string,
    /** only in replay */
    timestampText?: {
      simpleText: string
    },
    authorName: {
      simpleText: string
    },
    headerSubtext: {
      runs: TextRuns[]
    }
  }
}>

type ViewerEngagementMessageRenderer = NarrowableKeyedItems<ChatItemRendererKeys, {
  liveChatViewerEngagementMessageRenderer: {}
}>

type ChatItemRenderers = 
  TextChatItemRenderer
  | PaidChatItemRenderer
  | MemberChatItemRenderer
  | ViewerEngagementMessageRenderer

// Actions

type ChatActionKeys = 
  'replayChatItemAction'
  | 'addLiveChatTickerItemAction'
  | 'addChatItemAction'

type AddLiveChatTickerItemAction = NarrowableKeyedItems<ChatActionKeys, {
  addLiveChatTickerItemAction: {}
}>

type AddChatItemAction = NarrowableKeyedItems<ChatActionKeys, {
  addChatItemAction: {
    item: ChatItemRenderers
  }
}>

type ReplayAbleChatActions = AddLiveChatTickerItemAction | AddChatItemAction

export type ReplayChatItemAction = NarrowableKeyedItems<ChatActionKeys, {
  replayChatItemAction: {
    actions: ReplayAbleChatActions[],
    videoOffsetTimeMsec: string
  }
}>


export type Actions = AddLiveChatTickerItemAction | AddChatItemAction | ReplayChatItemAction

// Page
export interface VideoData {
  parsedInitialData: {
    contents: {
      twoColumnWatchNextResults: {
        conversationBar: {
          liveChatRenderer: {
            continuations: ReloadContinuation[]
          }
        }
      }
    }
  },
  parsedInitialPlayerResponse: {
    videoDetails: {
      isLive?: boolean
      isLiveContent?: boolean
    }
  }
}

// Chat room page
export interface ChatData {
  parsedInitialData: {
    continuationContents: {
      liveChatContinuation: {
        continuations: Continuations[],
        actions?: Actions[]
      }
    }
  },
  parsedYtCfg: {
    INNERTUBE_API_KEY: string,
    INNERTUBE_CONTEXT: {
      client: Record<string, unknown>,
      user: Record<string, unknown>,
      request: Record<string, unknown>,
      clickTracking: Record<string, unknown>,
    }
  }
}

// Chat room xhr
export interface ChatXhrData {
  continuationContents: {
    liveChatContinuation: {
      continuations: Continuations[]
      actions?: Actions[]
    }
  }
}
