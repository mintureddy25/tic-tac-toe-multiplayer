declare namespace nkruntime {
  export interface Context {
    env: { [key: string]: string };
    executionMode: string;
    node: string;
    version: string;
    headers: { [key: string]: string[] };
    queryParams: { [key: string]: string[] };
    userId: string;
    username: string;
    vars: { [key: string]: string };
    userSessionExp: number;
    sessionId: string;
    clientIp: string;
    clientPort: string;
    matchId: string;
    matchNode: string;
    matchLabel: string;
    matchTickRate: number;
  }

  export interface Logger {
    info(format: string, ...args: any[]): void;
    warn(format: string, ...args: any[]): void;
    error(format: string, ...args: any[]): void;
    debug(format: string, ...args: any[]): void;
  }

  export interface Presence {
    userId: string;
    sessionId: string;
    username: string;
    node: string;
    status?: string;
    reason?: number;
  }

  export interface MatchState {
    [key: string]: any;
  }

  export interface MatchMessage {
    sender: Presence;
    persistence: boolean;
    status: string;
    opCode: number;
    data: ArrayBuffer;
    reliable: boolean;
    receiveTimeMs: number;
  }

  export interface MatchDispatcher {
    broadcastMessage(opCode: number, data?: ArrayBuffer | Uint8Array | null, presences?: Presence[] | null, sender?: Presence | null, reliable?: boolean): void;
    broadcastMessageDeferred(opCode: number, data?: ArrayBuffer | Uint8Array | null, presences?: Presence[] | null, sender?: Presence | null, reliable?: boolean): void;
    matchKick(presences: Presence[]): void;
    matchLabelUpdate(label: string): void;
  }

  export interface MatchHandler {
    matchInit: (ctx: Context, logger: Logger, nk: Nakama, params: { [key: string]: string }) => { state: MatchState; tickRate: number; label: string };
    matchJoinAttempt: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presence: Presence, metadata: { [key: string]: any }) => { state: MatchState; accept: boolean; rejectMessage?: string } | null;
    matchJoin: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presences: Presence[]) => { state: MatchState } | null;
    matchLeave: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, presences: Presence[]) => { state: MatchState } | null;
    matchLoop: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, messages: MatchMessage[]) => { state: MatchState } | null;
    matchSignal: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, data: string) => { state: MatchState; data?: string } | null;
    matchTerminate: (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: MatchState, graceSeconds: number) => { state: MatchState } | null;
  }

  export interface MatchmakerResult {
    presence: Presence;
    properties: {
      numeric: { [key: string]: number };
      string: { [key: string]: string };
    };
  }

  export interface LeaderboardRecord {
    leaderboardId: string;
    ownerId: string;
    username: string;
    score: number;
    subscore: number;
    numScore: number;
    metadata: any;
    createTime: number;
    updateTime: number;
    expiryTime: number;
    rank: number;
    maxNumScore: number;
  }

  export interface LeaderboardRecordList {
    records: LeaderboardRecord[];
    ownerRecords: LeaderboardRecord[];
    prevCursor: string;
    nextCursor: string;
  }

  export interface Match {
    matchId: string;
    authoritative: boolean;
    label: string;
    size: number;
    tickRate: number;
    handlerName: string;
  }

  export interface MatchmakerAdd {
    ticket: string;
  }

  export enum SortOrder {
    ASCENDING = 'asc',
    DESCENDING = 'desc',
  }

  export enum Operator {
    BEST = 'best',
    SET = 'set',
    INCREMENTAL = 'incr',
    DECREMENT = 'decr',
  }

  export interface Nakama {
    matchCreate(name: string, params?: { [key: string]: any }): string;
    matchGet(id: string): Match;
    matchSignal(id: string, data: string): string;
    matchmakerAdd(
      sessionId: string,
      userId: string,
      username: string,
      node: string,
      minCount: number,
      maxCount: number,
      query: string,
      numericProperties?: { [key: string]: number },
      stringProperties?: { [key: string]: string }
    ): MatchmakerAdd;
    leaderboardCreate(
      id: string,
      authoritative: boolean,
      sortOrder?: SortOrder,
      operator?: Operator,
      resetSchedule?: string,
      metadata?: { [key: string]: any }
    ): void;
    leaderboardRecordWrite(
      id: string,
      ownerId: string,
      username?: string,
      score?: number,
      subscore?: number,
      metadata?: string,
      operator?: Operator
    ): LeaderboardRecord;
    leaderboardRecordsList(
      id: string,
      ownerIds?: string[],
      limit?: number,
      cursor?: string,
      overrideExpiry?: number
    ): LeaderboardRecordList;
    leaderboardRecordDelete(id: string, ownerId: string): void;
  }

  export interface Initializer {
    registerRpc(id: string, fn: (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string | void): void;
    registerMatch(name: string, handler: MatchHandler): void;
    registerMatchmakerMatched(fn: (ctx: Context, logger: Logger, nk: Nakama, matches: MatchmakerResult[]) => string | void): void;
  }
}

declare function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer): void;
